import { normalizeRoomType } from "@/lib/constants";
import type { Customer, ListedProperty } from "@/lib/types";

/**
 * 다른 회원(사이트내공유) 매물·고객 자동 매칭.
 * 회원 모집 우선으로 당분간 비활성 — 내 리스트 매칭만 사용.
 */
export const CROSS_MEMBER_PROPERTY_MATCH_ENABLED = false;

function rangeBounds(
  from: number | undefined,
  to: number | undefined,
  single?: boolean
): { min: number; max: number } | null {
  if (typeof from !== "number" || Number.isNaN(from)) return null;
  if (single === false && typeof to === "number" && to > 0 && to !== from) {
    return { min: Math.min(from, to), max: Math.max(from, to) };
  }
  if (typeof to === "number" && to > 0 && to !== from) {
    return { min: Math.min(from, to), max: Math.max(from, to) };
  }
  return { min: from, max: from };
}

/** 금액이 희망 구간과 겹치거나, 단일 희망이면 그 금액 이하(여유)로 본다 */
function amountFits(
  propertyAmount: number | undefined,
  customerFrom: number | undefined,
  customerTo: number | undefined,
  customerSingle?: boolean
): boolean {
  if (typeof propertyAmount !== "number") return true;
  const bounds = rangeBounds(customerFrom, customerTo, customerSingle);
  if (!bounds) return true;
  if (bounds.min === bounds.max) {
    // 단일 희망: 희망액의 70%~110% 안이면 적합
    const target = bounds.max;
    if (target <= 0) return true;
    return propertyAmount >= target * 0.7 && propertyAmount <= target * 1.1;
  }
  return propertyAmount >= bounds.min && propertyAmount <= bounds.max;
}

/**
 * 보유 매물이 고객 희망 조건에 맞는지.
 * 핵심: 거래유형 · 매물유형 · 보증금/매가(·월세) · (건물 종류)
 * 보조: 방 수 · 주차 · 애완동물
 */
export function propertyMatchesCustomer(
  customer: Customer,
  property: ListedProperty
): boolean {
  if (property.contractCompleted) return false;

  if (property.dealType !== customer.dealType) return false;

  const cType = normalizeRoomType(customer.roomType) ?? customer.roomType;
  const pType = normalizeRoomType(property.roomType) ?? property.roomType;
  if (cType && pType && cType !== pType) return false;

  if (cType === "건물" && customer.buildingKind && property.buildingKind) {
    if (customer.buildingKind !== property.buildingKind) return false;
  }

  if (
    !amountFits(
      property.deposit,
      customer.deposit,
      customer.depositTo,
      customer.depositSingle
    )
  ) {
    return false;
  }

  if (customer.dealType === "월세") {
    if (
      !amountFits(
        property.monthlyRent,
        customer.monthlyRent,
        customer.monthlyRentTo,
        customer.monthlyRentSingle
      )
    ) {
      return false;
    }
  }

  if (
    typeof customer.roomCount === "number" &&
    customer.roomCount > 0 &&
    typeof property.roomCount === "number" &&
    property.roomCount > 0
  ) {
    if (cType === "투룸") {
      if (property.roomCount !== 2) return false;
    } else if (property.roomCount < customer.roomCount) {
      return false;
    }
  }

  if (customer.parkingType === "유" && property.parkingType === "무") {
    return false;
  }

  if (customer.petAllowed === "유" && property.petAllowed === "무") {
    return false;
  }

  return true;
}

export function findMatchingProperties(
  customer: Customer,
  properties: ListedProperty[]
): ListedProperty[] {
  return properties
    .filter((p) => propertyMatchesCustomer(customer, p))
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
}

/**
 * 내 리스트 매물 + (향후) 사이트내공유 매물 매칭.
 * - own: 내가 등록한 매물 전부(협력부동산 태그 포함)
 * - partner: 다른 계정 사이트내공유 매물 — 현재 비활성
 */
export function findMatchingPropertiesGrouped(
  customer: Customer,
  myProperties: ListedProperty[],
  /** 다른 회원 공유 매물. 플래그 off면 무시 */
  crossMemberProperties: ListedProperty[] = []
): {
  own: ListedProperty[];
  partner: ListedProperty[];
} {
  const own = findMatchingProperties(customer, myProperties);

  if (!CROSS_MEMBER_PROPERTY_MATCH_ENABLED) {
    return { own, partner: [] };
  }

  const ownIds = new Set(own.map((p) => p.id));
  const partner = findMatchingProperties(customer, crossMemberProperties).filter(
    (p) => !ownIds.has(p.id)
  );
  return { own, partner };
}

export function findMatchingCustomers(
  property: ListedProperty,
  customers: Customer[]
): Customer[] {
  return customers
    .filter(
      (c) => !c.contractCompleted && propertyMatchesCustomer(c, property)
    )
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
}

/**
 * 내 고객 + (향후) 사이트내공유 고객 매칭.
 * - own: 내가 등록한 고객
 * - partner: 다른 계정 사이트내공유 고객 — 현재 비활성
 */
export function findMatchingCustomersGrouped(
  property: ListedProperty,
  myCustomers: Customer[],
  crossMemberCustomers: Customer[] = []
): {
  own: Customer[];
  partner: Customer[];
} {
  const own = findMatchingCustomers(property, myCustomers);

  if (!CROSS_MEMBER_PROPERTY_MATCH_ENABLED) {
    return { own, partner: [] };
  }

  const ownIds = new Set(own.map((c) => c.id));
  const partner = findMatchingCustomers(property, crossMemberCustomers).filter(
    (c) => !ownIds.has(c.id)
  );
  return { own, partner };
}
