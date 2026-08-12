import { NextResponse } from "next/server";
import { requireAdminSession, requireSuper } from "@/lib/adminAuth";
import { writeAuditLog } from "@/lib/workspaceServer";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
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

  try {
    const { data: profile, error } = await auth.admin
      .from("profiles")
      .select(
        "id, username, shop_name, display_name, phone, password_hint, created_at"
      )
      .eq("id", userId)
      .maybeSingle();
    if (error || !profile) {
      return NextResponse.json(
        { ok: false, message: error?.message ?? "계정을 찾을 수 없습니다." },
        { status: error ? 500 : 404 }
      );
    }

    const [
      { count: customersActive },
      { count: customersDeleted },
      { count: propertiesActive },
      { count: propertiesDeleted },
      { count: schedulesActive },
      { count: schedulesDeleted },
      { data: membership },
    ] = await Promise.all([
      auth.admin
        .from("customers")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .is("deleted_at", null),
      auth.admin
        .from("customers")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .not("deleted_at", "is", null),
      auth.admin
        .from("listed_properties")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .is("deleted_at", null),
      auth.admin
        .from("listed_properties")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .not("deleted_at", "is", null),
      auth.admin
        .from("schedules")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .is("deleted_at", null),
      auth.admin
        .from("schedules")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .not("deleted_at", "is", null),
      auth.admin
        .from("workspace_members")
        .select("workspace_id, role")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

    let team: {
      workspaceId: string;
      name: string;
      role: string;
      memberCount: number;
    } | null = null;

    if (membership?.workspace_id) {
      const [{ data: ws }, { count: memberCount }] = await Promise.all([
        auth.admin
          .from("workspaces")
          .select("id, name")
          .eq("id", membership.workspace_id)
          .maybeSingle(),
        auth.admin
          .from("workspace_members")
          .select("*", { count: "exact", head: true })
          .eq("workspace_id", membership.workspace_id),
      ]);
      if (ws) {
        team = {
          workspaceId: String(ws.id),
          name: String(ws.name ?? "팀 공간"),
          role: String(membership.role ?? "member"),
          memberCount: memberCount ?? 1,
        };
      }
    }

    // 상세는 요약만 — 고객/매물/네비 전체는 /entities 로 조회
    const canReveal = auth.session.role === "super";
    const profilePhone = String(profile.phone ?? "");

    const { data: authData } = await auth.admin.auth.admin.getUserById(userId);
    const authUser = authData?.user;
    const meta = (authUser?.user_metadata ?? {}) as Record<string, unknown>;
    const bannedUntil = authUser?.banned_until
      ? Date.parse(String(authUser.banned_until))
      : NaN;
    const isBanned =
      Number.isFinite(bannedUntil) && bannedUntil > Date.now();
    const isDeleted = meta.account_deleted === true;
    // 앱 이용 정지는 metadata 기준 (로그인 허용). 예전 ban만 걸린 경우도 정지로 표시
    const isSuspended =
      !isDeleted && (meta.account_suspended === true || isBanned);

    return NextResponse.json({
      ok: true,
      account: {
        id: profile.id,
        username: profile.username,
        shopName: profile.shop_name,
        name: profile.display_name,
        // 가입자 본인 전화는 관리자 상세에서 마스킹하지 않음
        phone: profilePhone || "-",
        phoneRaw: profilePhone || undefined,
        passwordHint: canReveal ? profile.password_hint : undefined,
        createdAt: profile.created_at,
        status: isDeleted
          ? "deleted"
          : isSuspended
            ? "suspended"
            : "active",
        suspendedAt: meta.account_suspended_at
          ? String(meta.account_suspended_at)
          : null,
        suspendedReason: meta.account_suspended_reason
          ? String(meta.account_suspended_reason)
          : null,
        counts: {
          customersActive: customersActive ?? 0,
          customersDeleted: customersDeleted ?? 0,
          propertiesActive: propertiesActive ?? 0,
          propertiesDeleted: propertiesDeleted ?? 0,
          schedulesActive: schedulesActive ?? 0,
          schedulesDeleted: schedulesDeleted ?? 0,
        },
        team,
      },
      canReveal,
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        message: e instanceof Error ? e.message : "계정 상세 조회 실패",
      },
      { status: 500 }
    );
  }
}

/** 계정 정지 / 정지 해제 (슈퍼만) */
export async function POST(request: Request, { params }: Params) {
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

  const { id } = await params;
  const userId = (id ?? "").trim();
  if (!userId) {
    return NextResponse.json(
      { ok: false, message: "계정 id가 필요합니다." },
      { status: 400 }
    );
  }

  try {
    const body = (await request.json()) as {
      action?: string;
      reason?: string;
    };
    const action = (body.action ?? "").trim();
    if (action !== "suspend" && action !== "unsuspend") {
      return NextResponse.json(
        { ok: false, message: "action 은 suspend 또는 unsuspend 입니다." },
        { status: 400 }
      );
    }

    const { data: profile } = await auth.admin
      .from("profiles")
      .select("id, username")
      .eq("id", userId)
      .maybeSingle();
    if (!profile) {
      return NextResponse.json(
        { ok: false, message: "계정을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const { data: authData, error: getErr } =
      await auth.admin.auth.admin.getUserById(userId);
    if (getErr || !authData.user) {
      return NextResponse.json(
        { ok: false, message: getErr?.message ?? "인증 계정을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const meta = (authData.user.user_metadata ?? {}) as Record<
      string,
      unknown
    >;
    if (meta.account_deleted === true) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "탈퇴된 계정입니다. 정지와 별개로 「탈퇴 계정」에서 복구해 주세요.",
        },
        { status: 400 }
      );
    }

    const actor = `${auth.session.title}:${auth.session.displayName}`;

    if (action === "suspend") {
      const reason = (body.reason ?? "").trim() || "관리자 정지";
      const now = new Date().toISOString();
      // 로그인 가능해야 하므로 ban 하지 않음. 이미 밴돼 있으면 해제.
      const { error } = await auth.admin.auth.admin.updateUserById(userId, {
        ban_duration: "none",
        user_metadata: {
          ...meta,
          account_suspended: true,
          account_suspended_at: now,
          account_suspended_reason: reason,
          account_suspended_by: actor,
        },
      });
      if (error) {
        return NextResponse.json(
          { ok: false, message: error.message },
          { status: 500 }
        );
      }
      await writeAuditLog(auth.admin, {
        actorName: actor,
        action: "admin_suspend_account",
        entityType: "account",
        entityId: userId,
        detail: { username: profile.username, reason },
      });
      return NextResponse.json({ ok: true, status: "suspended" });
    }

    const { error } = await auth.admin.auth.admin.updateUserById(userId, {
      ban_duration: "none",
      user_metadata: {
        ...meta,
        account_suspended: false,
        account_suspended_at: null,
        account_suspended_reason: null,
        account_unsuspended_at: new Date().toISOString(),
        account_unsuspended_by: actor,
      },
    });
    if (error) {
      return NextResponse.json(
        { ok: false, message: error.message },
        { status: 500 }
      );
    }
    await writeAuditLog(auth.admin, {
      actorName: actor,
      action: "admin_unsuspend_account",
      entityType: "account",
      entityId: userId,
      detail: { username: profile.username },
    });
    return NextResponse.json({ ok: true, status: "active" });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        message: e instanceof Error ? e.message : "계정 상태 변경 실패",
      },
      { status: 500 }
    );
  }
}
