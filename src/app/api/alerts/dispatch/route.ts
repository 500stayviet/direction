import { NextResponse } from "next/server";
import { withApiErrorLog } from "@/lib/appErrorLog";
import {
  dispatchImmediateEntityAlerts,
  isWebPushConfigured,
} from "@/lib/serverAlertDispatch";
import { getAuthUserFromToken, getBearerToken } from "@/lib/serverAuth";
import { resolveOrigin } from "@/lib/webPushSend";

type DispatchBody = {
  entityKind?: "customer" | "property" | "schedule";
  entityId?: string;
  label?: string;
  workspaceId?: string | null;
  workspaceShared?: boolean;
};

async function __POST_handler(request: Request) {
  const auth = await getAuthUserFromToken(getBearerToken(request));
  if (!auth) {
    return NextResponse.json(
      { ok: false, message: "로그인이 필요합니다." },
      { status: 401 }
    );
  }

  if (!isWebPushConfigured()) {
    return NextResponse.json({ ok: true, skipped: true, message: "VAPID not configured" });
  }

  let body: DispatchBody;
  try {
    body = (await request.json()) as DispatchBody;
  } catch {
    return NextResponse.json(
      { ok: false, message: "요청 형식이 올바르지 않습니다." },
      { status: 400 }
    );
  }

  const entityId = body.entityId?.trim();
  const entityKind = body.entityKind;
  const label = body.label?.trim() || "알림";
  if (!entityId || !entityKind) {
    return NextResponse.json(
      { ok: false, message: "entityKind·entityId가 필요합니다." },
      { status: 400 }
    );
  }

  const origin = resolveOrigin(request);
  const stats = await dispatchImmediateEntityAlerts(auth.admin, {
    actorUserId: auth.user.id,
    workspaceId: body.workspaceId,
    entityKind,
    entityId,
    label,
    workspaceShared: Boolean(body.workspaceShared),
    origin,
  });

  return NextResponse.json({ ok: true, ...stats });
}

export const POST = withApiErrorLog(__POST_handler);
