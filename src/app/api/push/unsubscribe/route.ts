import { NextResponse } from "next/server";
import { getAuthUserFromToken, getBearerToken } from "@/lib/serverAuth";
import { withApiErrorLog } from "@/lib/appErrorLog";

async function __POST_handler(request: Request) {
  try {
    const auth = await getAuthUserFromToken(getBearerToken(request));
    if (!auth) {
      return NextResponse.json(
        { ok: false, message: "로그인이 필요합니다." },
        { status: 401 }
      );
    }

    const body = (await request.json()) as { endpoint?: string };
    const endpoint = body.endpoint?.trim();
    if (!endpoint) {
      return NextResponse.json(
        { ok: false, message: "endpoint가 필요합니다." },
        { status: 400 }
      );
    }

    await auth.admin
      .from("push_subscriptions")
      .delete()
      .eq("user_id", auth.user.id)
      .eq("endpoint", endpoint);

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        message: e instanceof Error ? e.message : "구독 해제에 실패했습니다.",
      },
      { status: 500 }
    );
  }
}

export const POST = withApiErrorLog(__POST_handler);
