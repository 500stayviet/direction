import { onlyDigits } from "@/lib/format";
import { parseJibunDetail, parseSeoulAddress } from "@/lib/seoulRegions";
import type { Property } from "@/lib/types";

export type PropertyFieldKey =
  | "contacts"
  | "partnerName"
  | "partnerDong"
  | "partnerPhone"
  | "address"
  | "roomType"
  | "buildingKind"
  | "dealType"
  | "deposit"
  | "parking";

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

const FIELD_MESSAGES: Record<PropertyFieldKey, (p: Property) => string> = {
  contacts: (p) =>
    p.hasPartnerAgency
      ? "협력 부동산 연락처 또는 임차인·집주인 번호를 입력해 주세요."
      : "임차인 번호 또는 집주인 번호 중 하나는 입력해 주세요.",
  partnerName: () => "협력 부동산 상호명을 입력해 주세요.",
  partnerDong: () => "협력 부동산 동을 입력해 주세요.",
  partnerPhone: () => "협력 부동산 연락처를 입력해 주세요.",
  address: () => "구·동·지번 본번을 입력해 주세요.",
  roomType: () => "유형을 선택해 주세요.",
  buildingKind: () => "건물 종류(다가구·상가주택·근생)를 선택해 주세요.",
  dealType: () => "거래 형태를 선택해 주세요.",
  deposit: (p) =>
    p.dealType === "매매" ? "매가를 입력해 주세요." : "보증금을 입력해 주세요.",
  parking: () => "주차 유무를 선택해 주세요.",
};

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
  if (property.roomType === "건물" && !property.buildingKind) {
    missing.push("buildingKind");
  }
  if (!property.dealType) missing.push("dealType");

  if (!property.deposit || property.deposit <= 0) missing.push("deposit");

  if (property.roomType === "건물") {
    // 주차대수로 유/무를 맞추므로, 미입력이면 무로 간주
  } else if (property.parkingType !== "유" && property.parkingType !== "무") {
    missing.push("parking");
  }

  return missing;
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
