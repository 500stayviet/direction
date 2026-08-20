"use client";

export type AlertTab = "customers" | "properties" | "navi";
/** 고객 상세에서 본 매칭 vs 매물 상세에서 본 매칭 — 서로 독립 */
export type MatchAlertSide = "customer" | "property";

export type AlertState = {
  shareSeeded: Record<AlertTab, boolean>;
  matchSeeded: boolean;
  newMatchSeeded: boolean;
  knownShare: Record<AlertTab, string[]>;
  unseenShare: Record<AlertTab, string[]>;
  knownMatch: string[];
  knownNewMatch: string[];
  /** 고객 상세 → 조건에 맞는 매물 미열람 (내 리스트) */
  unseenMatchCustomer: string[];
  /** 매물 상세 → 조건에 맞는 고객 미열람 (내 리스트) */
  unseenMatchProperty: string[];
  /** 고객 상세 → 사이트내 공유 매물 미열람 */
  unseenNewMatchCustomer: string[];
  /** 매물 상세 → 사이트내 공유 고객 미열람 */
  unseenNewMatchProperty: string[];
  /** 뱃지 등장 시각 — key 예: share:customers:id, match:c:id, newMatch:p:id */
  alertSince: Record<string, number>;
  /** 데모 시드 알람 — 본인 생성 데모 id를 공유처럼 유지 */
  preserveDemoShareAlerts: boolean;
};

export type ListCardBadgeKind = "share" | "match" | "newMatch" | "deadline";

export type ListCardBadge = {
  kind: ListCardBadgeKind;
  label: string;
  at: number;
};

const STORAGE_PREFIX = "realty_team_alerts_v2";

const emptyTabLists = (): Record<AlertTab, string[]> => ({
  customers: [],
  properties: [],
  navi: [],
});

const emptyTabFlags = (): Record<AlertTab, boolean> => ({
  customers: false,
  properties: false,
  navi: false,
});

const emptyState = (): AlertState => ({
  shareSeeded: emptyTabFlags(),
  matchSeeded: false,
  newMatchSeeded: false,
  knownShare: emptyTabLists(),
  unseenShare: emptyTabLists(),
  knownMatch: [],
  knownNewMatch: [],
  unseenMatchCustomer: [],
  unseenMatchProperty: [],
  unseenNewMatchCustomer: [],
  unseenNewMatchProperty: [],
  alertSince: {},
  preserveDemoShareAlerts: false,
});

type Listener = () => void;
const listeners = new Set<Listener>();

let userId: string | null = null;
let state: AlertState = emptyState();
let skipRemotePush = false;

function notify() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* ignore */
    }
  });
}

function storageKey(uid: string) {
  return `${STORAGE_PREFIX}:${uid}`;
}

function persist() {
  if (typeof window === "undefined" || !userId) return;
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(state));
  } catch {
    /* ignore */
  }
  if (!skipRemotePush) {
    void import("./userUiPrefs").then((m) => m.scheduleUiPrefsPush());
  }
}

function loadFromStorage(uid: string): AlertState {
  if (typeof window === "undefined") return emptyState();
  try {
    const raw = localStorage.getItem(storageKey(uid));
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<AlertState>;
    return {
      shareSeeded: {
        customers: Boolean(parsed.shareSeeded?.customers),
        properties: Boolean(parsed.shareSeeded?.properties),
        navi: Boolean(parsed.shareSeeded?.navi),
      },
      matchSeeded: Boolean(parsed.matchSeeded),
      newMatchSeeded: Boolean(parsed.newMatchSeeded),
      knownShare: {
        customers: parsed.knownShare?.customers ?? [],
        properties: parsed.knownShare?.properties ?? [],
        navi: parsed.knownShare?.navi ?? [],
      },
      unseenShare: {
        customers: parsed.unseenShare?.customers ?? [],
        properties: parsed.unseenShare?.properties ?? [],
        navi: parsed.unseenShare?.navi ?? [],
      },
      knownMatch: parsed.knownMatch ?? [],
      knownNewMatch: parsed.knownNewMatch ?? [],
      unseenMatchCustomer: parsed.unseenMatchCustomer ?? [],
      unseenMatchProperty: parsed.unseenMatchProperty ?? [],
      unseenNewMatchCustomer: parsed.unseenNewMatchCustomer ?? [],
      unseenNewMatchProperty: parsed.unseenNewMatchProperty ?? [],
      alertSince:
        parsed.alertSince && typeof parsed.alertSince === "object"
          ? (parsed.alertSince as Record<string, number>)
          : {},
      preserveDemoShareAlerts: Boolean(parsed.preserveDemoShareAlerts),
    };
  } catch {
    return emptyState();
  }
}

