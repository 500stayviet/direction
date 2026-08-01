import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeUsername, usernameToEmail } from "@/lib/supabase/email";

async function findAuthUserByUsername(
  admin: ReturnType<typeof createAdminClient>,
  username: string
) {
  const email = usernameToEmail(username);
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw error;
    const found = data.users.find(
      (u) =>
        u.email?.toLowerCase() === email ||
        String(u.user_metadata?.username ?? "").toLowerCase() === username
    );
    if (found) return found;
    if (data.users.length < 200) return null;
    page += 1;
    if (page > 50) return null;
  }
}

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

    // 1) profiles 테이블 (권한이 있을 때)
    const { data: profile } = await admin
      .from("profiles")
      .select("id, password_hint")
      .eq("username", username)
      .maybeSingle();

    let userId = profile?.id as string | undefined;
    let passwordHint = profile?.password_hint as string | undefined;

    // 2) 없으면 Auth 메타데이터에서 찾기
    if (!userId) {
      const authUser = await findAuthUserByUsername(admin, username);
      if (!authUser) {
        return NextResponse.json(
          { ok: false, message: "아이디를 찾을 수 없습니다." },
          { status: 404 }
        );
      }
      userId = authUser.id;
      passwordHint = String(authUser.user_metadata?.password_hint ?? "");
    }

    if (passwordHint !== hint) {
      return NextResponse.json(
        { ok: false, message: "비밀번호 힌트가 일치하지 않습니다." },
        { status: 403 }
      );
    }

    const { error: updateError } = await admin.auth.admin.updateUserById(
      userId,
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
