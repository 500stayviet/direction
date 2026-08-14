import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeUsername, usernameToEmail } from "@/lib/supabase/email";
import { backfillShopName } from "@/lib/format";
import { AUTO_LOGIN_MAX_AGE_SEC } from "@/lib/loginPrefs";
import { withApiErrorLog } from "@/lib/appErrorLog";

async function __POST_handler(request: Request) {
  try {
    const body = (await request.json()) as {
      username?: string;
      password?: string;
      autoLogin?: boolean;
    };

    const username = normalizeUsername(body.username ?? "");
    const password = (body.password ?? "").normalize("NFKC").trim();
    const autoLogin = body.autoLogin !== false;

    if (!username || !password) {
      return NextResponse.json(
        { ok: false, message: "아이디 또는 비밀번호가 올바르지 않습니다." },
        { status: 400 }
      );
    }

    let admin;
    try {
      admin = createAdminClient();
    } catch {
      return NextResponse.json(
        {
          ok: false,
          message:
            "서버 설정이 없습니다. Vercel에 SUPABASE_SERVICE_ROLE_KEY 를 확인해 주세요.",
        },
        { status: 503 }
      );
    }

    const { data: deletedAccount } = await admin
      .from("deleted_accounts")
      .select("username")
      .eq("username", username)
      .maybeSingle();

    if (deletedAccount) {
      return NextResponse.json(
        {
          ok: false,
          message: "아이디 또는 비밀번호가 올바르지 않습니다.",
        },
        { status: 401 }
      );
    }

    // service_role로 서버 인증 (Vercel anon 키 불일치 시에도 동작)
    const { data, error } = await admin.auth.signInWithPassword({
      email: usernameToEmail(username),
      password,
    });

    if (error || !data.session || !data.user) {
      const msg = (error?.message ?? "").toLowerCase();
      if (msg.includes("email not confirmed") || msg.includes("not confirmed")) {
        return NextResponse.json(
          {
            ok: false,
            message:
              "이메일 확인이 켜져 있습니다. Supabase에서 Confirm email 을 OFF 로 해 주세요.",
          },
          { status: 401 }
        );
      }
      return NextResponse.json(
        {
          ok: false,
          message:
            "아이디 또는 비밀번호가 올바르지 않습니다. 「비밀번호 찾기」로 새 비밀번호를 설정해 보세요.",
        },
        { status: 401 }
      );
    }

    if (data.user.user_metadata?.account_deleted === true) {
      return NextResponse.json(
        {
          ok: false,
          message: "아이디 또는 비밀번호가 올바르지 않습니다.",
        },
        { status: 401 }
      );
    }

    const meta = data.user.user_metadata ?? {};
    const suspended = meta.account_suspended === true;
    const suspendedReason = suspended
      ? String(meta.account_suspended_reason ?? "관리자 정지")
      : undefined;
    const { data: profile } = await admin
      .from("profiles")
      .select(
        "shop_name, display_name, phone, username, created_at, matching_enabled, plan_tier, promo_source"
      )
      .eq("id", data.user.id)
      .maybeSingle();

    const rawShop = String(
      profile?.shop_name ?? meta.shop_name ?? ""
    )
      .trim()
      .replace(/\s+/g, " ");

    // 미입력·기본값「현장동선」은 그대로, 그 외 접미사 없는 업장명만 보정
    let shopName = rawShop || "현장동선";
    const shouldBackfill =
      Boolean(rawShop) &&
      rawShop !== "현장동선" &&
      !rawShop.includes("부동산") &&
      !rawShop.includes("공인중개사사무소");

    if (shouldBackfill) {
      shopName = backfillShopName(rawShop);
      await admin
        .from("profiles")
        .update({
          shop_name: shopName,
          updated_at: new Date().toISOString(),
        })
        .eq("id", data.user.id);
      try {
        await admin.auth.admin.updateUserById(data.user.id, {
          user_metadata: { ...meta, shop_name: shopName },
        });
      } catch {
        /* ignore metadata sync */
      }
    }

    // passwordHint는 로그인 응답·쿠키에 넣지 않음 (재설정 탈취 면적 축소)
    const user = {
      id: data.user.id,
      username: String(profile?.username ?? meta.username ?? username),
      shopName,
      name: String(
        profile?.display_name ?? meta.display_name ?? meta.username ?? username
      ),
      phone: String(profile?.phone ?? meta.phone ?? ""),
      passwordHint: "",
      createdAt: String(
        profile?.created_at ?? data.user.created_at ?? new Date().toISOString()
      ),
      suspended: suspended || undefined,
      suspendedReason,
      matchingEnabled: profile?.matching_enabled === false ? false : undefined,
      planTier: profile?.plan_tier ? String(profile.plan_tier) : undefined,
      promoSource: profile?.promo_source
        ? String(profile.promo_source)
        : undefined,
    };

    const res = NextResponse.json({
      ok: true,
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      },
      user,
    });

    // 화면 로그인 상태용 쿠키 (힌트 제외 · 토큰은 클라이언트가 저장)
    res.cookies.set(
      "realty_app_user_v1",
      JSON.stringify({ ...user, passwordHint: "" }),
      {
        path: "/",
        maxAge: AUTO_LOGIN_MAX_AGE_SEC,
        sameSite: "lax",
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
      }
    );

    return res;
  } catch {
    return NextResponse.json(
      { ok: false, message: "로그인 요청을 처리하지 못했습니다." },
      { status: 500 }
    );
  }
}

export const POST = withApiErrorLog(__POST_handler);
