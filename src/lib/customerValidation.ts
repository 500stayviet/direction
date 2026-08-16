import { onlyDigits } from "@/lib/format";
import { needsRoomBathCounts } from "@/lib/constants";
import type { BuildingKind, DealType, RoomType } from "@/lib/types";

export type CustomerFieldKey =
  | "name"
  | "phone"
  | "buildingKind"
  | "roomCount"
  | "roomType"
  | "dealType"
  | "deposit"
  | "depositTo"
  | "monthlyRent"
  | "monthlyRentTo"
  | "moveIn"
  | "loan"
  | "insurance"
  | "parking"
  | "teamShare"
  | "preferredLocation";

export type CustomerValidationInput = {
  name: string;
  phone: string;
  roomType?: RoomType | "";
  buildingKind: BuildingKind | "";
  roomCount: number;
  dealType: DealType | "";
  deposit: number;
  depositTo: number;
  depositSingle: boolean;
  monthlyRent: number;
  monthlyRentTo: number;
  monthlyRentSingle: boolean;
  nonOccupancy: boolean;
  moveInFrom: string;
  moveInTo: string;
  moveInSingle: boolean;
  parkingType?: "유" | "무" | "";
  loanNeeded?: "유" | "무" | "";
  insuranceNeeded?: "유" | "무" | "";
  workspaceShared?: boolean;
  /** true면 팀공유를 필수 칸으로 봄. 등록 페이지는 버튼이라 기본은 필수 아님 */
  requireTeamShare?: boolean;
  preferredGus?: string[];
  preferredDongs?: string[];
};

function requiredInputMessage(label: string): string {
  return `${label} 칸 입력은 필수입니다.`;
}

const MESSAGES: Record<CustomerFieldKey, (dealType: DealType) => string> = {
  name: () => requiredInputMessage("고객명 또는 명칭"),
  phone: () => requiredInputMessage("고객 전화번호"),
  buildingKind: () => requiredInputMessage("건물 종류"),
  roomCount: () => requiredInputMessage("방 수"),
  roomType: () => requiredInputMessage("매물 유형"),
  dealType: () => requiredInputMessage("거래종류"),
  deposit: (dealType) =>
    requiredInputMessage(dealType === "매매" ? "매매가" : "보증금"),
  depositTo: (dealType) =>
    requiredInputMessage(dealType === "매매" ? "매매가 까지" : "보증금 까지"),
  monthlyRent: () => requiredInputMessage("월세"),
  monthlyRentTo: () => requiredInputMessage("월세 까지"),
  moveIn: () => requiredInputMessage("입주희망일"),
  loan: () => requiredInputMessage("대출"),
  insurance: () => requiredInputMessage("전세보증보험 가입 가능 여부"),
  parking: () => requiredInputMessage("주차"),
  teamShare: () => requiredInputMessage("팀공유 유무"),
  preferredLocation: () => requiredInputMessage("선호지역"),
};

/** 화면 위→아래 순서. 모달·스크롤은 이 배열의 첫 빠진 칸 */
export const CUSTOMER_FIELD_ORDER: CustomerFieldKey[] = [
  "name",
  "phone",
  "roomType",
  "buildingKind",
  "roomCount",
  "dealType",
  "preferredLocation",
  "deposit",
  "depositTo",
  "monthlyRent",
  "monthlyRentTo",
  "moveIn",
  "loan",
  "insurance",
  "parking",
  "teamShare",
];

export function getMissingCustomerFields(
  input: CustomerValidationInput
): CustomerFieldKey[] {
  const missing: CustomerFieldKey[] = [];
  if (!input.name.trim()) missing.push("name");
  if (onlyDigits(input.phone).length < 7) missing.push("phone");
  if (!input.roomType) missing.push("roomType");
  if (input.roomType === "건물" && !input.buildingKind) {
    missing.push("buildingKind");
  }
  if (needsRoomBathCounts(input.roomType)) {
    const rooms = input.roomType === "투룸" ? 2 : input.roomCount;
    const min = input.roomType === "3룸+" ? 3 : 1;
    if (!rooms || rooms < min) missing.push("roomCount");
  }
  if (!input.deposit || input.deposit <= 0) missing.push("deposit");
  if (!input.depositSingle) {
    if (!input.depositTo || input.depositTo <= 0) missing.push("depositTo");
    else if (input.depositTo < input.deposit) missing.push("depositTo");
  }
  if (input.dealType === "월세") {
    if (!input.monthlyRent || input.monthlyRent <= 0) {
      missing.push("monthlyRent");
    }
    if (!input.monthlyRentSingle) {
      if (!input.monthlyRentTo || input.monthlyRentTo <= 0) {
        missing.push("monthlyRentTo");
      } else if (input.monthlyRentTo < input.monthlyRent) {
        missing.push("monthlyRentTo");
      }
    }
  }
  const isNonOccupancy = input.dealType === "매매" && input.nonOccupancy;
  if (!isNonOccupancy) {
    if (!input.moveInFrom || (!input.moveInSingle && !input.moveInTo)) {
      missing.push("moveIn");
    } else if (!input.moveInSingle && input.moveInTo < input.moveInFrom) {
      missing.push("moveIn");
    }
  }
  const isLand = input.roomType === "토지";
  const isBuilding = input.roomType === "건물";
  if (!isLand && !isBuilding && !input.dealType) {
    missing.push("dealType");
  }
  const skipLoanInsurance =
    input.roomType === "상가" ||
    input.roomType === "사무실" ||
    isLand ||
    isBuilding;
  if (!skipLoanInsurance) {
    if (input.loanNeeded !== "유" && input.loanNeeded !== "무") {
      missing.push("loan");
    }
    if (input.insuranceNeeded !== "유" && input.insuranceNeeded !== "무") {
      missing.push("insurance");
    }
  }
  if (!isLand && !isBuilding) {
    if (input.parkingType !== "유" && input.parkingType !== "무") {
      missing.push("parking");
    }
  }
  if (
    input.requireTeamShare === true &&
    input.workspaceShared !== true &&
    input.workspaceShared !== false
  ) {
    missing.push("teamShare");
  }
  const dongs = input.preferredDongs ?? [];
  if (dongs.length === 0) {
    missing.push("preferredLocation");
  }
  return CUSTOMER_FIELD_ORDER.filter((key) => missing.includes(key));
}

export function getCustomerFieldMessage(
  field: CustomerFieldKey,
  dealType: DealType | ""
): string {
  return MESSAGES[field](dealType || "전세");
}
