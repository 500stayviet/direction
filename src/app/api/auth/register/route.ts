import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeUsername, usernameToEmail } from "@/lib/supabase/email";
import { formatPhoneInput } from "@/lib/format";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      shopName?: string;
      name?: string;
      username?: string;
      password?: string;
      passwordConfirm?: string;
      phone?: string;
      passwordHint?: string;
    };

    const username = normalizeUsername(body.username ?? "");
    const password = body.password ?? "";
    const passwordHint = (body.passwordHint ?? "").trim();
    const shopName = (body.shopName ?? "").trim() || "현장동선";
    const name = (body.name ?? "").trim() || username;
    const phone = formatPhoneInput(body.phone ?? "");

    if (!username) {
      return NextResponse.json(
        { ok: false, message: "아이디를 입력해 주세요." },
        { status: 400 }
      );
    }
    if (username.length < 4) {
      return NextResponse.json(
        { ok: false, message: "아이디는 4자 이상이어야 합니다." },
        { status: 400 }
      );
    }
    if (!/^[a-z0-9._-]+$/.test(username)) {
      return NextResponse.json(
        {
          ok: false,
          message: "아이디는 영문 소문자, 숫자, . _ - 만 사용할 수 있습니다.",
        },
        { status: 400 }
      );
    }
    if (!password || password.length < 6) {
      return NextResponse.json(
        { ok: false, message: "비밀번호는 6자 이상이어야 합니다." },
        { status: 400 }
      );
    }
    if (password !== (body.passwordConfirm ?? "")) {
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
