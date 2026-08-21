import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withApiErrorLog } from "@/lib/appErrorLog";
import {
  dispatchAllAlertsForUser,
  isWebPushConfigured,
} from "@/lib/serverAlertDispatch";
import { resolveOrigin } from "@/lib/webPushSend";

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  return header === `Bearer ${secret}`;
}

async function __GET_handler(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  if (!isWebPushConfigured()) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      message: "VAPID not configured",
    });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        message: e instanceof Error ? e.message : "Admin client unavailable",
      },
      { status: 503 }
    );
  }

  const origin = resolveOrigin(request);
  const { data: subRows, error } = await admin
    .from("push_subscriptions")
    .select("user_id");

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  const userIds = [...new Set((subRows ?? []).map((r) => r.user_id as string))];
  let totalSent = 0;
  let totalSkipped = 0;
  let totalShareSent = 0;
  let totalShareSkipped = 0;

  for (const userId of userIds) {
    const result = await dispatchAllAlertsForUser(admin, userId, origin);
    totalSent += result.sent;
    totalSkipped += result.skipped;
    totalShareSent += result.shareSent;
    totalShareSkipped += result.shareSkipped;
  }

  return NextResponse.json({
    ok: true,
    users: userIds.length,
    sent: totalSent,
    skipped: totalSkipped,
    shareSent: totalShareSent,
    shareSkipped: totalShareSkipped,
  });
}

export const GET = withApiErrorLog(__GET_handler);
