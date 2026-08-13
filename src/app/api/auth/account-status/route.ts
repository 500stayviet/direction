import { NextResponse } from "next/server";
import { withApiErrorLog } from "@/lib/appErrorLog";
import {
  getAuthUserFromToken,
  getBearerToken,
} from "@/lib/serverAuth";

/** 로그인 유지 중 정지 여부 최신 확인 + last_seen 갱신 */
async function __GET_handler(request: Request) {
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ ok: false, suspended: false }, { status: 401 });
  }

  try {
    const auth = await getAuthUserFromToken(token);
    if (!auth) {
      return NextResponse.json({ ok: false, suspended: false }, { status: 401 });
    }

    const now = new Date().toISOString();
    await auth.admin
      .from("profiles")
      .update({ last_seen_at: now })
      .eq("id", auth.user.id);

    const { data: profile } = await auth.admin
      .from("profiles")
      .select("matching_enabled, plan_tier, promo_source")
      .eq("id", auth.user.id)
      .maybeSingle();

    const { data, error } = await auth.admin.auth.admin.getUserById(
      auth.user.id
    );
    if (error || !data.user) {
      return NextResponse.json({ ok: false, suspended: false }, { status: 404 });
    }

    const meta = (data.user.user_metadata ?? {}) as Record<string, unknown>;
    if (meta.account_deleted === true) {
      return NextResponse.json({
        ok: true,
        suspended: true,
        deleted: true,
        reason: "탈퇴된 계정입니다.",
      });
    }

    const suspended = meta.account_suspended === true;
    const matchingEnabled = profile?.matching_enabled !== false;
    const planTier = profile?.plan_tier ? String(profile.plan_tier) : "free";
    const promoSource = profile?.promo_source
      ? String(profile.promo_source)
      : null;
    return NextResponse.json({
      ok: true,
      suspended,
      deleted: false,
      matchingEnabled,
      planTier,
      promoSource,
      reason: suspended
        ? String(meta.account_suspended_reason ?? "관리자 정지")
        : null,
    });
  } catch {
    return NextResponse.json(
      { ok: false, suspended: false, message: "상태 확인 실패" },
      { status: 500 }
    );
  }
}

export const GET = withApiErrorLog(__GET_handler);
