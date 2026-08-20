"use client";

export type AlertTab = "customers" | "properties" | "navi";
/** 고객 상세에서 본 매칭 vs 매물 상세에서 본 매칭 — 서로 독립 */
export type MatchAlertSide = "customer" | "property";

export type AlertState = {
  shareSeeded: Record<AlertTab, boolean>;
  matchSeeded: boolean;
  knownShare: Record<AlertTab, string[]>;
  unseenShare: Record<AlertTab, string[]>;
  knownMatch: string[];
  /** 고객 상세 → 조건에 맞는 매물 미열람 */
  unseenMatchCustomer: string[];
  /** 매물 상세 → 조건에 맞는 고객 미열람 */
  unseenMatchProperty: string[];
  /** 데모 시드 알람 — 본인 생성 데모 id를 공유처럼 유지 */
  preserveDemoShareAlerts: boolean;
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
  knownShare: emptyTabLists(),
  unseenShare: emptyTabLists(),
  knownMatch: [],
  unseenMatchCustomer: [],
  unseenMatchProperty: [],
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
      unseenMatchCustomer: parsed.unseenMatchCustomer ?? [],
      unseenMatchProperty: parsed.unseenMatchProperty ?? [],
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
    }
  }
  for (const id of [...known]) {
    if (!incoming.has(id)) {
      known.delete(id);
      unseen.delete(id);
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

/** 현재 성립 매칭 쌍 동기화 — 신규 쌍은 고객·매물 양쪽에 각각 unseen */
export function syncMatchPairs(pairKeys: string[]) {
  if (!userId) return;
  const incoming = new Set(pairKeys.filter(Boolean));

  // 체험 매칭(demo_*)은 캐시 일시 비움 때 목록에서 빠져도 known에서 지우지 않음
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
    }
  }
  for (const key of [...known]) {
    if (!incoming.has(key)) {
      known.delete(key);
      unseenC.delete(key);
      unseenP.delete(key);
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
  persist();
  notify();
}

export function markMatchSeen(
  customerId: string,
  propertyId: string,
  side: MatchAlertSide
) {
  if (!userId) return;
  const key = matchPairKey(customerId, propertyId);
  if (side === "customer") {
    if (!state.unseenMatchCustomer.includes(key)) return;
    state = {
      ...state,
      unseenMatchCustomer: state.unseenMatchCustomer.filter((x) => x !== key),
    };
  } else {
    if (!state.unseenMatchProperty.includes(key)) return;
    state = {
      ...state,
      unseenMatchProperty: state.unseenMatchProperty.filter((x) => x !== key),
    };
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
  side: MatchAlertSide
): boolean {
  const key = matchPairKey(customerId, propertyId);
  return side === "customer"
    ? state.unseenMatchCustomer.includes(key)
    : state.unseenMatchProperty.includes(key);
}

export function hasUnseenMatchForCustomer(customerId: string): boolean {
  const prefix = `${customerId}::`;
  return state.unseenMatchCustomer.some((k) => k.startsWith(prefix));
}

export function hasUnseenMatchForProperty(propertyId: string): boolean {
  const suffix = `::${propertyId}`;
  return state.unseenMatchProperty.some((k) => k.endsWith(suffix));
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
      state.unseenShare.customers.length + state.unseenMatchCustomer.length,
    properties:
      state.unseenShare.properties.length + state.unseenMatchProperty.length,
    navi: state.unseenShare.navi.length,
  };
}

/**
 * 리스트 카드 강조.
 * 공유 미열람은 연한 초록("share"), 고객↔매물 매칭 미열람은 진한 초록("match").
 */
export function listCardHighlight(
  tab: AlertTab,
  id: string
): "share" | "match" | null {
  if (tab === "customers" && hasUnseenMatchForCustomer(id)) return "match";
  if (tab === "properties" && hasUnseenMatchForProperty(id)) return "match";
  if (isShareUnseen(tab, id)) return "share";
  return null;
}

/** 리스트 카드 테두리: 알람이 온 카드는 초록 박스 */
export function listCardFrameClass(
  done: boolean,
  highlight: "share" | "match" | null | undefined
): string {
  if (done) return "border border-gray-200 bg-gray-50";
  if (highlight === "share") {
    return "border-2 border-solid border-emerald-500 bg-emerald-50";
  }
  if (highlight === "match") {
    return "border-2 border-solid border-emerald-700 bg-emerald-100 animate-border-sparkle-match";
  }
  return "border border-gray-200 bg-white";
}

export function alertHighlightClass(
  highlight: "share" | "match" | null | undefined,
  done?: boolean
): string {
  if (done) {
    return "!border-2 !border-solid !bg-gray-200 !border-gray-300 !shadow-none text-gray-500";
  }
  if (highlight === "share") {
    return "!border-2 !border-solid !border-emerald-500 !bg-emerald-50 !shadow-none";
  }
  if (highlight === "match") {
    return "!border-2 !border-solid !border-emerald-700 !bg-emerald-100 animate-border-sparkle-match !shadow-none";
  }
  // 고객·매물·네비 idle 공통: 업무용 흰 면 + 진한 슬레이트 실선
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
