import { needsJeonseInsurance, onlyDigits } from "@/lib/format";
import { parseJibunDetail, parseSeoulAddress } from "@/lib/seoulRegions";
import {
  isBuildingType,
  isLandType,
  needsRoomBathCounts,
  propertySkipsElevatorSelection,
  propertySkipsParkingSelection,
  skipsResidentialExtras,
} from "@/lib/constants";
import type { Property } from "@/lib/types";

export type PropertyFieldKey =
  | "contacts"
  | "partnerName"
  | "partnerDong"
  | "partnerPhone"
  | "address"
  | "roomType"
  | "roomCount"
  | "buildingKind"
  | "dealType"
  | "deposit"
  | "moveIn"
  | "loan"
  | "insurance"
  | "parking"
  | "elevator";

export interface ValidationOptions {
  /** false면 주소·협력부동산 동 필수 제외. 기본 true */
  requireDong?: boolean;
}

export interface PropertyValidationIssue {
  index: number;
  fields: PropertyFieldKey[];
  focusField: PropertyFieldKey;
  message: string;
}

function hasUsableContact(property: Property): boolean {
  const tenant = onlyDigits(property.tenantPhone ?? "");
  const landlord = onlyDigits(property.landlordPhone ?? "");
  const partner = property.hasPartnerAgency
    ? onlyDigits(property.partnerAgency?.phone ?? "")
    : "";
  return Boolean(tenant || landlord || partner);
}

function requiredInputMessage(label: string): string {
  return `${label} 칸 입력은 필수입니다.`;
}

const FIELD_MESSAGES: Record<PropertyFieldKey, (p: Property) => string> = {
  contacts: () => requiredInputMessage("연락처"),
  partnerName: () => requiredInputMessage("상호명"),
  partnerDong: () => requiredInputMessage("동"),
  partnerPhone: () => requiredInputMessage("연락처"),
  address: () => requiredInputMessage("매물 주소"),
  roomType: () => requiredInputMessage("매물 유형"),
  roomCount: () => requiredInputMessage("방 수"),
  buildingKind: () => requiredInputMessage("건물 종류"),
  dealType: () => requiredInputMessage("거래종류"),
  deposit: (p) =>
    requiredInputMessage(
      p.dealType === "매매" ? "매매가" : "보증금"
    ),
  moveIn: () => requiredInputMessage("임대희망일"),
  loan: () => requiredInputMessage("대출"),
  insurance: () => requiredInputMessage("전세보증보험 가입 가능 여부"),
  parking: () => requiredInputMessage("주차"),
  elevator: () => requiredInputMessage("엘리베이터"),
};

/** 화면 위→아래 순서. 모달·스크롤은 이 배열의 첫 빠진 칸 */
export const PROPERTY_FIELD_ORDER: PropertyFieldKey[] = [
  "partnerName",
  "partnerDong",
  "partnerPhone",
  "contacts",
  "roomType",
  "buildingKind",
  "roomCount",
  "dealType",
  "deposit",
  "moveIn",
  "address",
  "loan",
  "insurance",
  "parking",
  "elevator",
];

/** 해당 매물의 미입력 필수 필드 목록 (표시 순서) */
export function getMissingRequiredFields(
  property: Property,
  options?: ValidationOptions
): PropertyFieldKey[] {
  const requireDong = options?.requireDong !== false;
  const missing: PropertyFieldKey[] = [];

  if (property.hasPartnerAgency) {
    if (requireDong && !property.partnerAgency?.dong?.trim()) {
      missing.push("partnerDong");
    }
    if (!onlyDigits(property.partnerAgency?.phone ?? "")) {
      missing.push("partnerPhone");
    }
  }

  if (!hasUsableContact(property)) {
    missing.push("contacts");
  }

  const { gu, dong, detail } = parseSeoulAddress(property.address);
  const jibunMain = parseJibunDetail(detail).main;
  if (requireDong) {
    if (!gu || !dong || !jibunMain) missing.push("address");
  } else if (!gu || !jibunMain) {
    missing.push("address");
  }

  if (!property.roomType) missing.push("roomType");
  if (isBuildingType(property.roomType) && !property.buildingKind) {
    missing.push("buildingKind");
  }
  if (needsRoomBathCounts(property.roomType)) {
    const rooms =
      property.roomType === "투룸" ? 2 : property.roomCount;
    const min = property.roomType === "3룸+" ? 3 : 1;
    if (!rooms || rooms < min) missing.push("roomCount");
  }
  if (!property.dealType) missing.push("dealType");

  if (!property.deposit || property.deposit <= 0) missing.push("deposit");

  const isLand = isLandType(property.roomType);
  const isBuilding = isBuildingType(property.roomType);
  if (!isLand && !isBuilding) {
    if (!property.moveInVacant && !property.moveInNegotiable) {
      const from =
        property.moveInFrom?.trim() ||
        (property.moveInDate && /^\d{4}-\d{2}-\d{2}$/.test(property.moveInDate)
          ? property.moveInDate
          : "");
      const to = property.moveInTo?.trim() || "";
      const single =
        property.moveInSingle ?? Boolean(from && to && from === to);
      if (!from || (!single && !to)) {
        missing.push("moveIn");
      } else if (!single && to < from) {
        missing.push("moveIn");
      }
    }
  }
  if (!isLand) {
    if (isBuilding || !skipsResidentialExtras(property.roomType)) {
      if (property.loanAvailable !== "유" && property.loanAvailable !== "무") {
        missing.push("loan");
      }
    }
    if (!isBuilding && !skipsResidentialExtras(property.roomType)) {
      if (
        needsJeonseInsurance(property.dealType, property.roomType) &&
        property.insuranceType !== "유" &&
        property.insuranceType !== "무"
      ) {
        missing.push("insurance");
      }
    }
    if (
      !isBuilding &&
      !propertySkipsParkingSelection(property.roomType, property.dealType) &&
      property.parkingType !== "유" &&
      property.parkingType !== "무"
    ) {
      missing.push("parking");
    }
  }
  if (
    !isLand &&
    !propertySkipsElevatorSelection(property.roomType) &&
    property.elevator !== true &&
    property.elevator !== false
  ) {
    missing.push("elevator");
  }

  return PROPERTY_FIELD_ORDER.filter((key) => missing.includes(key));
}

export function getFieldErrorMessage(
  field: PropertyFieldKey,
  property: Property
): string {
  return FIELD_MESSAGES[field](property);
}

/** 매물 필수값 검사. 통과 시 null, 실패 시 안내 문구 */
export function getPropertyValidationError(
  property: Property,
  label = "매물",
  options?: ValidationOptions
): string | null {
  const missing = getMissingRequiredFields(property, options);
  if (missing.length === 0) return null;
  return `${label}: ${getFieldErrorMessage(missing[0], property)}`;
}

export function getPropertiesValidationError(
  properties: Property[],
  options?: ValidationOptions
): string | null {
  return findPropertiesValidationIssue(properties, options)?.message ?? null;
}

/** 1번 매물부터 첫 미입력 필드를 찾아 반환 */
export function findPropertiesValidationIssue(
  properties: Property[],
  options?: ValidationOptions
): PropertyValidationIssue | null {
  for (let i = 0; i < properties.length; i += 1) {
    const property = properties[i];
    if (property.listedFromId?.trim()) continue;
    const fields = getMissingRequiredFields(property, options);
    if (fields.length === 0) continue;
    const focusField = fields[0];
    return {
      index: i,
      fields,
      focusField,
      message: `${i + 1}번 매물: ${getFieldErrorMessage(focusField, property)}`,
    };
  }
  return null;
}
