import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeUsername, usernameToEmail } from "@/lib/supabase/email";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      username?: string;
      password?: string;
    };

    const username = normalizeUsername(body.username ?? "");
    const password = (body.password ?? "").normalize("NFKC").trim();

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
    const user = {
      id: data.user.id,
      username: String(meta.username ?? username),
      shopName: String(meta.shop_name ?? "현장동선"),
      name: String(meta.display_name ?? meta.username ?? username),
      phone: String(meta.phone ?? ""),
      passwordHint: String(meta.password_hint ?? ""),
      createdAt: data.user.created_at ?? new Date().toISOString(),
    };

    const res = NextResponse.json({
      ok: true,
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      },
      user,
    });

    // 화면 로그인 상태용 쿠키 (토큰은 클라이언트가 localStorage에 저장)
    res.cookies.set("realty_app_user_v1", JSON.stringify(user), {
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
      sameSite: "lax",
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
    });

    return res;
  } catch {
    return NextResponse.json(
      { ok: false, message: "로그인 요청을 처리하지 못했습니다." },
      { status: 500 }
    );
  }
}
