import type { AlertState } from "@/lib/teamAlerts";

/** teamAlerts 상태 스냅샷 기준 집계 (클라이언트) */

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

export function pickAlertBannerHref(state: AlertState): string {
  const customers =
    state.unseenMatchCustomer.length +
    state.unseenNewMatchCustomer.length +
    state.unseenShare.customers.length;
  const properties =
    state.unseenMatchProperty.length +
    state.unseenNewMatchProperty.length +
    state.unseenShare.properties.length;
  if (properties > customers) return "/properties";
  if (customers > 0) return "/customers";
  if (state.unseenShare.navi.length > 0) return "/navi";
  return "/customers";
}
