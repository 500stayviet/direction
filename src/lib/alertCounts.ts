import {
  parseMatchPairKey,
} from "@/lib/alertMessaging";
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

/**
 * 알람 배ner·푸시 딥링크 — 해제(mark*Seen)는 하지 않음.
 * - 매칭: 상세 + scrollMatch → 반짝이는 매칭 카드로 스크롤 (카드 탭·미리보기 진입 시 해제)
 * - 팀공유: 리스트 + scrollShare → 해당 카드 탭(상세 진입) 시 해제
 */
export function pickAlertBannerHref(state: AlertState): string {
  const firstOwnMatch = state.unseenMatchCustomer[0];
  if (firstOwnMatch) {
    const parsed = parseMatchPairKey(firstOwnMatch);
    if (parsed) {
      return `/customers/${parsed.customerId}?scrollMatch=1`;
    }
  }
  const firstOwnMatchProperty = state.unseenMatchProperty[0];
  if (firstOwnMatchProperty) {
    const parsed = parseMatchPairKey(firstOwnMatchProperty);
    if (parsed) {
      return `/properties/${parsed.propertyId}?scrollMatch=1`;
    }
  }
  const firstSiteMatch = state.unseenNewMatchCustomer[0];
  if (firstSiteMatch) {
    const parsed = parseMatchPairKey(firstSiteMatch);
    if (parsed) {
      return `/customers/${parsed.customerId}?scrollMatch=1`;
    }
  }
  const firstSiteMatchProperty = state.unseenNewMatchProperty[0];
  if (firstSiteMatchProperty) {
    const parsed = parseMatchPairKey(firstSiteMatchProperty);
    if (parsed) {
      return `/properties/${parsed.propertyId}?scrollMatch=1`;
    }
  }
  if (state.unseenShare.customers[0]) {
    return `/customers?scrollShare=${state.unseenShare.customers[0]}`;
  }
  if (state.unseenShare.properties[0]) {
    return `/properties?scrollShare=${state.unseenShare.properties[0]}`;
  }
  if (state.unseenShare.navi[0]) {
    return `/navi?scrollShare=${state.unseenShare.navi[0]}`;
  }
  return "/customers";
}
