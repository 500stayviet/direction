import type {
  BuildingKind,
  BuildingUnitKey,
  BuildingUnitCounts,
  DealType,
  Property,
  ResidentialUnitKey,
  RoomType,
} from "./types";
import { createId } from "./id";

export const DEAL_TYPES: DealType[] = ["매매", "전세", "월세"];

/** 방문 일정에 넣을 수 있는 매물 최대 개수 */
export const MAX_SCHEDULE_PROPERTIES = 6;

export const ROOM_TYPES: RoomType[] = [
  "아파트",
  "원룸",
  "투룸",
  "3룸+",
  "오피스텔",
  "상가",
  "사무실",
  "토지",
  "건물",
];

export const BUILDING_KINDS: BuildingKind[] = [
  "단독주택(다중주택)",
  "상가주택(다가구)",
  "다세대주택",
  "근생건물",
];

/** 예전 저장값 맞춤 */
export function normalizeBuildingKind(
  kind?: string | null
): BuildingKind | undefined {
  if (!kind) return undefined;
  if (kind === "다가구") return "단독주택(다중주택)";
  if (kind === "상가주택") return "상가주택(다가구)";
  if (
    kind === "단독주택(다중주택)" ||
    kind === "상가주택(다가구)" ||
    kind === "다세대주택" ||
    kind === "근생건물"
  ) {
    return kind;
  }
  return undefined;
}

export const RESIDENTIAL_UNIT_KEYS: ResidentialUnitKey[] = [
  "원룸",
  "투룸",
  "3룸+",
];

export const EMPTY_UNIT_COUNTS: BuildingUnitCounts = {
  원룸: 0,
  투룸: 0,
  "3룸+": 0,
  상가: 0,
  사무실: 0,
};

export const ROOM_COUNT_OPTIONS = ["1", "2", "3", "4", "5", "6"] as const;
export const ROOM_COUNT_OPTIONS_3PLUS = [
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
] as const;
export const BATHROOM_COUNT_OPTIONS = ["1", "2", "3", "4", "5", "6"] as const;
export const BATHROOM_COUNT_OPTIONS_3PLUS = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
] as const;

/** 투룸·3룸+·오피스텔·아파트 — 방/화장실 수 입력 */
export function needsRoomBathCounts(roomType?: string | null): boolean {
  return (
    roomType === "투룸" ||
    roomType === "3룸+" ||
    roomType === "오피스텔" ||
    roomType === "아파트"
  );
}

/** 투룸은 방 2개 고정 */
export function isRoomCountFixed(roomType?: string | null): boolean {
  return roomType === "투룸";
}

/** 유형별 선택 가능한 방 수 (투룸 2 고정 · 3룸+는 3~8 · 오피스텔·아파트 1~6) */
export function roomCountOptionsForType(
  roomType?: string | null
): readonly string[] {
  if (roomType === "투룸") return ["2"];
  if (roomType === "3룸+") return ROOM_COUNT_OPTIONS_3PLUS;
  return ROOM_COUNT_OPTIONS;
}

/** 유형별 선택 가능한 화장실 수 (3룸+는 8개까지 · 그 외 6개까지) */
export function bathroomCountOptionsForType(
  roomType?: string | null
): readonly string[] {
  if (roomType === "3룸+") return BATHROOM_COUNT_OPTIONS_3PLUS;
  return BATHROOM_COUNT_OPTIONS;
}

export function defaultRoomBathCounts(roomType: string): {
  roomCount: number;
  bathroomCount: number;
} {
  if (roomType === "투룸") return { roomCount: 2, bathroomCount: 1 };
  if (roomType === "3룸+") return { roomCount: 3, bathroomCount: 1 };
  if (roomType === "오피스텔") return { roomCount: 1, bathroomCount: 1 };
  if (roomType === "아파트") return { roomCount: 2, bathroomCount: 1 };
  return { roomCount: 1, bathroomCount: 1 };
}

/** 예전 쓰리룸·쓰리룸+ → 3룸+ */
export function normalizeRoomType(
  roomType?: string | null
): RoomType | undefined {
  if (!roomType) return undefined;
  if (roomType === "오피스") return "사무실";
  if (roomType === "쓰리룸" || roomType === "쓰리룸+") return "3룸+";
  if (ROOM_TYPES.includes(roomType as RoomType)) return roomType as RoomType;
  return undefined;
}

