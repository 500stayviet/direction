import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeUsername, usernameToEmail } from "@/lib/supabase/email";
import { withApiErrorLog } from "@/lib/appErrorLog";
import {
  checkResetLock,
  clearResetFailures,
  getClientIp,
  recordResetFailure,
} from "@/lib/authResetAttempts";

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

async function __POST_handler(request: Request) {
  try {
    const body = (await request.json()) as {
      username?: string;
      hint?: string;
      newPassword?: string;
    };

    const username = normalizeUsername(body.username ?? "");
    const hint = (body.hint ?? "").trim();
    const newPassword = (body.newPassword ?? "").normalize("NFKC").trim();
    const ip = getClientIp(request);

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

    const lock = await checkResetLock(admin, username, ip);
    if (lock.locked) {
      return NextResponse.json(
        { ok: false, message: lock.message },
        { status: 429 }
      );
    }

    const { data: deletedAccount } = await admin
      .from("deleted_accounts")
      .select("username")
      .eq("username", username)
      .maybeSingle();
    if (deletedAccount) {
      await recordResetFailure(admin, username, ip);
      return NextResponse.json(
        { ok: false, message: "아이디 또는 힌트가 올바르지 않습니다." },
        { status: 400 }
      );
    }

    // profiles + Auth 메타데이터 둘 다 확인 (가입 시 힌트 불일치 방지)
    const { data: profile } = await admin
      .from("profiles")
      .select("id, password_hint")
      .eq("username", username)
      .maybeSingle();

    const authUser = await findAuthUserByUsername(admin, username);
    const userId = (profile?.id as string | undefined) ?? authUser?.id;
    if (!userId) {
      await recordResetFailure(admin, username, ip);
      return NextResponse.json(
        { ok: false, message: "아이디 또는 힌트가 올바르지 않습니다." },
        { status: 404 }
      );
    }

    const hints = [
      String(profile?.password_hint ?? "").trim(),
      String(authUser?.user_metadata?.password_hint ?? "").trim(),
    ].filter(Boolean);

    const hintOk = hints.some((h) => h === hint);
    if (!hintOk) {
      await recordResetFailure(admin, username, ip);
      return NextResponse.json(
        {
          ok: false,
          message:
            "비밀번호 힌트가 일치하지 않습니다. 가입할 때 입력한 힌트 그대로 입력해 주세요. (비밀번호와 다를 수 있습니다)",
        },
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

    await clearResetFailures(admin, username, ip);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { ok: false, message: "요청을 처리하지 못했습니다." },
      { status: 500 }
    );
  }
}

export const POST = withApiErrorLog(__POST_handler);
