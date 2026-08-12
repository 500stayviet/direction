import { NextResponse } from "next/server";
import { getClientIp, loginAdmin } from "@/lib/adminAuth";
import { withApiErrorLog } from "@/lib/appErrorLog";

async function __POST_handler(request: Request) {
  try {
    const body = (await request.json()) as {
      username?: string;
      password?: string;
    };
    const result = await loginAdmin(
      body.username ?? "",
      body.password ?? "",
      getClientIp(request)
    );
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, message: result.message },
        { status: 401 }
      );
    }
    return NextResponse.json({
      ok: true,
      token: result.token,
      session: result.session,
    });
  } catch {
    return NextResponse.json(
      { ok: false, message: "로그인 요청을 처리하지 못했습니다." },
      { status: 500 }
    );
  }
}

export const POST = withApiErrorLog(__POST_handler);
