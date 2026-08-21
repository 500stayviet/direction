import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withApiErrorLog } from "@/lib/appErrorLog";
import {
  computeWorkspaceMatchPairs,
  pairKeysToCandidates,
} from "@/lib/serverAlertScan";
import { computeSharePushCandidates } from "@/lib/serverShareAlertScan";
import { loadRemoteUiPrefsForUser } from "@/lib/serverUiPrefs";
import {
  loadForeignSharedEntitiesForUser,
  loadMatchPoolCustomersForUser,
  loadMatchPoolPropertiesForUser,
} from "@/lib/serverWorkspaceEntities";
import {
  isWebPushConfigured,
  resolveOrigin,
  sendMatchWebPush,
  sendShareWebPush,
} from "@/lib/webPushSend";

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  return header === `Bearer ${secret}`;
}

async function loadSentKeys(
  admin: ReturnType<typeof createAdminClient>,
  userId: string
): Promise<Set<string>> {
  const { data } = await admin
    .from("alert_push_log")
    .select("pair_key, kind")
    .eq("user_id", userId);
  const set = new Set<string>();
  for (const row of data ?? []) {
    set.add(`${row.kind as string}:${row.pair_key as string}`);
  }
  return set;
}

async function pruneStaleLogs(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  activeKeys: Set<string>
) {
  const { data } = await admin
    .from("alert_push_log")
    .select("id, pair_key, kind")
    .eq("user_id", userId);
  for (const row of data ?? []) {
    const key = `${row.kind as string}:${row.pair_key as string}`;
    if (!activeKeys.has(key)) {
      await admin.from("alert_push_log").delete().eq("id", row.id as string);
    }
  }
}

async function sendToSubscriptions(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  subs: { endpoint: string; p256dh: string; auth: string }[],
  send: (sub: { endpoint: string; p256dh: string; auth: string }) => Promise<boolean>
): Promise<boolean> {
  let anySent = false;
  for (const sub of subs) {
    const ok = await send(sub).catch(() => false);
    if (ok === false) {
      await admin
        .from("push_subscriptions")
        .delete()
        .eq("user_id", userId)
        .eq("endpoint", String(sub.endpoint));
      continue;
    }
    anySent = true;
  }
  return anySent;
}

async function processUser(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  origin: string
): Promise<{ sent: number; skipped: number; shareSent: number; shareSkipped: number }> {
  const [customers, properties, foreignShared, uiPrefs, subsRes, sentKeys] =
    await Promise.all([
      loadMatchPoolCustomersForUser(admin, userId),
      loadMatchPoolPropertiesForUser(admin, userId),
      loadForeignSharedEntitiesForUser(admin, userId),
      loadRemoteUiPrefsForUser(admin, userId),
      admin
        .from("push_subscriptions")
        .select("endpoint, p256dh, auth")
        .eq("user_id", userId),
      loadSentKeys(admin, userId),
    ]);

  const subs = subsRes.data ?? [];
  if (subs.length === 0) {
    return { sent: 0, skipped: 0, shareSent: 0, shareSkipped: 0 };
  }

  const matchPairs = computeWorkspaceMatchPairs(customers, properties, userId);
  const matchCandidates = pairKeysToCandidates(matchPairs);
  const shareCandidates = computeSharePushCandidates({
    foreign: foreignShared,
    alerts: uiPrefs.alerts,
    hides: uiPrefs.hides,
  });

  const activeKeys = new Set([
    ...matchCandidates.map((c) => `${c.kind}:${c.pairKey}`),
    ...shareCandidates.map((c) => `share:${c.pairKey}`),
  ]);
  await pruneStaleLogs(admin, userId, activeKeys);

  const customerById = new Map(customers.map((c) => [c.id, c]));
  const propertyById = new Map(properties.map((p) => [p.id, p]));

  let sent = 0;
  let skipped = 0;
  let shareSent = 0;
  let shareSkipped = 0;

  for (const candidate of matchCandidates) {
    const dedupeKey = `${candidate.kind}:${candidate.pairKey}`;
    if (sentKeys.has(dedupeKey)) {
      skipped += 1;
      continue;
    }

    const customer = customerById.get(candidate.customerId);
    const property = propertyById.get(candidate.propertyId);
    if (!customer || !property) continue;

    const anySent = await sendToSubscriptions(admin, userId, subs, (sub) =>
      sendMatchWebPush({
        subscription: sub,
        kind: candidate.kind,
        customer,
        property,
        customerId: candidate.customerId,
        propertyId: candidate.propertyId,
        side: candidate.side,
        origin,
      })
    );

    if (anySent) {
      await admin.from("alert_push_log").upsert(
        {
          user_id: userId,
          pair_key: candidate.pairKey,
          kind: candidate.kind,
          sent_at: new Date().toISOString(),
        },
        { onConflict: "user_id,pair_key,kind" }
      );
      sent += 1;
    }
  }

  for (const candidate of shareCandidates) {
    const dedupeKey = `share:${candidate.pairKey}`;
    if (sentKeys.has(dedupeKey)) {
      shareSkipped += 1;
      continue;
    }

    const anySent = await sendToSubscriptions(admin, userId, subs, (sub) =>
      sendShareWebPush({
        subscription: sub,
        tab: candidate.tab,
        entityId: candidate.entityId,
        label: candidate.label,
        origin,
      })
    );

    if (anySent) {
      await admin.from("alert_push_log").upsert(
        {
          user_id: userId,
          pair_key: candidate.pairKey,
          kind: "share",
          sent_at: new Date().toISOString(),
        },
        { onConflict: "user_id,pair_key,kind" }
      );
      shareSent += 1;
    }
  }

  return { sent, skipped, shareSent, shareSkipped };
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
    const result = await processUser(admin, userId, origin);
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
