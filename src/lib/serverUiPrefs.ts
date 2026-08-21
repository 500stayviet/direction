import type { createAdminClient } from "@/lib/supabase/admin";
import type { AlertState } from "@/lib/teamAlerts";
import type { HideState } from "@/lib/teamShareHides";

type Admin = ReturnType<typeof createAdminClient>;

export type RemoteUiPrefs = {
  alerts: AlertState | null;
  hides: HideState | null;
};

function emptyHides(): HideState {
  return { customers: [], properties: [], schedules: [] };
}

function parseAlerts(raw: unknown): AlertState | null {
  if (!raw || typeof raw !== "object") return null;
  const a = (raw as { alerts?: Partial<AlertState> }).alerts;
  if (!a || typeof a !== "object") return null;
  return {
    shareSeeded: {
      customers: Boolean(a.shareSeeded?.customers),
      properties: Boolean(a.shareSeeded?.properties),
      navi: Boolean(a.shareSeeded?.navi),
    },
    matchSeeded: Boolean(a.matchSeeded),
    newMatchSeeded: Boolean(a.newMatchSeeded),
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
    knownNewMatch: a.knownNewMatch ?? [],
    unseenMatchCustomer: a.unseenMatchCustomer ?? [],
    unseenMatchProperty: a.unseenMatchProperty ?? [],
    unseenNewMatchCustomer: a.unseenNewMatchCustomer ?? [],
    unseenNewMatchProperty: a.unseenNewMatchProperty ?? [],
    alertSince:
      a.alertSince && typeof a.alertSince === "object"
        ? (a.alertSince as Record<string, number>)
        : {},
    preserveDemoMatchAlerts: Boolean(
      a.preserveDemoMatchAlerts ??
        (a as { preserveDemoShareAlerts?: boolean }).preserveDemoShareAlerts
    ),
  };
}

function parseHides(raw: unknown): HideState {
  if (!raw || typeof raw !== "object") return emptyHides();
  const h = (raw as { hides?: Partial<HideState> }).hides;
  if (!h || typeof h !== "object") return emptyHides();
  return {
    customers: Array.isArray(h.customers) ? h.customers : [],
    properties: Array.isArray(h.properties) ? h.properties : [],
    schedules: Array.isArray(h.schedules) ? h.schedules : [],
  };
}

export async function loadRemoteUiPrefsForUser(
  admin: Admin,
  userId: string
): Promise<RemoteUiPrefs> {
  const { data, error } = await admin
    .from("profiles")
    .select("ui_prefs")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data?.ui_prefs) {
    return { alerts: null, hides: emptyHides() };
  }

  const raw = data.ui_prefs;
  return {
    alerts: parseAlerts(raw),
    hides: parseHides(raw),
  };
}
