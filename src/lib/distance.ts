import type { Property, RouteSummary } from "./types";

/** 동일 동 여부 기반 대략 거리 (API 키 없이 현장용 추정) */
function estimateLeg(from: Property, to: Property): {
  distanceKm: number;
  durationMin: number;
} {
  const sameDong =
    !!from.partnerAgency.dong &&
    from.partnerAgency.dong === to.partnerAgency.dong;

  const fromKey = `${from.address}|${from.roomNo}`;
  const toKey = `${to.address}|${to.roomNo}`;

  if (fromKey === toKey) {
    return { distanceKm: 0, durationMin: 0 };
  }

  // 주소 문자열 유사도로 약간의 변동 부여
  const shared = [...from.address].filter((ch) => to.address.includes(ch)).length;
  const similarity = shared / Math.max(from.address.length, to.address.length, 1);

  let distanceKm: number;
  if (sameDong) {
    distanceKm = Number((0.6 + (1 - similarity) * 1.4).toFixed(1));
  } else {
    distanceKm = Number((2.2 + (1 - similarity) * 3.5).toFixed(1));
  }

  // 시내 평균 약 22km/h + 신호대기 가산
  const durationMin = Math.max(3, Math.round((distanceKm / 22) * 60 + 3));
  return { distanceKm, durationMin };
}

export function buildRouteSummary(properties: Property[]): RouteSummary[] {
  const summary: RouteSummary[] = [];
  for (let i = 0; i < properties.length - 1; i += 1) {
    const leg = estimateLeg(properties[i], properties[i + 1]);
    summary.push({
      fromIndex: i,
      toIndex: i + 1,
      distanceKm: leg.distanceKm,
      durationMin: leg.durationMin,
    });
  }
  return summary;
}

/** 현재 순서가 비효율적일 때(더 가까운 매물이 뒤에 있을 때) 알림용 */
export function findSmarterRouteHint(
  properties: Property[],
  routeSummary: RouteSummary[]
): string | null {
  if (properties.length < 3 || routeSummary.length < 2) return null;

  const firstToSecond = routeSummary[0];
  const firstToThird = estimateLeg(properties[0], properties[2]);

  if (firstToThird.distanceKm + 0.3 < firstToSecond.distanceKm) {
    return `3번 매물이 2번보다 더 가까울 수 있어요 (약 ${firstToThird.distanceKm}km / ${firstToThird.durationMin}분). 순서는 직접 선택하세요.`;
  }
  return null;
}
