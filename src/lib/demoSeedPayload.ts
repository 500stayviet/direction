import { buildRouteSummary } from "@/lib/distance";
import { CONTRACT_DEADLINE_DAYS } from "@/lib/deadline";
import { toISODate } from "@/lib/date";
import { formatDepositRent, formatMoveInRange } from "@/lib/format";
import type { Customer, ListedProperty, Property, Schedule } from "@/lib/types";

/** 가입·로그인 시 체험용 시드 버전 (바꾸면 데모 행 갱신) */
export const DEMO_SEED_VERSION = "demo_v22";

/** 체험 카드 생성자 표시 — 가입자가 아니라 관리자 */
export const DEMO_CREATOR_NAME = "관리자";

/** 생성자 표기 일괄 변경 — 시드 내용을 다시 쓰지 않고 이름만 맞춤 */
export const DEMO_CREATOR_LABEL_VERSION = "hong_1";

export const DEMO_CUSTOMER_NAME = "홍길동";
export const DEMO_SCHEDULE_TITLE = "홍길동 고객 방문";

export const DEMO_CORE_IDS = [
  "demo_cust_1",
  "demo_prop_1",
  "demo_sch_1",
] as const;

/** 성내동 체험 지번 — 원터치 네비 체험용 */
export const DEMO_GANGDONG_OFFICE_ADDRESS = "서울특별시 강동구 성내동 540";
export const DEMO_TEST_PHONE = "111-1111-1111";
/** 협력부동산에서 준 매물 체험용 — 가입자 상호/전화와 구분 */
export const DEMO_PARTNER_AGENCY = {
  name: "옆나라 공인중개사사무소",
  phone: "02-1111-2222",
  dong: "성내동",
} as const;

/** 시드에 심을 가입자 프로필 */
export type DemoSeedActor = {
  displayName: string;
  shopName: string;
  phone: string;
};

/** 체험용 고객·매물·일정 — 팀 공유에서 제외 */
export function isDemoEntityId(id: string): boolean {
  return (
    id.startsWith("demo_cust_") ||
    id.startsWith("demo_prop_") ||
    id.startsWith("demo_sch_")
  );
}

/** 관리자 집계·목록에서 체험 시드(demo_*) 제외용 PostgREST 패턴 */
export const DEMO_ENTITY_ID_LIKE = "demo_%";

/** 가입일 다음날부터 세어 7일째(가입일+7일 00:00)부터 데모 카드 만료 */
export const DEMO_SEED_TTL_DAYS = 7;

export function isDemoSeedExpired(
  signupAt?: string | Date | null
): boolean {
  if (!signupAt) return false;
  const d = typeof signupAt === "string" ? new Date(signupAt) : signupAt;
  if (Number.isNaN(d.getTime())) return false;
  const expire = startOfLocalDay(d);
  expire.setDate(expire.getDate() + DEMO_SEED_TTL_DAYS);
  return Date.now() >= expire.getTime();
}

const DEMO_MOVE_IN_SPAN_DAYS = 7;

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysFrom(base: Date, offset: number): string {
  const d = new Date(
    base.getFullYear(),
    base.getMonth(),
    base.getDate() + offset
  );
  return toISODate(d);
}

function makeCustomer(
  partial: Omit<Customer, "budget" | "moveInDate" | "createdAt" | "updatedAt"> & {
    createdAt?: string;
  }
): Customer {
  const createdAt = partial.createdAt ?? new Date().toISOString();
  return {
    ...partial,
    budget: formatDepositRent(
      partial.dealType,
      partial.deposit,
      partial.monthlyRent,
      partial.depositSingle === false ? partial.depositTo : undefined,
      partial.monthlyRentSingle === false ? partial.monthlyRentTo : undefined
    ),
    moveInDate: formatMoveInRange(partial.moveInFrom, partial.moveInTo),
    createdAt,
    updatedAt: createdAt,
  };
}

function makeListed(
  partial: Omit<ListedProperty, "createdAt" | "updatedAt"> & {
    createdAt?: string;
  }
): ListedProperty {
  const createdAt = partial.createdAt ?? new Date().toISOString();
  return {
    ...partial,
    createdAt,
    updatedAt: createdAt,
  };
}

function makeProperty(partial: Partial<Property> & { id: string }): Property {
  return {
    id: partial.id,
    address: partial.address ?? "",
    roomNo: partial.roomNo ?? "",
    buildingName: partial.buildingName ?? "",
    floorPassword: partial.floorPassword ?? "",
    roomPassword: partial.roomPassword ?? "",
    arriveTime: partial.arriveTime ?? "",
    tenantPhone: partial.tenantPhone ?? "",
    landlordPhone: partial.landlordPhone ?? "",
    hasPartnerAgency: partial.hasPartnerAgency ?? false,
    partnerAgency: partial.partnerAgency ?? {
      name: "",
      phone: "",
      dong: "",
    },
    dealType: partial.dealType ?? "전세",
    roomType: partial.roomType ?? "원룸",
    deposit: partial.deposit ?? 0,
    monthlyRent: partial.monthlyRent,
    maintenanceFee: partial.maintenanceFee ?? 0,
    maintenanceIncludes: partial.maintenanceIncludes ?? [],
    parkingType: partial.parkingType ?? "무",
    parkingFeeType: partial.parkingFeeType ?? "별도",
    parkingFee: partial.parkingFee,
    loanAvailable: partial.loanAvailable ?? "무",
    petAllowed: partial.petAllowed ?? "무",
    elevator: partial.elevator ?? false,
    options: partial.options ?? [],
    moveInFrom: partial.moveInFrom ?? "",
    moveInTo: partial.moveInTo ?? "",
    moveInSingle: partial.moveInSingle ?? false,
    moveInDate: partial.moveInDate ?? "",
    insuranceType: partial.insuranceType ?? "무",
    notes: partial.notes ?? "",
  };
}

