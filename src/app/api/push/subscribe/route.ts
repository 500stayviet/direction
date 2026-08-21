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

    const body = (await request.json()) as {
      endpoint?: string;
      keys?: { p256dh?: string; auth?: string };
      userAgent?: string;
    };

    const endpoint = body.endpoint?.trim();
    const p256dh = body.keys?.p256dh?.trim();
    const authKey = body.keys?.auth?.trim();
    if (!endpoint || !p256dh || !authKey) {
      return NextResponse.json(
        { ok: false, message: "구독 정보가 올바르지 않습니다." },
        { status: 400 }
      );
    }

    const { error } = await auth.admin.from("push_subscriptions").upsert(
      {
        user_id: auth.user.id,
        endpoint,
        p256dh,
        auth: authKey,
        user_agent: body.userAgent?.slice(0, 500) ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,endpoint" }
    );

    if (error) {
      return NextResponse.json(
        { ok: false, message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        message: e instanceof Error ? e.message : "구독 저장에 실패했습니다.",
      },
      { status: 500 }
    );
  }
}

export const POST = withApiErrorLog(__POST_handler);
