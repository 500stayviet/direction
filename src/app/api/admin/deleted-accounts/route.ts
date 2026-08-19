import { NextResponse } from "next/server";
import {
  requireAdminSession,
  requireSuper,
} from "@/lib/adminAuth";
import { writeAuditLog } from "@/lib/workspaceServer";
import { withApiErrorLog } from "@/lib/appErrorLog";

/** 탈퇴 계정 목록 + 슈퍼만 복구(밴 해제, deleted_accounts 제거, 동일 아이디 유지) */
async function __GET_handler(request: Request) {
  const auth = await requireAdminSession(request);
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, message: auth.message },
      { status: auth.status }
    );
  }

  const url = new URL(request.url);
  const rawQ = (url.searchParams.get("q") ?? "").trim();
  const safeQ = rawQ.replace(/[%_,]/g, "").trim();

  let query = auth.admin
    .from("deleted_accounts")
    .select(
      "username, former_user_id, shop_name, display_name, phone, deleted_at, data_snapshot, profile_created_at"
    )
    .order("deleted_at", { ascending: false })
    .limit(50);

  if (safeQ) {
    query = query.or(
      [
        `username.ilike.%${safeQ}%`,
        `shop_name.ilike.%${safeQ}%`,
        `display_name.ilike.%${safeQ}%`,
        `phone.ilike.%${safeQ}%`,
      ].join(",")
    );
  }

  const { data, error } = await query;
  if (error) {
    const msg = error.message || "";
    const missing =
      msg.includes("deleted_accounts") ||
      msg.includes("schema cache") ||
      msg.includes("does not exist");
    return NextResponse.json(
      {
        ok: false,
        message: missing
          ? "탈퇴 계정 테이블이 없습니다. Supabase에서 004_deleted_accounts.sql 을 실행해 주세요."
          : msg,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    accounts: (data ?? []).map((d) => {
      const snap = (d.data_snapshot ?? {}) as {
        counts?: Record<string, number>;
      };
      const deletedAt = d.deleted_at ? Date.parse(String(d.deleted_at)) : NaN;
      const ageDays = Number.isFinite(deletedAt)
        ? Math.floor((Date.now() - deletedAt) / 86400000)
        : null;
      return {
        username: d.username,
        formerUserId: d.former_user_id,
        shopName: d.shop_name,
        name: d.display_name,
        phone:
          auth.session.role === "super"
            ? d.phone
            : d.phone
              ? "•••-••••-••••"
              : "-",
        deletedAt: d.deleted_at,
        ageDays,
        within30Days: ageDays != null ? ageDays <= 30 : true,
        counts: snap.counts ?? {},
      };
    }),
  });
}

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
    const body = (await request.json()) as { username?: string };
    const username = (body.username ?? "").trim().toLowerCase();
    if (!username) {
      return NextResponse.json(
        { ok: false, message: "아이디가 필요합니다." },
        { status: 400 }
      );
    }

    const { data: row, error } = await auth.admin
      .from("deleted_accounts")
      .select("*")
      .eq("username", username)
      .maybeSingle();
    if (error || !row) {
      return NextResponse.json(
        { ok: false, message: error?.message ?? "탈퇴 기록을 찾을 수 없습니다." },
        { status: error ? 500 : 404 }
      );
    }

    const userId = String(row.former_user_id);
    const { data: authUser, error: getErr } =
      await auth.admin.auth.admin.getUserById(userId);
    if (getErr || !authUser.user) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "원본 인증 계정을 찾을 수 없습니다. (완전 삭제된 계정은 복구할 수 없습니다.)",
        },
        { status: 404 }
      );
    }

    const meta = authUser.user.user_metadata ?? {};
    const { error: unbanErr } = await auth.admin.auth.admin.updateUserById(
      userId,
      {
        ban_duration: "none",
        user_metadata: {
          ...meta,
          account_deleted: false,
          account_restored_at: new Date().toISOString(),
        },
      }
    );
    if (unbanErr) {
      return NextResponse.json(
        { ok: false, message: unbanErr.message },
        { status: 500 }
      );
    }

    // 프로필 재동기화
    await auth.admin.from("profiles").upsert({
      id: userId,
      username: row.username,
      shop_name: row.shop_name,
      display_name: row.display_name,
      phone: row.phone,
      password_hint: row.password_hint,
    });

    await auth.admin.from("deleted_accounts").delete().eq("username", username);

    await writeAuditLog(auth.admin, {
      actorName: `${auth.session.title}:${auth.session.displayName}`,
      action: "admin_restore_deleted_account",
      entityType: "account",
      entityId: userId,
      detail: { username },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        message: e instanceof Error ? e.message : "탈퇴 계정 복구 실패",
      },
      { status: 500 }
    );
  }
}

export const GET = withApiErrorLog(__GET_handler);
export const POST = withApiErrorLog(__POST_handler);
