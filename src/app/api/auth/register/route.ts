import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { usernameToEmail, validateUsernameFormat } from "@/lib/supabase/email";
import { formatPhoneInput, normalizeShopName } from "@/lib/format";
import {
import { withApiErrorLog } from "@/lib/appErrorLog";
  applySignupPromotions,
  isPromoSignupEnabled,
  resolveSignupEventCode,
} from "@/lib/promoCodes";

async function __POST_handler(request: Request) {
  try {
    const body = (await request.json()) as {
      shopName?: string;
      name?: string;
      username?: string;
      password?: string;
      passwordConfirm?: string;
      phone?: string;
      passwordHint?: string;
      /** 추천인 아이디 또는 프로모 코드 (한 칸) */
      eventCode?: string;
      referrerUsername?: string;
      promoCode?: string;
    };

    const usernameCheck = validateUsernameFormat(body.username ?? "");
    if (!usernameCheck.ok) {
      return NextResponse.json(
        { ok: false, message: usernameCheck.message },
        { status: 400 }
      );
    }
    const username = usernameCheck.username;
    const password = (body.password ?? "").normalize("NFKC").trim();
    const passwordConfirm = (body.passwordConfirm ?? "")
      .normalize("NFKC")
      .trim();
    const passwordHint = (body.passwordHint ?? "").trim();
    const shopName = normalizeShopName(body.shopName ?? "");
    const name = (body.name ?? "").trim() || username;
    const phone = formatPhoneInput(body.phone ?? "");

    if (!password || password.length < 6) {
      return NextResponse.json(
        { ok: false, message: "비밀번호는 6자 이상이어야 합니다." },
        { status: 400 }
      );
    }
    if (password !== passwordConfirm) {
      return NextResponse.json(
        { ok: false, message: "비밀번호 확인이 일치하지 않습니다." },
        { status: 400 }
      );
    }
    if (!passwordHint) {
      return NextResponse.json(
        { ok: false, message: "비밀번호 힌트를 입력해 주세요." },
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
            "서버 설정이 없습니다. Vercel/.env.local 에 SUPABASE_SERVICE_ROLE_KEY 를 넣어 주세요.",
        },
        { status: 503 }
      );
    }

    const email = usernameToEmail(username);

    // 삭제된 아이디·활성 아이디 모두 재가입 차단
    const [{ data: deletedRow }, { data: activeProfile }] = await Promise.all([
      admin
        .from("deleted_accounts")
        .select("username")
        .eq("username", username)
        .maybeSingle(),
      admin
        .from("profiles")
        .select("username")
        .eq("username", username)
        .maybeSingle(),
    ]);
    if (deletedRow) {
      return NextResponse.json(
        { ok: false, message: "해당 아이디를 사용할 수 없습니다." },
        { status: 409 }
      );
    }
    if (activeProfile) {
      return NextResponse.json(
        { ok: false, message: "이미 사용 중인 아이디입니다." },
        { status: 409 }
      );
    }

    const promoEnabled = isPromoSignupEnabled();
    let resolvedPromoCode = (body.promoCode ?? "").trim() || undefined;
    let resolvedReferrer = (body.referrerUsername ?? "").trim() || undefined;

    if (promoEnabled) {
      const eventRaw = (body.eventCode ?? "").trim();
      if (eventRaw) {
        const resolved = await resolveSignupEventCode(admin, eventRaw);
        if (!resolved.ok) {
          return NextResponse.json(
            { ok: false, message: resolved.message },
            { status: 400 }
          );
        }
        if (resolved.promoCode) resolvedPromoCode = resolved.promoCode;
        if (resolved.referrerUsername) {
          resolvedReferrer = resolved.referrerUsername;
        }
      }

      if (resolvedReferrer && resolvedReferrer === username) {
        return NextResponse.json(
          { ok: false, message: "본인 아이디는 추천인으로 등록할 수 없습니다." },
          { status: 400 }
        );
      }
    } else {
      resolvedPromoCode = undefined;
      resolvedReferrer = undefined;
    }

    // Auth 메타데이터에 프로필 저장 (profiles 테이블 GRANT 없어도 가입·로그인 가능)
    const { data: created, error: createError } =
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          username,
          shop_name: shopName,
          display_name: name,
          phone,
          password_hint: passwordHint,
        },
      });

    if (createError) {
      const msg = createError.message.toLowerCase();
      if (msg.includes("already") || msg.includes("registered")) {
        return NextResponse.json(
          { ok: false, message: "이미 사용 중인 아이디입니다." },
          { status: 409 }
        );
      }
      if (msg.includes("rate limit")) {
        return NextResponse.json(
          {
            ok: false,
            message:
              "가입 요청이 잠시 제한되었습니다. 잠시 후 다시 시도해 주세요.",
          },
          { status: 429 }
        );
      }
      return NextResponse.json(
        { ok: false, message: createError.message },
        { status: 400 }
      );
    }

    const userId = created.user?.id;
    if (!userId) {
      return NextResponse.json(
        { ok: false, message: "계정 생성에 실패했습니다." },
        { status: 500 }
      );
    }

    // profiles 동기화 (실패해도 Auth 계정은 유지 — 로그인 시 재동기화)
    const { error: profileError } = await admin.from("profiles").upsert({
      id: userId,
      username,
      shop_name: shopName,
      display_name: name,
      phone,
      password_hint: passwordHint,
    });
    if (profileError) {
      await admin.rpc("admin_upsert_profile", {
        p_id: userId,
        p_username: username,
        p_shop_name: shopName,
        p_display_name: name,
        p_phone: phone,
        p_password_hint: passwordHint,
      });
    }

    if (promoEnabled) {
      await applySignupPromotions(admin, {
        userId,
        newUsername: username,
        referrerUsername: resolvedReferrer,
        promoCode: resolvedPromoCode,
      });
    } else {
      // 얼리버드 캠페인은 이벤트 기간 자동 적용 (프로모·추천인 코드는 PROMO_SIGNUP_ENABLED 시만)
      await applySignupPromotions(admin, {
        userId,
        newUsername: username,
      });
    }

    return NextResponse.json({
      ok: true,
      user: {
        id: userId,
        username,
        shopName,
        name,
        phone,
        passwordHint,
        createdAt: created.user.created_at ?? new Date().toISOString(),
      },
    });
  } catch {
    return NextResponse.json(
      { ok: false, message: "회원가입 요청을 처리하지 못했습니다." },
      { status: 500 }
    );
  }
}

export const POST = withApiErrorLog(__POST_handler);
