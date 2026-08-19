import { NextResponse } from "next/server";
import {
  requireAdminSession,
  requireSuper,
} from "@/lib/adminAuth";
import { writeAuditLog } from "@/lib/workspaceServer";
import { withApiErrorLog } from "@/lib/appErrorLog";

const TABLES = {
  customers: "customers",
  properties: "listed_properties",
  schedules: "schedules",
} as const;

async function __GET_handler(request: Request) {
  const auth = await requireAdminSession(request);
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, message: auth.message },
      { status: auth.status }
    );
  }

  const url = new URL(request.url);
  const type = (url.searchParams.get("type") ??
    "customers") as keyof typeof TABLES;
  const userId = (url.searchParams.get("userId") ?? "").trim();
  const rawQ = (url.searchParams.get("q") ?? "").trim();
  const q = rawQ.toLowerCase();
  const safeQ = rawQ.replace(/[%_,]/g, "").trim();
  const table = TABLES[type] ?? TABLES.customers;
  // 기본은 최근 50건까지 내려줘야 UI의 “더보기(5개씩)”가 동작함
  const pageLimit = 50;
  const fetchLimit = q ? 200 : pageLimit;

  try {
    let ownerIdsFromProfile: string[] = [];
    if (safeQ) {
      const { data: profiles } = await auth.admin
        .from("profiles")
        .select("id")
        .or(
          [
            `username.ilike.%${safeQ}%`,
            `shop_name.ilike.%${safeQ}%`,
            `display_name.ilike.%${safeQ}%`,
            `phone.ilike.%${safeQ}%`,
          ].join(",")
        )
        .limit(100);
      ownerIdsFromProfile = (profiles ?? []).map((p) => String(p.id));
    }

    let query = auth.admin
      .from(table)
      .select(
        "id, user_id, workspace_id, created_by_name, deleted_at, deleted_by, created_at, updated_at, payload, workspace_shared"
      )
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false })
      .limit(fetchLimit);

    if (userId) query = query.eq("user_id", userId);

    const { data: recent, error } = await query;
    if (error) {
      return NextResponse.json(
        { ok: false, message: error.message },
        { status: 500 }
      );
    }

    const byId = new Map(
      (recent ?? []).map((r) => [`${r.user_id}:${r.id}`, r])
    );

    // 아이디·상호·전화로 맞은 계정의 삭제 건은 최근 N건 밖이어도 포함
    if (!userId && ownerIdsFromProfile.length > 0) {
      const { data: byOwner } = await auth.admin
        .from(table)
        .select(
          "id, user_id, workspace_id, created_by_name, deleted_at, deleted_by, created_at, updated_at, payload, workspace_shared"
        )
        .not("deleted_at", "is", null)
        .in("user_id", ownerIdsFromProfile)
        .order("deleted_at", { ascending: false })
        .limit(q ? 50 : pageLimit);
      for (const r of byOwner ?? []) {
        byId.set(`${r.user_id}:${r.id}`, r);
      }
    }

    const data = [...byId.values()];

    const canReveal = auth.session.role === "super";
    const userIds = [
      ...new Set((data ?? []).map((r) => String(r.user_id)).filter(Boolean)),
    ];

    const profileMap = new Map<
      string,
      {
        username: string;
        shopName: string;
        name: string;
        phone: string;
      }
    >();
    if (userIds.length > 0) {
      const { data: profiles } = await auth.admin
        .from("profiles")
        .select("id, username, shop_name, display_name, phone")
        .in("id", userIds);
      for (const p of profiles ?? []) {
        profileMap.set(String(p.id), {
          username: String(p.username ?? ""),
          shopName: String(p.shop_name ?? ""),
          name: String(p.display_name ?? ""),
          phone: String(p.phone ?? ""),
        });
      }
    }

    let rows = (data ?? []).map((row) => {
      const payload = (row.payload ?? {}) as Record<string, unknown>;
      const deletedAt = row.deleted_at
        ? Date.parse(String(row.deleted_at))
        : NaN;
      const ageDays = Number.isFinite(deletedAt)
        ? Math.floor((Date.now() - deletedAt) / 86400000)
        : null;
      const owner = profileMap.get(String(row.user_id));
      const title =
        type === "customers"
          ? String(payload.name ?? row.id)
          : type === "properties"
            ? (() => {
                const address = String(payload.address ?? row.id);
                const roomNo = String(payload.roomNo ?? "").trim();
                if (!roomNo) return address;
                return canReveal
                  ? `${address} ${roomNo}`
                  : `${address} •••`;
              })()
            : String(payload.guestName || payload.customerId || row.id);

      const payloadPhone = String(payload.phone ?? "");
      const tenantPhone = String(payload.tenantPhone ?? "");
      const landlordPhone = String(payload.landlordPhone ?? "");

      return {
        id: row.id,
        user_id: row.user_id,
        created_by_name: row.created_by_name,
        deleted_at: row.deleted_at,
        title,
        ageDays,
        within30Days: ageDays != null ? ageDays <= 30 : true,
        payload: canReveal ? payload : undefined,
        owner: owner
          ? {
              username: owner.username,
              shopName: owner.shopName,
              name: owner.name,
              phone: canReveal
                ? owner.phone || "-"
                : owner.phone
                  ? "•••-••••-••••"
                  : "-",
            }
          : null,
        // 검색용(응답에는 안 씀) — 아래에서만 사용
        _searchHay: [
          title,
          row.created_by_name,
          owner?.username,
          owner?.shopName,
          owner?.name,
          owner?.phone,
          payloadPhone,
          tenantPhone,
          landlordPhone,
          String(payload.address ?? ""),
          String(payload.guestName ?? ""),
          String(payload.name ?? ""),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase(),
      };
    });

    if (q) {
      const profileHit = new Set(ownerIdsFromProfile);
      rows = rows.filter(
        (r) =>
          r._searchHay.includes(q) || profileHit.has(String(r.user_id))
      );
    }

    // 최신순 정렬 후 페이지 한도
    rows.sort((a, b) => {
      const ta = a.deleted_at ? Date.parse(String(a.deleted_at)) : 0;
      const tb = b.deleted_at ? Date.parse(String(b.deleted_at)) : 0;
      return tb - ta;
    });
    const totalMatched = rows.length;
    rows = rows.slice(0, pageLimit);

    return NextResponse.json({
      ok: true,
      q,
      limit: pageLimit,
      total: totalMatched,
      rows: rows.map(({ _searchHay, ...rest }) => rest),
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        message: e instanceof Error ? e.message : "삭제 목록 조회 실패",
      },
      { status: 500 }
    );
  }
}

