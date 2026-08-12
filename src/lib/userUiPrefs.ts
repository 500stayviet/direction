"use client";

import { createClient } from "@/lib/supabase/client";
import { peekCurrentUser } from "@/lib/auth";
import {
  applyAlertStateFromRemote,
  ensureTeamAlertsUser,
  getTeamAlertsSnapshot,
  type AlertState,
} from "@/lib/teamAlerts";
import {
  applyHideStateFromRemote,
  ensureTeamShareHidesUser,
  getHideSnapshot,
  type HideState,
} from "@/lib/teamShareHides";

type UiPrefs = {
  hides: HideState;
  alerts: AlertState;
};

let pushTimer: number | null = null;
let pushing = false;
let pulling = false;

function isMissingUiPrefsColumn(error: { message?: string } | null) {
  const msg = (error?.message || "").toLowerCase();
  return (
    msg.includes("ui_prefs") ||
    msg.includes("does not exist") ||
    msg.includes("schema cache")
  );
}

function sortedUnique(ids: Iterable<string>): string[] {
  return [...new Set([...ids].filter(Boolean))].sort();
}

function mergeHideLists(a: string[], b: string[]): string[] {
  return sortedUnique([...a, ...b]);
}

function mergeHides(local: HideState, remote: HideState): HideState {
  return {
    customers: mergeHideLists(local.customers, remote.customers),
    properties: mergeHideLists(local.properties, remote.properties),
    schedules: mergeHideLists(local.schedules, remote.schedules),
  };
}

function mergeKnownUnseen(localKnown: string[], localUnseen: string[], remoteKnown: string[], remoteUnseen: string[]) {
  const known = sortedUnique([...localKnown, ...remoteKnown]);
  const seen = new Set<string>([
    ...localKnown.filter((id) => !localUnseen.includes(id)),
    ...remoteKnown.filter((id) => !remoteUnseen.includes(id)),
  ]);
  return {
    known,
    unseen: known.filter((id) => !seen.has(id)),
  };
}

function mergeAlerts(local: AlertState, remote: AlertState): AlertState {
  const customers = mergeKnownUnseen(
    local.knownShare.customers,
    local.unseenShare.customers,
    remote.knownShare.customers,
    remote.unseenShare.customers
  );
  const properties = mergeKnownUnseen(
    local.knownShare.properties,
    local.unseenShare.properties,
    remote.knownShare.properties,
    remote.unseenShare.properties
  );
  const navi = mergeKnownUnseen(
    local.knownShare.navi,
    local.unseenShare.navi,
    remote.knownShare.navi,
    remote.unseenShare.navi
  );
  const knownMatch = mergeKnownUnseen(
    local.knownMatch,
    [],
    remote.knownMatch,
    []
  ).known;
  const matchC = mergeKnownUnseen(
    local.knownMatch,
    local.unseenMatchCustomer,
    remote.knownMatch,
    remote.unseenMatchCustomer
  );
  const matchP = mergeKnownUnseen(
    local.knownMatch,
    local.unseenMatchProperty,
    remote.knownMatch,
    remote.unseenMatchProperty
  );

  return {
    shareSeeded: {
      customers: local.shareSeeded.customers || remote.shareSeeded.customers,
      properties: local.shareSeeded.properties || remote.shareSeeded.properties,
      navi: local.shareSeeded.navi || remote.shareSeeded.navi,
    },
    matchSeeded: local.matchSeeded || remote.matchSeeded,
    knownShare: {
      customers: customers.known,
      properties: properties.known,
      navi: navi.known,
    },
    unseenShare: {
      customers: customers.unseen,
      properties: properties.unseen,
      navi: navi.unseen,
    },
    knownMatch,
    unseenMatchCustomer: matchC.unseen,
    unseenMatchProperty: matchP.unseen,
    preserveDemoShareAlerts:
      local.preserveDemoShareAlerts || remote.preserveDemoShareAlerts,
  };
}

function parseRemote(raw: unknown): UiPrefs | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as { hides?: Partial<HideState>; alerts?: Partial<AlertState> };
  const hides: HideState = {
    customers: Array.isArray(o.hides?.customers) ? o.hides.customers : [],
    properties: Array.isArray(o.hides?.properties) ? o.hides.properties : [],
    schedules: Array.isArray(o.hides?.schedules) ? o.hides.schedules : [],
  };
  const a = o.alerts;
  if (!a) {
    return {
      hides,
      alerts: getTeamAlertsSnapshot(),
    };
  }
  return {
    hides,
    alerts: {
      shareSeeded: {
        customers: Boolean(a.shareSeeded?.customers),
        properties: Boolean(a.shareSeeded?.properties),
        navi: Boolean(a.shareSeeded?.navi),
      },
      matchSeeded: Boolean(a.matchSeeded),
      knownShare: {
        customers: a.knownShare?.customers ?? [],
        properties: a.knownShare?.properties ?? [],
        navi: a.knownShare?.navi ?? [],
      },
      unseenShare: {
        customers: a.unseenShare?.customers ?? [],
        properties: a.unseenShare?.properties ?? [],
        navi: a.unseenShare?.navi ?? [],
      },
      knownMatch: a.knownMatch ?? [],
      unseenMatchCustomer: a.unseenMatchCustomer ?? [],
      unseenMatchProperty: a.unseenMatchProperty ?? [],
      preserveDemoShareAlerts: Boolean(a.preserveDemoShareAlerts),
    },
  };
}

function currentPrefs(): UiPrefs {
  return {
    hides: getHideSnapshot(),
    alerts: getTeamAlertsSnapshot(),
  };
}

function samePrefs(a: UiPrefs, b: UiPrefs): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function scheduleUiPrefsPush() {
  if (pulling || typeof window === "undefined") return;
  if (pushTimer) window.clearTimeout(pushTimer);
  pushTimer = window.setTimeout(() => {
    pushTimer = null;
    void pushUiPrefs();
  }, 450);
}

export async function pullAndMergeUiPrefs(): Promise<void> {
  const userId = peekCurrentUser()?.id;
  if (!userId || pulling) return;
  ensureTeamAlertsUser(userId);
  ensureTeamShareHidesUser(userId);
  pulling = true;
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("ui_prefs")
      .eq("id", userId)
      .maybeSingle();
    if (error) {
      if (!isMissingUiPrefsColumn(error)) {
        /* ignore network — 로컬 캐시 유지 */
      }
      return;
    }
    const remote = parseRemote(data?.ui_prefs);
    const local = currentPrefs();
    if (!remote) {
      if (
        local.hides.customers.length +
          local.hides.properties.length +
          local.hides.schedules.length >
          0 ||
        local.alerts.shareSeeded.customers ||
        local.alerts.matchSeeded
      ) {
        await pushUiPrefs();
      }
      return;
    }
    const merged: UiPrefs = {
      hides: mergeHides(local.hides, remote.hides),
      alerts: mergeAlerts(local.alerts, remote.alerts),
    };
    applyHideStateFromRemote(merged.hides);
    applyAlertStateFromRemote(merged.alerts);
    if (!samePrefs(merged, remote)) {
      await pushUiPrefs();
    }
  } catch {
    /* ignore */
  } finally {
    pulling = false;
  }
}

async function pushUiPrefs(): Promise<void> {
  const userId = peekCurrentUser()?.id;
  if (!userId || pushing || pulling) return;
  pushing = true;
  try {
    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ ui_prefs: currentPrefs() })
      .eq("id", userId);
    if (error && isMissingUiPrefsColumn(error)) return;
  } catch {
    /* ignore */
  } finally {
    pushing = false;
  }
}
