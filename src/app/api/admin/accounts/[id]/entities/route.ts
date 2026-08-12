import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/adminAuth";
import { DEMO_ENTITY_ID_LIKE } from "@/lib/demoSeedPayload";
import { withApiErrorLog } from "@/lib/appErrorLog";

type Params = { params: Promise<{ id: string }> };

const TABLES = {
  customers: "customers",
  properties: "listed_properties",
  schedules: "schedules",
} as const;

/** 계정별 고객·매물·네비 전체 조회 (검색·활성/삭제) */
async function __GET_handler(request: Request, { params }: Params) {
  const auth = await requireAdminSession(request);
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, message: auth.message },
      { status: auth.status }
    );
  }

  const { id } = await params;
  const userId = (id ?? "").trim();
  if (!userId) {
    return NextResponse.json(
      { ok: false, message: "계정 id가 필요합니다." },
      { status: 400 }
    );
  }

  const url = new URL(request.url);
  const type = (url.searchParams.get("type") ??
    "customers") as keyof typeof TABLES;
  const scope = (url.searchParams.get("scope") ?? "active") as
    | "active"
    | "deleted"
    | "all";
  const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
  const limit = Math.min(
    200,
    Math.max(1, Number(url.searchParams.get("limit") ?? 80) || 80)
  );
  const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0) || 0);

  const table = TABLES[type];
  if (!table) {
    return NextResponse.json(
      { ok: false, message: "type 이 올바르지 않습니다." },
      { status: 400 }
    );
  }

  try {
    const maskPhone = (phone: string) => (phone ? "•••-••••-••••" : "-");
    const maskRoomNo = (roomNo: string) => (roomNo ? "•••" : "");

    // 검색 시 넓은 범위를 가져온 뒤 payload 기준 필터 (json 전문검색 대신)
    const fetchLimit = q ? Math.min(500, Math.max(limit, 200)) : limit;
    const fetchOffset = q ? 0 : offset;

    let query = auth.admin
      .from(table)
      .select(
        "id, user_id, payload, deleted_at, workspace_shared, created_at, updated_at, created_by_name",
        { count: "exact" }
      )
      .eq("user_id", userId)
      .not("id", "like", DEMO_ENTITY_ID_LIKE)
      .order("updated_at", { ascending: false })
      .range(fetchOffset, fetchOffset + fetchLimit - 1);

    if (scope === "active") query = query.is("deleted_at", null);
    if (scope === "deleted") query = query.not("deleted_at", "is", null);

    const { data, error, count } = await query;
    if (error) {
      return NextResponse.json(
        { ok: false, message: error.message },
        { status: 500 }
      );
    }

    // 리스트는 항상 마스킹 (슈퍼도 목록에서 원문 비공개 → 상세에서만)
    let rows = (data ?? []).map((row) => {
      const p = (row.payload ?? {}) as Record<string, unknown>;
      const deleted = Boolean(row.deleted_at);
      const shared = Boolean(row.workspace_shared);

      if (type === "customers") {
        const phone = String(p.phone ?? "");
        return {
          id: row.id,
          title: String(p.name ?? row.id),
          subtitle: [
            String(p.roomType || p.dealType || "").trim(),
            maskPhone(phone),
          ]
            .filter(Boolean)
            .join(" · "),
          shared,
          deleted,
          updatedAt: row.updated_at,
        };
      }

      if (type === "properties") {
        const address = String(p.address ?? "-");
        const roomNo = String(p.roomNo ?? "");
        return {
          id: row.id,
          title: address,
          subtitle: [
            String(p.propertyType || p.dealType || "").trim(),
            roomNo ? `${maskRoomNo(roomNo)}호` : "",
          ]
            .filter(Boolean)
            .join(" · "),
          shared,
          deleted,
          updatedAt: row.updated_at,
        };
      }

      const guest = String(
        p.guestName || p.customerName || p.customerId || row.id
      );
      const when = String(p.visitDate || p.date || p.appointmentAt || "").trim();
      return {
        id: row.id,
        title: guest,
        subtitle: [when, String(p.createdByName || row.created_by_name || "")]
          .filter(Boolean)
          .join(" · "),
        shared,
        deleted,
        updatedAt: row.updated_at,
      };
    });

    if (q) {
      rows = rows.filter((r) => {
        const hay = `${r.title} ${r.subtitle}`.toLowerCase();
        return hay.includes(q);
      });
      const page = rows.slice(offset, offset + limit);
      return NextResponse.json({
        ok: true,
        type,
        scope,
        total: rows.length,
        offset,
        limit,
        hasMore: rows.length > offset + limit,
        rows: page,
      });
    }

    return NextResponse.json({
      ok: true,
      type,
      scope,
      total: count ?? rows.length,
      offset,
      limit,
      hasMore: (count ?? 0) > offset + limit,
      rows,
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        message: e instanceof Error ? e.message : "목록 조회 실패",
      },
      { status: 500 }
    );
  }
}

export const GET = withApiErrorLog(__GET_handler);
