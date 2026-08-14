import type {
  BuildingBathroomCounts,
  BuildingKind,
  BuildingUnitCounts,
  BuildingRoomAreas,
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
  "원룸",
  "투룸",
  "3룸+",
  "아파트",
  "상가",
  "사무실",
  "토지",
  "건물",
];

export const BUILDING_KINDS: BuildingKind[] = [
  "단독주택(다중주택)",
  "상가주택",
  "근생건물",
];

/** 예전 저장값 '다가구' → '단독주택(다중주택)' */
export function normalizeBuildingKind(
  kind?: string | null
): BuildingKind | undefined {
  if (!kind) return undefined;
  if (kind === "다가구") return "단독주택(다중주택)";
  if (
    kind === "단독주택(다중주택)" ||
    kind === "상가주택" ||
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
};

export const EMPTY_BATHROOM_COUNTS: BuildingBathroomCounts = {
  원룸: 1,
  투룸: 1,
  "3룸+": 1,
};

export const ROOM_COUNT_OPTIONS = ["1", "2", "3", "4", "5"] as const;
export const ROOM_COUNT_OPTIONS_3PLUS = ["3", "4", "5"] as const;
export const BATHROOM_COUNT_OPTIONS = ["1", "2", "3", "4"] as const;

/** 투룸·3룸+·아파트 — 방/화장실 수 입력 */
export function needsRoomBathCounts(roomType?: string | null): boolean {
  return roomType === "투룸" || roomType === "3룸+" || roomType === "아파트";
}

/** 투룸은 방 2개 고정 */
export function isRoomCountFixed(roomType?: string | null): boolean {
  return roomType === "투룸";
}

/** 유형별 선택 가능한 방 수 (3룸+는 3개부터) */
export function roomCountOptionsForType(
  roomType?: string | null
): readonly string[] {
  if (roomType === "3룸+") return ROOM_COUNT_OPTIONS_3PLUS;
  return ROOM_COUNT_OPTIONS;
}

export function defaultRoomBathCounts(roomType: string): {
  roomCount: number;
  bathroomCount: number;
} {
  if (roomType === "투룸") return { roomCount: 2, bathroomCount: 1 };
  if (roomType === "3룸+") return { roomCount: 3, bathroomCount: 1 };
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
  };
}

export function normalizeBathroomCounts(
  raw?: Partial<BuildingBathroomCounts> & {
    쓰리룸?: number;
    "쓰리룸+"?: number;
  } | null
): BuildingBathroomCounts {
  if (!raw) return { ...EMPTY_BATHROOM_COUNTS };
  const three =
    Number(raw["3룸+"] ?? 0) ||
    Number(raw["쓰리룸+"] ?? 0) ||
    Number(raw.쓰리룸 ?? 0) ||
    1;
  return {
    원룸: Number(raw.원룸 ?? 1) || 1,
    투룸: Number(raw.투룸 ?? 1) || 1,
    "3룸+": three,
  };
}

export function normalizeRoomAreas(
  raw?: Partial<BuildingRoomAreas> & {
    쓰리룸?: number;
    "쓰리룸+"?: number;
  } | null
): BuildingRoomAreas {
  if (!raw) return {};
  const three = raw["3룸+"] ?? raw["쓰리룸+"] ?? raw.쓰리룸;
  return {
    원룸: raw.원룸,
    투룸: raw.투룸,
    ...(three != null ? { "3룸+": three } : {}),
  };
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

/** 상가·사무실 — 보증보험/옵션/관리비포함 불필요 */
export function skipsResidentialExtras(roomType?: string | null): boolean {
  return (
    roomType === "상가" || roomType === "사무실" || roomType === "오피스"
  );
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

export const INSURANCE_TYPES = ["유", "무"] as const;

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
    maintenanceFee: 0,
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
    unitCounts: { ...EMPTY_UNIT_COUNTS },
    bathroomCounts: { ...EMPTY_BATHROOM_COUNTS },
    roomAreas: {},
    commercialAreas: [],
    rentInputMode: "합계",
    typeRents: {},
    moveInFrom: "",
    moveInTo: "",
    moveInSingle: false,
    moveInDate: "",
    notes: "",
    partnerAgencyShared: false,
    workspaceShared: false,
  };
}
