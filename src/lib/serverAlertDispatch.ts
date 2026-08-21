import type { createAdminClient } from "@/lib/supabase/admin";
import {
  computeWorkspaceMatchPairs,
  pairKeysToCandidates,
  type PushCandidate,
} from "@/lib/serverAlertScan";
import {
  computeSharePushCandidates,
  type SharePushCandidate,
} from "@/lib/serverShareAlertScan";
import { loadRemoteUiPrefsForUser } from "@/lib/serverUiPrefs";
import {
  loadForeignSharedEntitiesForUser,
  loadMatchPoolCustomersForUser,
  loadMatchPoolPropertiesForUser,
  loadWorkspaceMemberIds,
} from "@/lib/serverWorkspaceEntities";
import {
  isWebPushConfigured,
  sendMatchWebPush,
  sendShareWebPush,
} from "@/lib/webPushSend";
import type { AlertTab } from "@/lib/teamAlerts";

export type AlertDispatchStats = {
  sent: number;
  skipped: number;
  shareSent: number;
  shareSkipped: number;
};

type SubRow = { endpoint: string; p256dh: string; auth: string };

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

export async function pruneStaleAlertPushLogs(
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
  subs: SubRow[],
  send: (sub: SubRow) => Promise<boolean>
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

function pairTouchesEntity(pairKey: string, entityId: string): boolean {
  return pairKey.startsWith(`${entityId}::`) || pairKey.endsWith(`::${entityId}`);
}

async function dispatchMatchCandidates(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  origin: string,
  subs: SubRow[],
  sentKeys: Set<string>,
  candidates: PushCandidate[]
): Promise<{ sent: number; skipped: number }> {
  const customers = await loadMatchPoolCustomersForUser(admin, userId);
  const properties = await loadMatchPoolPropertiesForUser(admin, userId);
  const customerById = new Map(customers.map((c) => [c.id, c]));
  const propertyById = new Map(properties.map((p) => [p.id, p]));

  let sent = 0;
  let skipped = 0;

  for (const candidate of candidates) {
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
      sentKeys.add(dedupeKey);
      sent += 1;
    }
  }

  return { sent, skipped };
}

async function dispatchShareCandidates(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  origin: string,
  subs: SubRow[],
  sentKeys: Set<string>,
  candidates: SharePushCandidate[]
): Promise<{ shareSent: number; shareSkipped: number }> {
  let shareSent = 0;
  let shareSkipped = 0;

  for (const candidate of candidates) {
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
      sentKeys.add(dedupeKey);
      shareSent += 1;
    }
  }

  return { shareSent, shareSkipped };
}

/** cron용 — 사용자 전체 매칭·팀공유 스캔 */
export async function dispatchAllAlertsForUser(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  origin: string,
  opts?: { pruneStale?: boolean }
): Promise<AlertDispatchStats> {
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

  const subs = (subsRes.data ?? []) as SubRow[];
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

  if (opts?.pruneStale !== false) {
    const activeKeys = new Set([
      ...matchCandidates.map((c) => `${c.kind}:${c.pairKey}`),
      ...shareCandidates.map((c) => `share:${c.pairKey}`),
    ]);
    await pruneStaleAlertPushLogs(admin, userId, activeKeys);
  }

  const matchStats = await dispatchMatchCandidates(
    admin,
    userId,
    origin,
    subs,
    sentKeys,
    matchCandidates
  );
  const shareStats = await dispatchShareCandidates(
    admin,
    userId,
    origin,
    subs,
    sentKeys,
    shareCandidates
  );

  return {
    sent: matchStats.sent,
    skipped: matchStats.skipped,
    shareSent: shareStats.shareSent,
    shareSkipped: shareStats.shareSkipped,
  };
}

