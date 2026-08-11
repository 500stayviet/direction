import { buildRouteSummary } from "@/lib/distance";
import { CONTRACT_DEADLINE_DAYS } from "@/lib/deadline";
import { toISODate } from "@/lib/date";
import { formatDepositRent, formatMoveInRange } from "@/lib/format";
import type { Customer, ListedProperty, Property, Schedule } from "@/lib/types";

/** 가입·로그인 시 체험용 시드 버전 (바꾸면 데모 행 갱신) */
export const DEMO_SEED_VERSION = "demo_v14";

export const DEMO_CORE_IDS = [
  "demo_cust_1",
  "demo_prop_1",
  "demo_sch_1",
] as const;

/** 성내동 체험 지번 — 원터치 네비 체험용 */
export const DEMO_GANGDONG_OFFICE_ADDRESS = "서울특별시 강동구 성내동 540";
export const DEMO_TEST_PHONE = "111-1111-1111";

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
 * baseDate 기준: 방문일=당일, 희망입주=당일+31일부터
 * actor: 가입 시 이름·상호·전화 — 생성자·협력부동산 등에 반영
 */
export function buildDemoSeedData(
  baseDate: Date = startOfLocalDay(new Date()),
  actor?: DemoSeedActor | null
): {
  customers: Customer[];
  properties: ListedProperty[];
  schedules: Schedule[];
} {
  const base = startOfLocalDay(baseDate);
  const baseMs = base.getTime();
  const iso = (offsetMs: number) =>
    new Date(baseMs + 12 * 3600_000 - offsetMs).toISOString();

  const displayName = actor?.displayName?.trim() || "회원";
  const shopName = actor?.shopName?.trim() || "테스트부동산";
  const actorPhone = actor?.phone?.trim() || DEMO_TEST_PHONE;

  const visitDate = daysFrom(base, 0);
  const moveInFrom = daysFrom(base, CONTRACT_DEADLINE_DAYS);
  const moveInTo = daysFrom(
    base,
    CONTRACT_DEADLINE_DAYS + DEMO_MOVE_IN_SPAN_DAYS
  );
  const propMoveInFrom = daysFrom(base, 14);
  const propMoveInTo = daysFrom(base, 14 + DEMO_MOVE_IN_SPAN_DAYS);
  const propMoveInDate = formatMoveInRange(propMoveInFrom, propMoveInTo);

  const customers: Customer[] = [
    makeCustomer({
      id: "demo_cust_1",
      name: "테스트",
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
      parkingType: "유",
      carType: "세단",
      petAllowed: "무",
      notes:
        "체험용 테스트 고객입니다. 전화·검색·일정·계약마감 알림을 눌러 사용해 보세요.",
      createdByName: displayName,
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
    tenantPhone: DEMO_TEST_PHONE,
    landlordPhone: actorPhone,
    hasPartnerAgency: true,
    partnerAgency: {
      name: shopName,
      phone: actorPhone,
      dong: "성내동",
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
    petAllowed: "무" as const,
    elevator: true,
    options: ["에어컨", "냉장고", "세탁기", "인덕션"],
    moveInFrom: propMoveInFrom,
    moveInTo: propMoveInTo,
    moveInSingle: false,
    moveInDate: propMoveInDate,
    insuranceType: "유",
    notes: `${shopName} 체험 매물입니다. 원터치 네비를 눌러 길찾기를 시험해 보세요.`,
    createdByName: displayName,
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
      title: "테스트 고객 방문",
      visitDate,
      visitTime: "10:00",
      properties: scheduleProps,
      routeSummary: buildRouteSummary(scheduleProps),
      createdByName: displayName,
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
