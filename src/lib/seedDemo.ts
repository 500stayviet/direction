import { buildRouteSummary } from "@/lib/distance";
import { CONTRACT_DEADLINE_DAYS } from "@/lib/deadline";
import { toISODate, todayISO } from "@/lib/date";
import { formatDepositRent, formatMoveInRange } from "@/lib/format";
import { loadAppAuth } from "@/lib/supabase/appAuth";
import { createClient } from "@/lib/supabase/client";
import {
  getCustomers,
  getDemoSeedVersion,
  getListedProperties,
  getSchedules,
  saveCustomers,
  saveListedProperties,
  saveSchedules,
  setDemoSeedVersion,
  touchRecentCustomer,
} from "@/lib/storage";
import type { Customer, ListedProperty, Property, Schedule } from "@/lib/types";

/** 가입·로그인 시 체험용 시드 버전 (바꾸면 데모 행 갱신) */
export const DEMO_SEED_VERSION = "demo_v9";
const SEED_SKIP_KEY = `realty_seed_skip_${DEMO_SEED_VERSION}`;

/** 성내동 체험 지번 — 원터치 네비 체험용 */
export const DEMO_GANGDONG_OFFICE_ADDRESS = "서울특별시 강동구 성내동 540";
export const DEMO_TEST_PHONE = "111-1111-1111";

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysFrom(base: Date, offset: number): string {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + offset);
  return toISODate(d);
}

function dateSyncKey(dayISO: string) {
  return `realty_demo_dates_${DEMO_SEED_VERSION}_${dayISO}`;
}

/** 가입일(프로필 생성일) — 없으면 오늘 */
async function getSignupBaseDate(): Promise<Date> {
  try {
    const supabase = createClient();
    const { data } = await supabase.auth.getUser();
    const created = data.user?.created_at;
    if (created) {
      const d = new Date(created);
      if (!Number.isNaN(d.getTime())) return startOfLocalDay(d);
    }
  } catch {
    /* fallback */
  }
  return startOfLocalDay(new Date());
}

async function ensureSeedSession(): Promise<boolean> {
  const appAuth = loadAppAuth();
  const supabase = createClient();
  if (appAuth?.access_token && appAuth.refresh_token) {
    try {
      await Promise.race([
        supabase.auth.setSession({
          access_token: appAuth.access_token,
          refresh_token: appAuth.refresh_token,
        }),
        new Promise<void>((resolve) => window.setTimeout(resolve, 1500)),
      ]);
    } catch {
      /* continue */
    }
    return true;
  }
  const { data } = await supabase.auth.getSession();
  return Boolean(data.session?.access_token);
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
      partial.monthlyRent
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
 * 로그인 계정에 테스트용 고객·매물·방문일정 시드
 * - 최초: 가입일 기준으로 날짜 생성
 * - 이후: 매일 오늘 기준으로 날짜 갱신 (일정·계약마감 체험 유지)
 */
export async function seedDemoDataIfNeeded(): Promise<void> {
  if (typeof window === "undefined") return;

  const today = todayISO();
  try {
    if (sessionStorage.getItem(SEED_SKIP_KEY)) return;
    if (sessionStorage.getItem(dateSyncKey(today))) return;
  } catch {
    /* ignore */
  }

  try {
    const currentVersion = await getDemoSeedVersion();
    if (
      currentVersion &&
      currentVersion.localeCompare(DEMO_SEED_VERSION) > 0
    ) {
      return;
    }

    if (!(await ensureSeedSession())) return;

    const needsFullSeed = currentVersion !== DEMO_SEED_VERSION;
    const base = needsFullSeed
      ? await getSignupBaseDate()
      : startOfLocalDay(new Date());

    await runDemoSeed(base);

    try {
      sessionStorage.setItem(dateSyncKey(today), "1");
      sessionStorage.removeItem(SEED_SKIP_KEY);
    } catch {
      /* ignore */
    }
  } catch (e) {
    console.warn("[seedDemo] skipped:", e);
    try {
      sessionStorage.setItem(SEED_SKIP_KEY, "1");
    } catch {
      /* ignore */
    }
  }
}

/**
 * 체험용 1고객 · 1매물 · 1네비(일정)
 * baseDate(가입일/오늘) 기준:
 * - 방문일 = 당일 → 네비·일정 바로 사용
 * - 희망 입주 = 당일+31일 → 계약 마감 알림 체험
 */
export function buildDemoSeedData(baseDate: Date = startOfLocalDay(new Date())): {
  customers: Customer[];
  properties: ListedProperty[];
  schedules: Schedule[];
} {
  const base = startOfLocalDay(baseDate);
  const baseMs = base.getTime();
  const iso = (offsetMs: number) => new Date(baseMs + 12 * 3600_000 - offsetMs).toISOString();

  const visitDate = daysFrom(base, 0);
  const moveInFrom = daysFrom(base, CONTRACT_DEADLINE_DAYS);
  const moveInTo = daysFrom(base, CONTRACT_DEADLINE_DAYS + 14);
  const moveInDate = formatMoveInRange(moveInFrom, moveInTo);
  const propMoveInFrom = daysFrom(base, 14);
  const propMoveInTo = daysFrom(base, CONTRACT_DEADLINE_DAYS + 14);
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
      loanType: "버팀목",
      parkingType: "유",
      petAllowed: "무",
      notes:
        "체험용 테스트 고객입니다. 전화·검색·일정·계약마감 알림을 눌러 사용해 보세요.",
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
    landlordPhone: "02-3425-5114",
    hasPartnerAgency: true,
    partnerAgency: {
      name: "성내동 테스트부동산",
      phone: DEMO_TEST_PHONE,
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
    notes:
      "성내동 540 체험 매물입니다. 원터치 네비를 눌러 길찾기를 시험해 보세요.",
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
      createdAt: iso(1000 * 60 * 20),
      updatedAt: iso(1000 * 60 * 20),
    },
  ];

  return { customers, properties, schedules };
}

async function runDemoSeed(baseDate: Date): Promise<void> {
  const { customers: demoCustomers, properties: demoProperties, schedules: demoSchedules } =
    buildDemoSeedData(baseDate);

  const otherCustomers = (await getCustomers()).filter(
    (c) => !c.id.startsWith("demo_cust_")
  );
  const otherProperties = (await getListedProperties()).filter(
    (p) => !p.id.startsWith("demo_prop_")
  );
  const otherSchedules = (await getSchedules()).filter(
    (s) => !s.id.startsWith("demo_sch_")
  );

  const soft = async (label: string, fn: () => Promise<void>) => {
    try {
      await fn();
      return true;
    } catch (e) {
      console.warn(`[seedDemo] ${label} failed:`, e);
      return false;
    }
  };

  const okCustomers = await soft("customers", () =>
    saveCustomers([...demoCustomers, ...otherCustomers])
  );
  const okProperties = await soft("properties", () =>
    saveListedProperties([...demoProperties, ...otherProperties])
  );
  const okSchedules = await soft("schedules", () =>
    saveSchedules([...demoSchedules, ...otherSchedules])
  );

  if (!okCustomers || !okProperties || !okSchedules) {
    try {
      sessionStorage.setItem(SEED_SKIP_KEY, "1");
    } catch {
      /* ignore */
    }
    return;
  }

  await soft("recent", async () => {
    await touchRecentCustomer("demo_cust_1");
  });

  await setDemoSeedVersion(DEMO_SEED_VERSION);
}
