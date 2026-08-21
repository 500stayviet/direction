import { sharePairKey } from "@/lib/alertMessaging";
import type { AlertTab } from "@/lib/teamAlerts";
import type { AlertState } from "@/lib/teamAlerts";
import type { HideState } from "@/lib/teamShareHides";

export type ForeignSharedEntity = {
  id: string;
  tab: AlertTab;
  label: string;
};

export type SharePushCandidate = {
  pairKey: string;
  tab: AlertTab;
  entityId: string;
  label: string;
};

function hiddenIds(hides: HideState | null, tab: AlertTab): Set<string> {
  if (!hides) return new Set();
  if (tab === "navi") return new Set(hides.schedules);
  return new Set(hides[tab]);
}

/** 클라이언트 syncShareIds 와 동일 — shareSeeded 탭에서 known에 없는 foreign id */
export function computeSharePushCandidates(input: {
  foreign: ForeignSharedEntity[];
  alerts: AlertState | null;
  hides: HideState | null;
}): SharePushCandidate[] {
  const out: SharePushCandidate[] = [];
  const alerts = input.alerts;
  if (!alerts) return out;

  for (const entity of input.foreign) {
    if (entity.id.startsWith("demo_")) continue;
    if (!alerts.shareSeeded[entity.tab]) continue;
    if (hiddenIds(input.hides, entity.tab).has(entity.id)) continue;
    if (alerts.knownShare[entity.tab].includes(entity.id)) continue;

    out.push({
      pairKey: sharePairKey(entity.tab, entity.id),
      tab: entity.tab,
      entityId: entity.id,
      label: entity.label,
    });
  }

  return out;
}