export function normalizeUnitCounts(
  raw?: Partial<BuildingUnitCounts> & {
    쓰리룸?: number;
    "쓰리룸+"?: number;
  } | null
): BuildingUnitCounts {
  if (!raw) return { ...EMPTY_UNIT_COUNTS };
  const three =
    Number(raw["3룸+"] ?? 0) +
    Number(raw.쓰리룸 ?? 0) +
    Number(raw["쓰리룸+"] ?? 0);
  return {
    원룸: Number(raw.원룸 ?? 0) || 0,
    투룸: Number(raw.투룸 ?? 0) || 0,
    "3룸+": three || 0,
    상가: Number(raw.상가 ?? 0) || 0,
    사무실: Number(raw.사무실 ?? 0) || 0,
  };
}

/** 건물 종류에 따른 방·상가(사무실) 수 칸 */
export function unitKeysForBuildingKind(
  kind?: string | null
): BuildingUnitKey[] {
  if (kind === "근생건물") return ["상가", "사무실"];
  if (kind === "다세대주택") return [...RESIDENTIAL_UNIT_KEYS];
  return [...RESIDENTIAL_UNIT_KEYS, "상가"];
}

export function pruneUnitCountsForKind(
  raw: Partial<BuildingUnitCounts> | null | undefined,
  kind?: string | null
): BuildingUnitCounts {
  const all = normalizeUnitCounts(raw);
  const keep = new Set(unitKeysForBuildingKind(kind));
  return {
    원룸: keep.has("원룸") ? all.원룸 : 0,
    투룸: keep.has("투룸") ? all.투룸 : 0,
    "3룸+": keep.has("3룸+") ? all["3룸+"] : 0,
    상가: keep.has("상가") ? all.상가 : 0,
    사무실: keep.has("사무실") ? all.사무실 : 0,
  };
}

export function formatUnitCountsLine(
  raw: Partial<BuildingUnitCounts> | null | undefined,
  kind?: string | null
): string {
  const counts = normalizeUnitCounts(raw);
  return unitKeysForBuildingKind(kind)
    .filter((key) => counts[key] > 0)
    .map((key) => `${key} ${counts[key]}`)
    .join(" · ");
}

/** 예전 저장값 '오피스' → '사무실', 쓰리룸 → 3룸+ */
export function displayRoomType(
  roomType?: string | null,
  buildingKind?: string | null
): string {
  if (!roomType) return "-";
  const normalized = normalizeRoomType(roomType) ?? roomType;
  if (normalized === "건물" && buildingKind) {
    const kind = normalizeBuildingKind(buildingKind) ?? buildingKind;
    return `건물 · ${kind}`;
  }
  return normalized;
}

export function isLandType(roomType?: string | null): boolean {
  return roomType === "토지";
}

export function isBuildingType(roomType?: string | null): boolean {
  return roomType === "건물";
}

/** 토지·건물은 다른 매물. 유형을 바꾸면 그쪽 전용 값은 따라가지 않는다 */
export function listingFieldsForRoomTypeChange(
  previous: RoomType | string | undefined | null,
  next: RoomType
): Partial<Property> {
  const patch: Partial<Property> = {};
  if (isLandType(previous) && !isLandType(next)) {
    patch.landArea = undefined;
    patch.landCategory = "";
    patch.landUse = "";
  }
  if (isBuildingType(previous) && !isBuildingType(next)) {
    patch.landArea = undefined;
    patch.buildingArea = undefined;
    patch.floorsBasement = undefined;
    patch.floorsAbove = undefined;
    patch.parkingSpaces = undefined;
    patch.parkingSpacesAbove = undefined;
    patch.parkingSpacesBasement = undefined;
    patch.unitCounts = undefined;
  }
  return patch;
}

/** 전세·월세는 토지·건물 유형이 없다 */
export function roomTypesForDeal(
  dealType?: DealType | "" | null
): RoomType[] {
  if (dealType === "전세" || dealType === "월세") {
    return ROOM_TYPES.filter((type) => !isLandType(type) && !isBuildingType(type));
  }
  return [...ROOM_TYPES];
}

/** 상가·사무실 — 보증보험/옵션/관리비포함 불필요 */
export function skipsResidentialExtras(roomType?: string | null): boolean {
  return (
    roomType === "상가" || roomType === "사무실" || roomType === "오피스"
  );
}

/** 매매 시 주차 선택 생략 — 단지·다세대·토지 등 기본 주차 있음 (매물만) */
export function propertySkipsParkingSelection(
  roomType?: string | null,
  dealType?: string | null,
  kind: "property" | "customer" = "property"
): boolean {
  if (kind !== "property" || dealType !== "매매") return false;
  if (isLandType(roomType)) return true;
  return (
    roomType === "아파트" ||
    roomType === "오피스텔" ||
    roomType === "원룸" ||
    roomType === "투룸" ||
    roomType === "3룸+"
  );
}