/** 슈퍼만: 원래 계정 또는 다른 계정으로 복원 */
async function __POST_handler(request: Request) {
  const auth = await requireAdminSession(request);
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, message: auth.message },
      { status: auth.status }
    );
  }
  const superOk = requireSuper(auth.session);
  if (!superOk.ok) {
    return NextResponse.json(
      { ok: false, message: superOk.message },
      { status: superOk.status }
    );
  }

  try {
    const body = (await request.json()) as {
      type?: keyof typeof TABLES;
      id?: string;
      fromUserId?: string;
      toUsername?: string;
      toUserId?: string;
    };
    const type = body.type ?? "customers";
    const table = TABLES[type];
    const id = (body.id ?? "").trim();
    const fromUserId = (body.fromUserId ?? "").trim();
    if (!table || !id || !fromUserId) {
      return NextResponse.json(
        { ok: false, message: "type, id, fromUserId 가 필요합니다." },
        { status: 400 }
      );
    }

    let toUserId = (body.toUserId ?? "").trim();
    const toUsername = (body.toUsername ?? "").trim().toLowerCase();
    if (!toUserId && toUsername) {
      const { data: profile } = await auth.admin
        .from("profiles")
        .select("id")
        .eq("username", toUsername)
        .maybeSingle();
      toUserId = String(profile?.id ?? "");
    }
    if (!toUserId) toUserId = fromUserId;

    const { data: targetProfile } = await auth.admin
      .from("profiles")
      .select("id, username, display_name, shop_name")
      .eq("id", toUserId)
      .maybeSingle();
    if (!targetProfile) {
      return NextResponse.json(
        { ok: false, message: "복원 대상 계정을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const { data: row } = await auth.admin
      .from(table)
      .select("id, user_id, workspace_id, payload, deleted_at")
      .eq("user_id", fromUserId)
      .eq("id", id)
      .maybeSingle();
    if (!row || !row.deleted_at) {
      return NextResponse.json(
        { ok: false, message: "삭제된 항목을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const now = new Date().toISOString();
    const ownerName =
      String(targetProfile.display_name || "").trim() ||
      String(targetProfile.shop_name || "").trim() ||
      String(targetProfile.username || "").trim();

    if (toUserId === fromUserId) {
      const { error } = await auth.admin
        .from(table)
        .update({
          deleted_at: null,
          deleted_by: null,
          updated_at: now,
        })
        .eq("user_id", fromUserId)
        .eq("id", id);
      if (error) {
        return NextResponse.json(
          { ok: false, message: error.message },
          { status: 500 }
        );
      }
    } else {
      const payload = {
        ...((row.payload as Record<string, unknown>) ?? {}),
        id,
        createdBy: toUserId,
        updatedAt: now,
      };
      const { error } = await auth.admin
        .from(table)
        .update({
          user_id: toUserId,
          created_by: toUserId,
          created_by_name: ownerName,
          workspace_id: null,
          workspace_shared: false,
          deleted_at: null,
          deleted_by: null,
          payload,
          updated_at: now,
        })
        .eq("user_id", fromUserId)
        .eq("id", id);
      if (error) {
        return NextResponse.json(
          { ok: false, message: error.message },
          { status: 500 }
        );
      }
    }

    await writeAuditLog(auth.admin, {
      workspaceId: (row.workspace_id as string | null) ?? null,
      actorName: `${auth.session.title}:${auth.session.displayName}`,
      action: "admin_restore_entity",
      entityType: type,
      entityId: id,
      detail: {
        fromUserId,
        toUserId,
        toUsername: targetProfile.username,
      },
    });

    return NextResponse.json({ ok: true, toUserId });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        message: e instanceof Error ? e.message : "복원 실패",
      },
      { status: 500 }
    );
  }
}

export const GET = withApiErrorLog(__GET_handler);
export const POST = withApiErrorLog(__POST_handler);