/**
 * 체험용 1고객 · 1매물 · 1네비(일정)
 * baseDate 기준: 방문일=당일, 희망입주=당일+45일부터
 * actor: 가입 시 이름·상호·전화 (협력부동산은 DEMO_PARTNER_AGENCY)
 * 생성자 표시는 DEMO_CREATOR_NAME(관리자)
 */
export function buildDemoSeedData(
  baseDate: Date = startOfLocalDay(new Date()),
  _actor?: DemoSeedActor | null
): {
  customers: Customer[];
  properties: ListedProperty[];
  schedules: Schedule[];
} {
  const base = startOfLocalDay(baseDate);
  const baseMs = base.getTime();
  const iso = (offsetMs: number) =>
    new Date(baseMs + 12 * 3600_000 - offsetMs).toISOString();

  const visitDate = daysFrom(base, 0);
  const moveInFrom = daysFrom(base, CONTRACT_DEADLINE_DAYS);
  const moveInTo = daysFrom(
    base,
    CONTRACT_DEADLINE_DAYS + DEMO_MOVE_IN_SPAN_DAYS
  );
  const propMoveInFrom = daysFrom(base, 14);
  const propMoveInTo = daysFrom(
    base,
    CONTRACT_DEADLINE_DAYS + DEMO_MOVE_IN_SPAN_DAYS
  );
  const propMoveInDate = formatMoveInRange(propMoveInFrom, propMoveInTo);

  const customers: Customer[] = [
    makeCustomer({
      id: "demo_cust_1",
      name: DEMO_CUSTOMER_NAME,
      phone: DEMO_TEST_PHONE,
      dealType: "전세",
      roomType: "원룸",
      deposit: 10000,
      monthlyRent: 20,
      moveInFrom,
      moveInTo,
      moveInSingle: false,
      loanNeeded: "유",
      loanType: "버팀목",
      insuranceNeeded: "유",
      elevatorNeeded: "유",
      parkingType: "유",
      carType: "세단",
      petAllowed: "무",
      preferredGus: ["강동구"],
      preferredDongs: ["강동구|성내동"],
      notes:
        "체험용 고객입니다. 전화·검색·일정·계약마감 알림을 눌러 사용해 보세요.",
      createdByName: DEMO_CREATOR_NAME,
      workspaceShared: false,
      createdAt: iso(1000 * 60 * 60),
    }),
  ];

  const propertyFields = {
    address: DEMO_GANGDONG_OFFICE_ADDRESS,
    roomNo: "본관 101호",
    floorPassword: "1234*",
    roomPassword: "5678*",
    arriveTime: "10:00",
    tenantPhone: "",
    landlordPhone: "",
    hasPartnerAgency: true,
    partnerAgency: {
      name: DEMO_PARTNER_AGENCY.name,
      phone: DEMO_PARTNER_AGENCY.phone,
      dong: DEMO_PARTNER_AGENCY.dong,
    },
    dealType: "전세" as const,
    roomType: "원룸" as const,
    deposit: 10000,
    monthlyRent: 20,
    maintenanceFee: 10,
    maintenanceIncludes: ["인터넷", "TV", "수도", "전기"],
    parkingType: "유" as const,
    parkingFeeType: "별도" as const,
    parkingFee: 5,
    loanAvailable: "유" as const,
    petAllowed: "무" as const,
    elevator: true,
    options: ["에어컨", "냉장고", "세탁기", "인덕션"],
    moveInFrom: propMoveInFrom,
    moveInTo: propMoveInTo,
    moveInSingle: false,
    moveInDate: propMoveInDate,
    insuranceType: "유",
    notes:
      "협력부동산에서 받은 체험 매물입니다. 원터치 네비를 눌러 길찾기를 시험해 보세요.",
    createdByName: DEMO_CREATOR_NAME,
    workspaceShared: false,
    partnerAgencyShared: false,
  };

  const properties: ListedProperty[] = [
    makeListed({
      id: "demo_prop_1",
      ...propertyFields,
      createdAt: iso(1000 * 60 * 50),
    }),
  ];

  const scheduleProps: Property[] = [
    makeProperty({
      id: "demo_sch_prop_1a",
      ...propertyFields,
      arriveTime: "10:00",
    }),
  ];

  const schedules: Schedule[] = [
    {
      id: "demo_sch_1",
      customerId: "demo_cust_1",
      title: DEMO_SCHEDULE_TITLE,
      visitDate,
      visitTime: "10:00",
      properties: scheduleProps,
      routeSummary: buildRouteSummary(scheduleProps),
      createdByName: DEMO_CREATOR_NAME,
      workspaceShared: false,
      createdAt: iso(1000 * 60 * 20),
      updatedAt: iso(1000 * 60 * 20),
    },
  ];

  return { customers, properties, schedules };
}

export function demoSeedBaseDate(from?: string | Date | null): Date {
  if (from) {
    const d = typeof from === "string" ? new Date(from) : from;
    if (!Number.isNaN(d.getTime())) return startOfLocalDay(d);
  }
  return startOfLocalDay(new Date());
}
