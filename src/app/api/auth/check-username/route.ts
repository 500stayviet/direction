import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateUsernameFormat } from "@/lib/supabase/email";
import { withApiErrorLog } from "@/lib/appErrorLog";

/** 회원가입용 아이디 중복 확인 */
async function __POST_handler(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      username?: string;
    };
    const usernameCheck = validateUsernameFormat(body.username ?? "");
    if (!usernameCheck.ok) {
      return NextResponse.json(
        { ok: false, available: false, message: usernameCheck.message },
        { status: 400 }
      );
    }
    const username = usernameCheck.username;

    let admin;
    try {
      admin = createAdminClient();
    } catch {
      return NextResponse.json(
        {
          ok: false,
          available: false,
          message: "서버 설정이 없습니다. 잠시 후 다시 시도해 주세요.",
        },
        { status: 503 }
      );
    }

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
      return NextResponse.json({
        ok: true,
        available: false,
        username,
        message: "해당 아이디를 사용할 수 없습니다.",
      });
    }
    if (activeProfile) {
      return NextResponse.json({
        ok: true,
        available: false,
        username,
        message: "이미 사용 중인 아이디입니다.",
      });
    }

    return NextResponse.json({
      ok: true,
      available: true,
      username,
      message: "사용 가능한 아이디입니다.",
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "아이디 확인 중 오류가 발생했습니다.";
    return NextResponse.json(
      { ok: false, available: false, message },
      { status: 500 }
    );
  }
}

export const POST = withApiErrorLog(__POST_handler);
