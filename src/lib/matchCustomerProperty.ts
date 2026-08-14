import { normalizeRoomType } from "@/lib/constants";
import { isInsuranceJoined, resolveCustomerLoanNeeded } from "@/lib/format";
import type { Customer, ListedProperty, RoomType } from "@/lib/types";

/**
 * 다른 회원(사이트내공유) 매물·고객 자동 매칭.
 * 회원 모집 우선으로 당분간 비활성 — 내 리스트 매칭만 사용.
 */
export const CROSS_MEMBER_PROPERTY_MATCH_ENABLED = false;

const AMOUNT_MIN_RATIO = 0.5;
const AMOUNT_MAX_RATIO = 1.1;

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

const DAY_RE = /^\d{4}-\d{2}-\d{2}/;

function parseDay(iso?: string): string | null {
  const s = (iso ?? "").trim();
  if (!DAY_RE.test(s)) return null;
  return s.slice(0, 10);
}

/** 입주 희망/가능 기간. 한쪽만 있으면 열린 구간으로 본다. */
function moveInDayRange(
  from?: string,
  to?: string,
  single?: boolean
): { start: string; end: string } | null {
  const f = parseDay(from);
  const t = parseDay(to);
  if (!f && !t) return null;
  if (single || (f && (!t || t === f))) {
    const d = f ?? t!;
    return { start: d, end: d };
  }
  if (f && t) {
    return f <= t ? { start: f, end: t } : { start: t, end: f };
  }
  if (f) return { start: f, end: "9999-12-31" };
  return { start: "0001-01-01", end: t! };
}

/** 고객 희망 입주와 매물 입주 가능 기간이 겹치는지. 미입력·비입주면 통과. */
function moveInPeriodsOverlap(
  customer: Customer,
  property: ListedProperty
): boolean {
  if (customer.nonOccupancy) return true;
  const c = moveInDayRange(
    customer.moveInFrom,
    customer.moveInTo,
    customer.moveInSingle
  );
  const p = moveInDayRange(
    property.moveInFrom,
    property.moveInTo,
    property.moveInSingle
  );
  if (!c || !p) return true;
  return c.start <= p.end && p.start <= c.end;
}

/** 싼 금액은 허용. 희망 최소 50% 미만·최대 110% 초과만 탈락. 미입력 통과. */
function amountFits(
  propertyAmount: number | undefined,
  customerFrom: number | undefined,
  customerTo: number | undefined,
  customerSingle?: boolean
): boolean {
  if (typeof propertyAmount !== "number") return true;
  const bounds = rangeBounds(customerFrom, customerTo, customerSingle);
  if (!bounds) return true;
  const lo = bounds.min * AMOUNT_MIN_RATIO;
  const hi = bounds.max * AMOUNT_MAX_RATIO;
  if (bounds.max <= 0) return true;
  return propertyAmount >= lo && propertyAmount <= hi;
}

function effectiveRoomCount(
  roomType: RoomType | string | undefined,
  roomCount?: number
): number | null {
  const type = normalizeRoomType(roomType) ?? roomType;
  if (type === "원룸") return 1;
  if (type === "투룸") return 2;
  if (type === "3룸+" || type === "아파트") {
    if (typeof roomCount === "number" && roomCount > 0) return roomCount;
    return null;
  }
  return null;
}

function isVillaLike(
  type: RoomType | string | undefined
): type is "원룸" | "투룸" | "3룸+" {
  return type === "원룸" || type === "투룸" || type === "3룸+";
}

function roomTypesCompatible(
  customer: Customer,
  property: ListedProperty
): boolean {
  const cType = normalizeRoomType(customer.roomType) ?? customer.roomType;
  const pType = normalizeRoomType(property.roomType) ?? property.roomType;
  if (!cType || !pType) return true;

  if (cType === "건물" && customer.buildingKind && property.buildingKind) {
    if (customer.buildingKind !== property.buildingKind) return false;
  }

  if (cType === pType) {
    if (cType === "아파트" || cType === "3룸+" || cType === "투룸") {
      const cr = effectiveRoomCount(cType, customer.roomCount);
      const pr = effectiveRoomCount(pType, property.roomCount);
      if (cr && pr) return cr === pr;
    }
    return true;
  }

  const villaToApt =
    (isVillaLike(cType) && pType === "아파트") ||
    (isVillaLike(pType) && cType === "아파트");
  if (!villaToApt) return false;

  const cr = effectiveRoomCount(cType, customer.roomCount);
  const pr = effectiveRoomCount(pType, property.roomCount);
  if (!cr || !pr) return false;
  return cr === pr;
}

/**
 * 고객이 유일 때만 매물도 유여야 함. 고객 무·미입력은 통과.
 * 매물 미입력도 통과 (기존 데이터 보호).
 */
function wantsYesFits(
  customerWant?: string | null,
  propertyHas?: boolean | string | null
): boolean {
  if (customerWant !== "유") return true;
  if (propertyHas == null || propertyHas === "") return true;
  if (propertyHas === true || propertyHas === "유") return true;
  return false;
}

/**
 * 보유 매물이 고객 희망 조건에 맞는지.
 * 핵심: 거래유형 · 매물유형(+아파트 룸수) · 보증금/매가(·월세) · 입주
 * 유/무: 대출 · 보증보험 · 주차 · 엘리베이터
 */
export function propertyMatchesCustomer(
  customer: Customer,
  property: ListedProperty
): boolean {
  if (property.contractCompleted) return false;

  if (property.dealType !== customer.dealType) return false;

  if (!roomTypesCompatible(customer, property)) return false;

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

  if (!moveInPeriodsOverlap(customer, property)) {
    return false;
  }

  if (
    !wantsYesFits(
      resolveCustomerLoanNeeded(customer),
      property.loanAvailable
    )
  ) {
    return false;
  }

  if (
    !wantsYesFits(
      customer.insuranceNeeded,
      isInsuranceJoined(property.insuranceType) ? "유" : property.insuranceType
    )
  ) {
    return false;
  }

  if (!wantsYesFits(customer.parkingType, property.parkingType)) {
    return false;
  }

  if (!wantsYesFits(customer.elevatorNeeded, property.elevator)) {
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
