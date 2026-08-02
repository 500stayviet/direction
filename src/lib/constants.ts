import type {
  BuildingBathroomCounts,
  BuildingKind,
  BuildingUnitCounts,
  DealType,
  Property,
  ResidentialUnitKey,
  RoomType,
} from "./types";
import { createId } from "./id";

export const DEAL_TYPES: DealType[] = ["매매", "전세", "월세"];

export const ROOM_TYPES: RoomType[] = [
  "원룸",
  "투룸",
  "쓰리룸",
  "쓰리룸+",
  "상가",
  "사무실",
  "토지",
  "건물",
];

export const BUILDING_KINDS: BuildingKind[] = [
  "다가구",
  "상가주택",
  "근생건물",
];

export const RESIDENTIAL_UNIT_KEYS: ResidentialUnitKey[] = [
  "원룸",
  "투룸",
  "쓰리룸",
  "쓰리룸+",
];

export const EMPTY_UNIT_COUNTS: BuildingUnitCounts = {
  원룸: 0,
  투룸: 0,
  쓰리룸: 0,
  "쓰리룸+": 0,
  상가: 0,
};

export const EMPTY_BATHROOM_COUNTS: BuildingBathroomCounts = {
  원룸: 1,
  투룸: 1,
  쓰리룸: 1,
  "쓰리룸+": 1,
};

/** 예전 저장값 '오피스' → '사무실' */
export function displayRoomType(
  roomType?: string | null,
  buildingKind?: string | null
): string {
  if (!roomType) return "-";
  if (roomType === "오피스") return "사무실";
  if (roomType === "건물" && buildingKind) return `건물 · ${buildingKind}`;
  return roomType;
}

export function isLandType(roomType?: string | null): boolean {
  return roomType === "토지";
}

export function isBuildingType(roomType?: string | null): boolean {
  return roomType === "건물";
}

/** 상가·사무실 — 애완/보증보험/옵션/관리비포함 불필요 */
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
    dealType: "월세",
    roomType: "원룸",
    deposit: 0,
    monthlyRent: undefined,
    maintenanceFee: 0,
    maintenanceIncludes: [],
    parkingType: "무",
    parkingFeeType: "별도",
    parkingFee: undefined,
    petAllowed: "무",
    elevator: false,
    options: [],
    usableArea: undefined,
    landArea: undefined,
    landUse: "",
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
    insuranceType: "무",
    notes: "",
  };
}
