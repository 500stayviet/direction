import {
  parseMatchPairKey,
} from "@/lib/alertMessaging";
import {
  pairAlertSinceKey,
  type AlertState,
} from "@/lib/teamAlerts";

/** teamAlerts 상태 스냅샷 기준 집계 (클라이언트) */

/** 상단 플로팅 배너 자동 숨김 — 미확인 알람·뱃지는 유지 */
export const ALERT_BANNER_AUTO_HIDE_MS = 5_000;

/** 홈·리스트 진입 시 미확인 알람이 있으면 배너 재표시 */
export const ALERT_BANNER_REMINDER_PATHS = new Set([
  "/",
  "/customers",
  "/properties",
  "/navi",
]);

export function totalUnseenFromState(state: AlertState): number {
  return (
    state.unseenShare.customers.length +
    state.unseenShare.properties.length +
    state.unseenShare.navi.length +
    state.unseenMatchCustomer.length +
    state.unseenMatchProperty.length +
    state.unseenNewMatchCustomer.length +
    state.unseenNewMatchProperty.length
  );
}

export function unseenMatchSummaryFromState(state: AlertState): {
  matchOwn: number;
  matchPartner: number;
  share: number;
} {
  const own = new Set([
    ...state.unseenMatchCustomer,
    ...state.unseenMatchProperty,
  ]);
  const partner = new Set([
    ...state.unseenNewMatchCustomer,
    ...state.unseenNewMatchProperty,
  ]);
  return {
    matchOwn: own.size,
    matchPartner: partner.size,
    share:
      state.unseenShare.customers.length +
      state.unseenShare.properties.length +
      state.unseenShare.navi.length,
  };
}

export function collectUnseenMatchPairKeys(state: AlertState): {
  own: Set<string>;
  partner: Set<string>;
} {
  return {
    own: new Set([
      ...state.unseenMatchCustomer,
      ...state.unseenMatchProperty,
    ]),
    partner: new Set([
      ...state.unseenNewMatchCustomer,
      ...state.unseenNewMatchProperty,
    ]),
  };
}

function sinceOrLast(state: AlertState, key: string): number {
  return state.alertSince[key] ?? Number.MAX_SAFE_INTEGER;
}

function addMatchPairCandidates(
  byHref: Map<string, number>,
  state: AlertState,
  pairKeys: string[],
  kind: "match" | "newMatch",
  hrefFor: (parsed: { customerId: string; propertyId: string }) => string
) {
  for (const pairKey of pairKeys) {
    const parsed = parseMatchPairKey(pairKey);
    if (!parsed) continue;
    const at = sinceOrLast(state, pairAlertSinceKey(kind, pairKey));
    const href = hrefFor(parsed);
    const prev = byHref.get(href);
    if (prev === undefined || at < prev) byHref.set(href, at);
  }
}

/**
 * 알람 배ner·푸시 딥링크 — 해제(mark*Seen)는 하지 않음.
 * - **먼저 온 알람**(alertSince 오름차순) 한 건
 * - 매칭: 상세 + scrollMatch → 반짝이는 매칭 카드로 스크롤 (카드 탭·미리보기 진입 시 해제)
 * - 팀공유: 리스트 + scrollShare → 해당 카드 탭(상세 진입) 시 해제
 */
export function pickAlertBannerHref(state: AlertState): string {
  const byHref = new Map<string, number>();

  addMatchPairCandidates(
    byHref,
    state,
    state.unseenMatchCustomer,
    "match",
    (p) => `/customers/${p.customerId}?scrollMatch=1`
  );
  addMatchPairCandidates(
    byHref,
    state,
    state.unseenMatchProperty,
    "match",
    (p) => `/properties/${p.propertyId}?scrollMatch=1`
  );
  addMatchPairCandidates(
    byHref,
    state,
    state.unseenNewMatchCustomer,
    "newMatch",
    (p) => `/customers/${p.customerId}?scrollMatch=1`
  );
  addMatchPairCandidates(
    byHref,
    state,
    state.unseenNewMatchProperty,
    "newMatch",
    (p) => `/properties/${p.propertyId}?scrollMatch=1`
  );

  for (const id of state.unseenShare.customers) {
    const href = `/customers?scrollShare=${id}`;
    const at = sinceOrLast(state, `share:customers:${id}`);
    const prev = byHref.get(href);
    if (prev === undefined || at < prev) byHref.set(href, at);
  }
  for (const id of state.unseenShare.properties) {
    const href = `/properties?scrollShare=${id}`;
    const at = sinceOrLast(state, `share:properties:${id}`);
    const prev = byHref.get(href);
    if (prev === undefined || at < prev) byHref.set(href, at);
  }
  for (const id of state.unseenShare.navi) {
    const href = `/navi?scrollShare=${id}`;
    const at = sinceOrLast(state, `share:navi:${id}`);
    const prev = byHref.get(href);
    if (prev === undefined || at < prev) byHref.set(href, at);
  }

  let bestHref = "/customers";
  let bestAt = Number.MAX_SAFE_INTEGER;
  for (const [href, at] of byHref) {
    if (at < bestAt) {
      bestAt = at;
      bestHref = href;
    }
  }
  return bestHref;
}