function sortedUnique(ids: Iterable<string>): string[] {
  return [...new Set([...ids].filter(Boolean))].sort();
}

function sameList(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function noteAlertSince(key: string) {
  if (!state.alertSince[key]) {
    state.alertSince = { ...state.alertSince, [key]: Date.now() };
  }
}

function clearAlertSince(key: string) {
  if (!(key in state.alertSince)) return;
  const next = { ...state.alertSince };
  delete next[key];
  state.alertSince = next;
}

function alertSinceOrNow(key: string): number {
  return state.alertSince[key] ?? Date.now();
}

function shareAlertKey(tab: AlertTab, id: string) {
  return `share:${tab}:${id}`;
}

function matchAlertKey(side: "customer" | "property", id: string) {
  return side === "customer" ? `match:c:${id}` : `match:p:${id}`;
}

function newMatchAlertKey(side: "customer" | "property", id: string) {
  return side === "customer" ? `newMatch:c:${id}` : `newMatch:p:${id}`;
}

function deadlineAlertKey(tab: AlertTab, id: string) {
  return `deadline:${tab}:${id}`;
}

export function subscribeTeamAlerts(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getTeamAlertsSnapshot(): AlertState {
  return state;
}

export function applyAlertStateFromRemote(next: AlertState) {
  skipRemotePush = true;
  state = next;
  persist();
  notify();
  skipRemotePush = false;
}

export function ensureTeamAlertsUser(uid: string | null | undefined) {
  const next = uid?.trim() || null;
  if (next === userId) return;
  userId = next;
  state = next ? loadFromStorage(next) : emptyState();
  notify();
}

export function matchPairKey(customerId: string, propertyId: string): string {
  return `${customerId}::${propertyId}`;
}

export function parseMatchPairKey(
  key: string
): { customerId: string; propertyId: string } | null {
  const i = key.indexOf("::");
  if (i <= 0) return null;
  return {
    customerId: key.slice(0, i),
    propertyId: key.slice(i + 2),
  };
}

/** 팀원 공유·생성으로 내 리스트에 보이는 id 동기화 */
export function syncShareIds(tab: AlertTab, foreignIds: string[]) {
  if (!userId) return;
  const incoming = new Set(foreignIds.filter(Boolean));

  // 체험 시드(demo_*)는 본인 생성이라 foreign 목록에 없음 → 알람 유지용으로 포함
  if (state.preserveDemoShareAlerts) {
    for (const id of state.knownShare[tab]) {
      if (id.startsWith("demo_")) incoming.add(id);
    }
    for (const id of state.unseenShare[tab]) {
      if (id.startsWith("demo_")) incoming.add(id);
    }
  }

  if (!state.shareSeeded[tab]) {
    state = {
      ...state,
      shareSeeded: { ...state.shareSeeded, [tab]: true },
      knownShare: {
        ...state.knownShare,
        [tab]: sortedUnique(incoming),
      },
      unseenShare: { ...state.unseenShare, [tab]: [] },
    };
    persist();
    notify();
    return;
  }

  const known = new Set(state.knownShare[tab]);
  const unseen = new Set(state.unseenShare[tab]);

  for (const id of incoming) {
    if (!known.has(id)) {
      known.add(id);
      unseen.add(id);
      noteAlertSince(shareAlertKey(tab, id));
    }
  }
  for (const id of [...known]) {
    if (!incoming.has(id)) {
      known.delete(id);
      unseen.delete(id);
      clearAlertSince(shareAlertKey(tab, id));
    }
  }
  for (const id of [...unseen]) {
    if (!incoming.has(id)) unseen.delete(id);
  }

  const nextKnown = sortedUnique(known);
  const nextUnseen = sortedUnique(unseen);
  if (
    sameList(nextKnown, state.knownShare[tab]) &&
    sameList(nextUnseen, state.unseenShare[tab])
  ) {
    return;
  }

  state = {
    ...state,
    knownShare: { ...state.knownShare, [tab]: nextKnown },
    unseenShare: { ...state.unseenShare, [tab]: nextUnseen },
  };
  persist();
  notify();
}

/** 현재 성립 매칭 쌍 동기화 — own=내 리스트, partner=사이트내 공유(새매칭) */
export function syncMatchPairs(ownKeys: string[], partnerKeys: string[] = []) {
  if (!userId) return;
  syncOwnMatchPairs(ownKeys);
  syncPartnerMatchPairs(partnerKeys);
}

function syncOwnMatchPairs(pairKeys: string[]) {
  if (!userId) return;
  const incoming = new Set(pairKeys.filter(Boolean));

  if (state.preserveDemoShareAlerts) {
    for (const key of state.knownMatch) {
      if (key.includes("demo_")) incoming.add(key);
    }
    for (const key of state.unseenMatchCustomer) {
      if (key.includes("demo_")) incoming.add(key);
    }
    for (const key of state.unseenMatchProperty) {
      if (key.includes("demo_")) incoming.add(key);
    }
  }

  if (!state.matchSeeded) {
    state = {
      ...state,
      matchSeeded: true,
      knownMatch: sortedUnique(incoming),
      unseenMatchCustomer: [],
      unseenMatchProperty: [],
    };
    persist();
    notify();
    return;
  }

  const known = new Set(state.knownMatch);
  const unseenC = new Set(state.unseenMatchCustomer);
  const unseenP = new Set(state.unseenMatchProperty);

  for (const key of incoming) {
    if (!known.has(key)) {
      known.add(key);
      unseenC.add(key);
      unseenP.add(key);
      const parsed = parseMatchPairKey(key);
      if (parsed) {
        noteAlertSince(matchAlertKey("customer", parsed.customerId));
        noteAlertSince(matchAlertKey("property", parsed.propertyId));
      }
    }
  }
  for (const key of [...known]) {
    if (!incoming.has(key)) {
      known.delete(key);
      unseenC.delete(key);
      unseenP.delete(key);
      const parsed = parseMatchPairKey(key);
      if (parsed) {
        if (!hasUnseenOwnMatchForCustomer(parsed.customerId)) {
          clearAlertSince(matchAlertKey("customer", parsed.customerId));
        }
        if (!hasUnseenOwnMatchForProperty(parsed.propertyId)) {
          clearAlertSince(matchAlertKey("property", parsed.propertyId));
        }
      }
    }
  }
  for (const key of [...unseenC]) {
    if (!incoming.has(key)) unseenC.delete(key);
  }
  for (const key of [...unseenP]) {
    if (!incoming.has(key)) unseenP.delete(key);
  }

  const nextKnown = sortedUnique(known);
  const nextC = sortedUnique(unseenC);
  const nextP = sortedUnique(unseenP);
  if (
    sameList(nextKnown, state.knownMatch) &&
    sameList(nextC, state.unseenMatchCustomer) &&
    sameList(nextP, state.unseenMatchProperty)
  ) {
    return;
  }

  state = {
    ...state,
    knownMatch: nextKnown,
    unseenMatchCustomer: nextC,
    unseenMatchProperty: nextP,
  };
  persist();
  notify();
}

function syncPartnerMatchPairs(pairKeys: string[]) {
  if (!userId) return;
  const incoming = new Set(pairKeys.filter(Boolean));

  if (!state.newMatchSeeded) {
    state = {
      ...state,
      newMatchSeeded: true,
      knownNewMatch: sortedUnique(incoming),
      unseenNewMatchCustomer: [],
      unseenNewMatchProperty: [],
    };
    persist();
    notify();
    return;
  }

  const known = new Set(state.knownNewMatch);
  const unseenC = new Set(state.unseenNewMatchCustomer);
  const unseenP = new Set(state.unseenNewMatchProperty);

  for (const key of incoming) {
    if (!known.has(key)) {
      known.add(key);
      unseenC.add(key);
      unseenP.add(key);
      const parsed = parseMatchPairKey(key);
      if (parsed) {
        noteAlertSince(newMatchAlertKey("customer", parsed.customerId));
        noteAlertSince(newMatchAlertKey("property", parsed.propertyId));
      }
    }
  }
  for (const key of [...known]) {
    if (!incoming.has(key)) {
      known.delete(key);
      unseenC.delete(key);
      unseenP.delete(key);
      const parsed = parseMatchPairKey(key);
      if (parsed) {
        if (!hasUnseenNewMatchForCustomer(parsed.customerId)) {
          clearAlertSince(newMatchAlertKey("customer", parsed.customerId));
        }
        if (!hasUnseenNewMatchForProperty(parsed.propertyId)) {
          clearAlertSince(newMatchAlertKey("property", parsed.propertyId));
        }
      }
    }
  }
  for (const key of [...unseenC]) {
    if (!incoming.has(key)) unseenC.delete(key);
  }
  for (const key of [...unseenP]) {
    if (!incoming.has(key)) unseenP.delete(key);
  }

  const nextKnown = sortedUnique(known);
  const nextC = sortedUnique(unseenC);
  const nextP = sortedUnique(unseenP);
  if (
    sameList(nextKnown, state.knownNewMatch) &&
    sameList(nextC, state.unseenNewMatchCustomer) &&
    sameList(nextP, state.unseenNewMatchProperty)
  ) {
    return;
  }

  state = {
    ...state,
    knownNewMatch: nextKnown,
    unseenNewMatchCustomer: nextC,
    unseenNewMatchProperty: nextP,
  };
  persist();
  notify();
}

export function markShareSeen(tab: AlertTab, id: string) {
  if (!userId || !id) return;
  if (!state.unseenShare[tab].includes(id)) return;
  state = {
    ...state,
    unseenShare: {
      ...state.unseenShare,
      [tab]: state.unseenShare[tab].filter((x) => x !== id),
    },
  };
  clearAlertSince(shareAlertKey(tab, id));
  persist();
  notify();
}

export function markMatchSeen(
  customerId: string,
  propertyId: string,
  side: MatchAlertSide,
  partner = false
) {
  if (!userId) return;
  const key = matchPairKey(customerId, propertyId);
  if (partner) {
    if (side === "customer") {
      if (!state.unseenNewMatchCustomer.includes(key)) return;
      state = {
        ...state,
        unseenNewMatchCustomer: state.unseenNewMatchCustomer.filter(
          (x) => x !== key
        ),
      };
      if (!hasUnseenNewMatchForCustomer(customerId)) {
        clearAlertSince(newMatchAlertKey("customer", customerId));
      }
    } else {
      if (!state.unseenNewMatchProperty.includes(key)) return;
      state = {
        ...state,
        unseenNewMatchProperty: state.unseenNewMatchProperty.filter(
          (x) => x !== key
        ),
      };
      if (!hasUnseenNewMatchForProperty(propertyId)) {
        clearAlertSince(newMatchAlertKey("property", propertyId));
      }
    }
  } else if (side === "customer") {
    if (!state.unseenMatchCustomer.includes(key)) return;
    state = {
      ...state,
      unseenMatchCustomer: state.unseenMatchCustomer.filter((x) => x !== key),
    };
    if (!hasUnseenOwnMatchForCustomer(customerId)) {
      clearAlertSince(matchAlertKey("customer", customerId));
    }
  } else {
    if (!state.unseenMatchProperty.includes(key)) return;
    state = {
      ...state,
      unseenMatchProperty: state.unseenMatchProperty.filter((x) => x !== key),
    };
    if (!hasUnseenOwnMatchForProperty(propertyId)) {
      clearAlertSince(matchAlertKey("property", propertyId));
    }
  }
  persist();
  notify();
}

export function isShareUnseen(tab: AlertTab, id: string): boolean {
  return state.unseenShare[tab].includes(id);
}

export function isMatchUnseen(
  customerId: string,
  propertyId: string,
  side: MatchAlertSide,
  partner = false
): boolean {
  const key = matchPairKey(customerId, propertyId);
  if (partner) {
    return side === "customer"
      ? state.unseenNewMatchCustomer.includes(key)
      : state.unseenNewMatchProperty.includes(key);
  }
  return side === "customer"
    ? state.unseenMatchCustomer.includes(key)
    : state.unseenMatchProperty.includes(key);
}

export function hasUnseenOwnMatchForCustomer(customerId: string): boolean {
  const prefix = `${customerId}::`;
  return state.unseenMatchCustomer.some((k) => k.startsWith(prefix));
}

export function hasUnseenOwnMatchForProperty(propertyId: string): boolean {
  const suffix = `::${propertyId}`;
  return state.unseenMatchProperty.some((k) => k.endsWith(suffix));
}

export function hasUnseenNewMatchForCustomer(customerId: string): boolean {
  const prefix = `${customerId}::`;
  return state.unseenNewMatchCustomer.some((k) => k.startsWith(prefix));
}

export function hasUnseenNewMatchForProperty(propertyId: string): boolean {
  const suffix = `::${propertyId}`;
  return state.unseenNewMatchProperty.some((k) => k.endsWith(suffix));
}

/** @deprecated use hasUnseenOwnMatchForCustomer */
export function hasUnseenMatchForCustomer(customerId: string): boolean {
  return hasUnseenOwnMatchForCustomer(customerId);
}

/** @deprecated use hasUnseenOwnMatchForProperty */
export function hasUnseenMatchForProperty(propertyId: string): boolean {
  return hasUnseenOwnMatchForProperty(propertyId);
}

export function firstUnseenMatchPropertyId(
  customerId: string,
  propertyIdsInOrder: string[]
): string | null {
  for (const pid of propertyIdsInOrder) {
    if (isMatchUnseen(customerId, pid, "customer")) return pid;
  }
  return null;
}

export function firstUnseenMatchCustomerId(
  propertyId: string,
  customerIdsInOrder: string[]
): string | null {
  for (const cid of customerIdsInOrder) {
    if (isMatchUnseen(cid, propertyId, "property")) return cid;
  }
  return null;
}

export function getAlertBadgeCounts(): {
  customers: number;
  properties: number;
  navi: number;
} {
  return {
    customers:
      state.unseenShare.customers.length +
      state.unseenMatchCustomer.length +
      state.unseenNewMatchCustomer.length,
    properties:
      state.unseenShare.properties.length +
      state.unseenMatchProperty.length +
      state.unseenNewMatchProperty.length,
    navi: state.unseenShare.navi.length,
  };
}

export function getListCardAlertBadges(input: {
  tab: AlertTab;
  id: string;
  deadlineLabel?: string | null;
  deadlineAt?: number;
}): ListCardBadge[] {
  const badges: ListCardBadge[] = [];
  const { tab, id, deadlineLabel, deadlineAt = 0 } = input;

  if (isShareUnseen(tab, id)) {
    badges.push({
      kind: "share",
      label: "팀공유",
      at: alertSinceOrNow(shareAlertKey(tab, id)),
    });
  }

  if (tab === "customers" && hasUnseenOwnMatchForCustomer(id)) {
    badges.push({
      kind: "match",
      label: "매칭",
      at: alertSinceOrNow(matchAlertKey("customer", id)),
    });
  }
  if (tab === "properties" && hasUnseenOwnMatchForProperty(id)) {
    badges.push({
      kind: "match",
      label: "매칭",
      at: alertSinceOrNow(matchAlertKey("property", id)),
    });
  }

  if (tab === "customers" && hasUnseenNewMatchForCustomer(id)) {
    badges.push({
      kind: "newMatch",
      label: "새매칭",
      at: alertSinceOrNow(newMatchAlertKey("customer", id)),
    });
  }
  if (tab === "properties" && hasUnseenNewMatchForProperty(id)) {
    badges.push({
      kind: "newMatch",
      label: "새매칭",
      at: alertSinceOrNow(newMatchAlertKey("property", id)),
    });
  }

  if (deadlineLabel) {
    badges.push({
      kind: "deadline",
      label: deadlineLabel,
      at: deadlineAt > 0 ? deadlineAt : 0,
    });
  }

  return badges.sort((a, b) => a.at - b.at || a.kind.localeCompare(b.kind));
}

const ALERT_EFFECT_PRIORITY: Record<ListCardBadgeKind, number> = {
  newMatch: 40,
  match: 30,
  share: 20,
  deadline: 10,
};

const ALERT_FRAME_CLASS: Record<ListCardBadgeKind, string> = {
  share: "animate-share-alert-stage",
  match: "animate-match-alert-stage",
  newMatch: "animate-newmatch-alert-stage",
  deadline: "animate-deadline-alert-stage",
};

/** 뱃지 목록에서 카드 테두리·배경 효과용 종류 (복수일 때 우선순위) */
export function listCardAlertEffectFromBadges(
  badges: ListCardBadge[]
): ListCardBadgeKind | null {
  if (badges.length === 0) return null;
  const sorted = [...badges].sort(
    (a, b) =>
      ALERT_EFFECT_PRIORITY[b.kind] - ALERT_EFFECT_PRIORITY[a.kind] ||
      a.at - b.at
  );
  return sorted[0]!.kind;
}

/** 리스트 카드 알람 강조 (뱃지와 동일 조건) */
export function listCardHighlight(
  tab: AlertTab,
  id: string,
  deadlineLabel?: string | null,
  deadlineAt?: number
): ListCardBadgeKind | null {
  return listCardAlertEffectFromBadges(
    getListCardAlertBadges({ tab, id, deadlineLabel, deadlineAt })
  );
}

/** 리스트 카드 테두리 — 알람 시 뱃지 색과 맞는 2.5초 단계 애니메이션 */
export function listCardFrameClass(
  done: boolean,
  effect: ListCardBadgeKind | null | undefined
): string {
  if (done) return "border border-gray-200 bg-gray-50";
  if (effect && ALERT_FRAME_CLASS[effect]) return ALERT_FRAME_CLASS[effect];
  return "border border-gray-200 bg-white";
}

export function alertHighlightClass(
  highlight: ListCardBadgeKind | null | undefined,
  done?: boolean
): string {
  if (done) {
    return "!border-2 !border-solid !bg-gray-200 !border-gray-300 !shadow-none text-gray-500";
  }
  if (highlight && ALERT_FRAME_CLASS[highlight]) {
    return `!shadow-none ${ALERT_FRAME_CLASS[highlight]}`;
  }
  return "!border-2 !border-solid !border-slate-400 !bg-white !shadow-[0_1px_2px_rgba(15,23,42,0.06)]";
}

/**
 * 데모 시드 직후 — 본인 생성 체험 카드도 공유·매칭 알람처럼 보이게 강제.
 * 이미 known에 있는 id는 unseen에 다시 넣지 않음(껐다가 시드 버전 올려도 부활 방지).
 */
export function injectDemoTestAlerts(input: {
  customerIds: string[];
  propertyIds: string[];
  scheduleIds: string[];
  matchPairs: string[];
}) {
  if (!userId) return;

  const merge = (prev: string[], add: string[]) =>
    sortedUnique([...prev, ...add]);

  /** known에 이미 있으면(열람·이전 주입) unseen에 재추가하지 않음 */
  const mergeUnseenNewOnly = (prevUnseen: string[], known: string[], add: string[]) => {
    const knownSet = new Set(known);
    const fresh = add.filter((id) => !knownSet.has(id));
    if (fresh.length === 0) return sortedUnique(prevUnseen);
    return merge(prevUnseen, fresh);
  };

  const nextKnownShare = {
    customers: merge(state.knownShare.customers, input.customerIds),
    properties: merge(state.knownShare.properties, input.propertyIds),
    navi: merge(state.knownShare.navi, input.scheduleIds),
  };
  const nextKnownMatch = merge(state.knownMatch, input.matchPairs);

  state = {
    ...state,
    preserveDemoShareAlerts: true,
    shareSeeded: {
      customers: true,
      properties: true,
      navi: true,
    },
    matchSeeded: true,
    newMatchSeeded: true,
    knownShare: nextKnownShare,
    unseenShare: {
      customers: mergeUnseenNewOnly(
        state.unseenShare.customers,
        state.knownShare.customers,
        input.customerIds
      ),
      properties: mergeUnseenNewOnly(
        state.unseenShare.properties,
        state.knownShare.properties,
        input.propertyIds
      ),
      navi: mergeUnseenNewOnly(
        state.unseenShare.navi,
        state.knownShare.navi,
        input.scheduleIds
      ),
    },
    knownMatch: nextKnownMatch,
    knownNewMatch: state.knownNewMatch,
    unseenMatchCustomer: mergeUnseenNewOnly(
      state.unseenMatchCustomer,
      state.knownMatch,
      input.matchPairs
    ),
    unseenMatchProperty: mergeUnseenNewOnly(
      state.unseenMatchProperty,
      state.knownMatch,
      input.matchPairs
    ),
  };
  persist();
  notify();
}
