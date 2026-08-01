import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeUsername } from "@/lib/supabase/email";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      username?: string;
      hint?: string;
      newPassword?: string;
    };

    const username = normalizeUsername(body.username ?? "");
    const hint = (body.hint ?? "").trim();
    const newPassword = body.newPassword ?? "";

    if (!username) {
      return NextResponse.json(
        { ok: false, message: "아이디를 입력해 주세요." },
        { status: 400 }
      );
    }
    if (!hint) {
      return NextResponse.json(
        { ok: false, message: "비밀번호 힌트를 입력해 주세요." },
        { status: 400 }
      );
    }
    if (newPassword.length < 6) {
      return NextResponse.json(
        { ok: false, message: "새 비밀번호는 6자 이상이어야 합니다." },
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
            "비밀번호 재설정이 설정되지 않았습니다. .env.local에 SUPABASE_SERVICE_ROLE_KEY를 넣어 주세요.",
        },
        { status: 503 }
      );
    }

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id, password_hint")
      .eq("username", username)
      .maybeSingle();

    if (profileError) {
      return NextResponse.json(
        { ok: false, message: "프로필 조회에 실패했습니다." },
        { status: 500 }
      );
    }
    if (!profile) {
      return NextResponse.json(
        { ok: false, message: "아이디를 찾을 수 없습니다." },
        { status: 404 }
      );
    }
    if (profile.password_hint !== hint) {
      return NextResponse.json(
        { ok: false, message: "비밀번호 힌트가 일치하지 않습니다." },
        { status: 403 }
      );
    }

    const { error: updateError } = await admin.auth.admin.updateUserById(
      profile.id,
      { password: newPassword }
    );

    if (updateError) {
      return NextResponse.json(
        { ok: false, message: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { ok: false, message: "요청을 처리하지 못했습니다." },
      { status: 500 }
    );
  }
}