/** 아파트·오피스텔 — 엘리베이터 선택 생략 (있음으로 간주) */
export function propertySkipsElevatorSelection(
  roomType?: string | null
): boolean {
  return roomType === "아파트" || roomType === "오피스텔";
}

export function applyPropertyListingDefaults<
  T extends {
    roomType?: string | null;
    dealType?: string | null;
    parkingType?: string;
    elevator?: boolean;
  },
>(property: T): T {
  const next = { ...property };
  if (propertySkipsParkingSelection(next.roomType, next.dealType)) {
    next.parkingType = "유";
  }
  if (propertySkipsElevatorSelection(next.roomType)) {
    next.elevator = true;
  }
  return next;
}

/** 마이크·등록 폼 매물유형 예시 */
export const PROPERTY_ROOM_TYPE_EXAMPLE =
  "아파트 · 오피스텔 · 원룸 · 토지 · 건물 등";

/** 관리비는 전세·월세 매물만. 매매·토지·건물은 없음 */
export function needsMaintenanceFee(
  dealType?: string | null,
  roomType?: string | null
): boolean {
  if (isLandType(roomType) || isBuildingType(roomType)) return false;
  return dealType === "전세" || dealType === "월세";
}

/** 단일 호실·상가 유형 (실사용면적 1칸) */
export function isUnitRoomType(roomType?: string | null): boolean {
  return Boolean(roomType) && !isLandType(roomType) && !isBuildingType(roomType);
}

export const LOAN_TYPES = [
  "해당없음",
  "LH",
  "SH",
  "중기청",
  "버팀목",
  "디딤돌",
  "기타",
];

/** 전세·월세 고객 — 전세자금 등 (디딤돌 제외) */
export const LOAN_KIND_OPTIONS_JEONSE = [
  "LH",
  "SH",
  "중기청",
  "버팀목",
  "기타",
] as const;

/** 매매 고객 — 디딤돌·기타 */
export const LOAN_KIND_OPTIONS_SALE = ["디딤돌", "기타"] as const;

/** @deprecated 거래유형별 loanKindOptionsForDeal 사용 */
export const LOAN_KIND_OPTIONS = LOAN_TYPES.filter((t) => t !== "해당없음");

/** 대출 유일 때 선택지 (거래유형별) */
export function loanKindOptionsForDeal(dealType?: DealType | string | null): string[] {
  if (dealType === "매매") return [...LOAN_KIND_OPTIONS_SALE];
  return [...LOAN_KIND_OPTIONS_JEONSE];
}

export const MAINTENANCE_OPTIONS = [
  "인터넷",
  "TV",
  "수도",
  "가스",
  "전기",
  "청소",
  "주차",
];

export const PROPERTY_OPTIONS = [
  "에어컨",
  "냉장고",
  "세탁기",
  "인덕션",
  "가스레인지",
];

export const DONG_SUGGESTIONS = [
  "성내동",
  "천호동",
  "길동",
  "둔촌동",
  "암사동",
  "고덕동",
  "상일동",
  "명일동",
  "강일동",
  "잠실동",
  "석촌동",
  "송파동",
  "방이동",
  "문정동",
  "장지동",
];

export function createEmptyProperty(): Property {
  return {
    id: createId("prop"),
    address: "",
    roomNo: "",
    buildingName: "",
    floorPassword: "",
    roomPassword: "",
    arriveTime: "",
    tenantPhone: "",
    landlordPhone: "",
    hasPartnerAgency: false,
    partnerAgency: {
      name: "",
      phone: "",
      dong: "",
    },
    dealType: undefined,
    roomType: undefined,
    roomCount: undefined,
    bathroomCount: undefined,
    deposit: 0,
    monthlyRent: undefined,
    maintenanceFee: undefined,
    maintenanceIncludes: [],
    parkingType: undefined,
    parkingFeeType: "별도",
    parkingFee: undefined,
    loanAvailable: undefined,
    insuranceType: undefined,
    petAllowed: "무",
    elevator: undefined,
    options: [],
    usableArea: undefined,
    landArea: undefined,
    landUse: "",
    landCategory: "",
    buildingKind: undefined,
    floorsBasement: undefined,
    floorsAbove: undefined,
    buildingArea: undefined,
    parkingSpaces: undefined,
    parkingSpacesAbove: undefined,
    parkingSpacesBasement: undefined,
    unitCounts: { ...EMPTY_UNIT_COUNTS },
    moveInFrom: "",
    moveInTo: "",
    moveInSingle: false,
    moveInVacant: false,
    moveInNegotiable: false,
    moveInDate: "",
    notes: "",
    partnerAgencyShared: false,
    workspaceShared: false,
  };
}
