/** 지적법 표준 지목 (모달 선택용) */
export const LAND_CATEGORIES = [
  "대",
  "전",
  "답",
  "과수원",
  "목장용지",
  "임야",
  "광천지",
  "염전",
  "공장용지",
  "학교용지",
  "주차장",
  "주유소용지",
  "창고용지",
  "도로",
  "철도용지",
  "제방",
  "하천",
  "구거",
  "유지",
  "양어장",
  "수도용지",
  "공원",
  "체육용지",
  "유원지",
  "종교용지",
  "사적지",
  "묘지",
  "잡종지",
] as const;

export type LandCategory = (typeof LAND_CATEGORIES)[number];

const RESIDENTIAL_ZONES = [
  "제1종전용주거",
  "제2종전용주거",
  "제1종일반주거",
  "제2종일반주거",
  "제3종일반주거",
  "준주거",
] as const;

const COMMERCIAL_ZONES = [
  "중심상업",
  "일반상업",
  "근린상업",
  "유통상업",
] as const;

const INDUSTRIAL_ZONES = ["전용공업", "일반공업", "준공업"] as const;

const GREEN_ZONES = ["보전녹지", "생산녹지", "자연녹지"] as const;

const MANAGE_ZONES = ["보전관리", "생산관리", "계획관리"] as const;

function uniqueZones(...groups: readonly (readonly string[])[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const group of groups) {
    for (const zone of group) {
      if (seen.has(zone)) continue;
      seen.add(zone);
      out.push(zone);
    }
  }
  return out;
}

const LOT_ZONES = uniqueZones(
  RESIDENTIAL_ZONES,
  ["근린상업"],
  ["자연녹지"],
  ["계획관리"]
);

const MIXED_ZONES = uniqueZones(
  RESIDENTIAL_ZONES.slice(2),
  COMMERCIAL_ZONES,
  INDUSTRIAL_ZONES,
  GREEN_ZONES,
  MANAGE_ZONES
);

const FACTORY_ZONES = uniqueZones(INDUSTRIAL_ZONES, ["계획관리"]);

const WAREHOUSE_ZONES = uniqueZones(
  INDUSTRIAL_ZONES,
  ["유통상업", "일반상업", "계획관리"]
);

const GAS_ZONES = ["근린상업", "일반상업", "준주거", "준공업", "계획관리"];

const PARKING_ZONES = uniqueZones(
  COMMERCIAL_ZONES,
  ["준주거", "준공업", "계획관리"]
);

const SCHOOL_ZONES = uniqueZones(RESIDENTIAL_ZONES, ["자연녹지", "계획관리"]);

const RELIGION_ZONES = uniqueZones(
  RESIDENTIAL_ZONES,
  ["근린상업", "자연녹지", "계획관리"]
);

const RECREATION_ZONES = [
  "근린상업",
  "자연녹지",
  "생산녹지",
  "계획관리",
];

/** 건축·개발 성격 지목만 용도지역을 고른다 */
const ZONES_BY_CATEGORY: Partial<Record<LandCategory, readonly string[]>> = {
  대: LOT_ZONES,
  잡종지: MIXED_ZONES,
  공장용지: FACTORY_ZONES,
  창고용지: WAREHOUSE_ZONES,
  주유소용지: GAS_ZONES,
  주차장: PARKING_ZONES,
  학교용지: SCHOOL_ZONES,
  종교용지: RELIGION_ZONES,
  체육용지: RECREATION_ZONES,
  유원지: RECREATION_ZONES,
};

export function landUseZonesForCategory(category?: string | null): string[] {
  if (!category) return [];
  return [...(ZONES_BY_CATEGORY[category as LandCategory] ?? [])];
}

export function needsLandUseZone(category?: string | null): boolean {
  return landUseZonesForCategory(category).length > 0;
}

export function pruneLandUseForCategory(
  category?: string | null,
  landUse?: string | null
): string {
  const use = (landUse ?? "").trim();
  if (!use) return "";
  const zones = landUseZonesForCategory(category);
  return zones.includes(use) ? use : "";
}