/** 저장 직후 — 변경 entity와 관련된 매칭만 */
export async function dispatchMatchAlertsForEntity(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  entityId: string,
  origin: string
): Promise<AlertDispatchStats> {
  const subsRes = await admin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", userId);
  const subs = (subsRes.data ?? []) as SubRow[];
  if (subs.length === 0) {
    return { sent: 0, skipped: 0, shareSent: 0, shareSkipped: 0 };
  }

  const [customers, properties, sentKeys] = await Promise.all([
    loadMatchPoolCustomersForUser(admin, userId),
    loadMatchPoolPropertiesForUser(admin, userId),
    loadSentKeys(admin, userId),
  ]);

  const matchPairs = computeWorkspaceMatchPairs(customers, properties, userId);
  const matchCandidates = pairKeysToCandidates(matchPairs).filter((c) =>
    pairTouchesEntity(c.pairKey, entityId)
  );

  const matchStats = await dispatchMatchCandidates(
    admin,
    userId,
    origin,
    subs,
    sentKeys,
    matchCandidates
  );

  return {
    sent: matchStats.sent,
    skipped: matchStats.skipped,
    shareSent: 0,
    shareSkipped: 0,
  };
}

/** 저장 직후 — 팀공유 1건 */
export async function dispatchShareAlertForEntity(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  input: {
    tab: AlertTab;
    entityId: string;
    label: string;
  },
  origin: string
): Promise<AlertDispatchStats> {
  const [uiPrefs, subsRes, sentKeys] = await Promise.all([
    loadRemoteUiPrefsForUser(admin, userId),
    admin
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", userId),
    loadSentKeys(admin, userId),
  ]);

  const subs = (subsRes.data ?? []) as SubRow[];
  if (subs.length === 0) {
    return { sent: 0, skipped: 0, shareSent: 0, shareSkipped: 0 };
  }

  const shareCandidates = computeSharePushCandidates({
    foreign: [
      {
        id: input.entityId,
        tab: input.tab,
        label: input.label,
      },
    ],
    alerts: uiPrefs.alerts,
    hides: uiPrefs.hides,
  });

  const shareStats = await dispatchShareCandidates(
    admin,
    userId,
    origin,
    subs,
    sentKeys,
    shareCandidates
  );

  return {
    sent: 0,
    skipped: 0,
    shareSent: shareStats.shareSent,
    shareSkipped: shareStats.shareSkipped,
  };
}

export async function dispatchImmediateEntityAlerts(
  admin: ReturnType<typeof createAdminClient>,
  input: {
    actorUserId: string;
    workspaceId: string | null | undefined;
    entityKind: "customer" | "property" | "schedule";
    entityId: string;
    label: string;
    workspaceShared: boolean;
    origin: string;
  }
): Promise<AlertDispatchStats> {
  if (!isWebPushConfigured()) {
    return { sent: 0, skipped: 0, shareSent: 0, shareSkipped: 0 };
  }

  const tab: AlertTab =
    input.entityKind === "customer"
      ? "customers"
      : input.entityKind === "property"
        ? "properties"
        : "navi";

  const userIds = input.workspaceId
    ? await loadWorkspaceMemberIds(admin, input.workspaceId)
    : [input.actorUserId];

  let sent = 0;
  let skipped = 0;
  let shareSent = 0;
  let shareSkipped = 0;

  for (const userId of userIds) {
    const matchStats = await dispatchMatchAlertsForEntity(
      admin,
      userId,
      input.entityId,
      input.origin
    );
    sent += matchStats.sent;
    skipped += matchStats.skipped;

    if (
      input.workspaceShared &&
      input.workspaceId &&
      userId !== input.actorUserId
    ) {
      const shareStats = await dispatchShareAlertForEntity(
        admin,
        userId,
        {
          tab,
          entityId: input.entityId,
          label: input.label,
        },
        input.origin
      );
      shareSent += shareStats.shareSent;
      shareSkipped += shareStats.shareSkipped;
    }
  }

  return { sent, skipped, shareSent, shareSkipped };
}

export { isWebPushConfigured };
