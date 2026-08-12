import { onlyDigits } from "@/lib/format";
import { needsRoomBathCounts } from "@/lib/constants";
import type { BuildingKind, DealType, RoomType } from "@/lib/types";

export type CustomerFieldKey =
  | "name"
  | "phone"
  | "buildingKind"
  | "roomCount"
  | "deposit"
  | "depositTo"
  | "monthlyRent"
  | "monthlyRentTo"
  | "moveIn"
  | "carType";

export type CustomerValidationInput = {
  name: string;
  phone: string;
  roomType: RoomType;
  buildingKind: BuildingKind | "";
  roomCount: number;
  dealType: DealType;
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
  parkingType: "유" | "무";
  carType: string;
};

const MESSAGES: Record<CustomerFieldKey, (dealType: DealType) => string> = {
  name: () => "고객명 또는 명칭을 입력해 주세요.",
  phone: () => "전화번호를 입력해 주세요.",
  buildingKind: () => "건물 종류를 선택해 주세요.",
  roomCount: () => "방 수를 선택해 주세요.",
  deposit: (dealType) =>
    dealType === "매매" ? "매가를 입력해 주세요." : "보증금을 입력해 주세요.",
  depositTo: (dealType) =>
    dealType === "매매"
      ? "매가 종료 금액을 입력해 주세요."
      : "보증금 종료 금액을 입력해 주세요.",
  monthlyRent: () => "월세를 입력해 주세요.",
  monthlyRentTo: () => "월세 종료 금액을 입력해 주세요.",
  moveIn: () => "희망 입주일을 선택해 주세요.",
  carType: () => "차종을 선택해 주세요.",
};

export function getMissingCustomerFields(
  input: CustomerValidationInput
): CustomerFieldKey[] {
  const missing: CustomerFieldKey[] = [];
  if (!input.name.trim()) missing.push("name");
  if (onlyDigits(input.phone).length < 9) missing.push("phone");
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
  if (
    input.roomType !== "토지" &&
    input.roomType !== "건물" &&
    input.parkingType === "유" &&
    input.carType !== "세단" &&
    input.carType !== "SUV"
  ) {
    missing.push("carType");
  }
  return missing;
}

export function getCustomerFieldMessage(
  field: CustomerFieldKey,
  dealType: DealType
): string {
  return MESSAGES[field](dealType);
}
