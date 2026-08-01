import { buildRouteSummary } from "@/lib/distance";
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
import { formatDepositRent, formatMoveInRange } from "@/lib/format";

const DEMO_SEED_VERSION = "demo_v3";

function nowISO() {
  return new Date().toISOString();
}

function daysFromToday(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function makeCustomer(
  partial: Omit<Customer, "budget" | "moveInDate" | "createdAt" | "updatedAt"> & {
    createdAt?: string;
  }
): Customer {
  const createdAt = partial.createdAt ?? nowISO();
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
  const createdAt = partial.createdAt ?? nowISO();
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

/** 로그인 계정에 테스트용 손님·매물·방문일정 시드 (버전 바뀌면 갱신) */
export async function seedDemoDataIfNeeded(): Promise<void> {
  if (typeof window === "undefined") return;

  const currentVersion = await getDemoSeedVersion();
  if (currentVersion === DEMO_SEED_VERSION) {
    return;
  }

  const t0 = Date.now();
  const iso = (offsetMs: number) => new Date(t0 - offsetMs).toISOString();

  const demoCustomers: Customer[] = [
    makeCustomer({
      id: "demo_cust_1",
      name: "김민수",
      phone: "01012345678",
      dealType: "전세",
      roomType: "원룸",
      deposit: 10000,
      monthlyRent: undefined,
      moveInFrom: daysFromToday(45),
      moveInTo: daysFromToday(45),
      moveInSingle: true,
      loanType: "버팀목",
      parkingType: "무",
      petAllowed: "무",
      notes: "테스트 손님 · 강동 원룸 전세",
      createdAt: iso(1000 * 60 * 60 * 3),
    }),
    makeCustomer({
      id: "demo_cust_2",
      name: "이서연",
      phone: "01098765432",
      dealType: "월세",
      roomType: "투룸",
      deposit: 3000,
      monthlyRent: 80,
      moveInFrom: daysFromToday(20),
      moveInTo: daysFromToday(40),
      moveInSingle: false,
      loanType: "해당없음",
      parkingType: "유",
      petAllowed: "유",
      notes: "테스트 손님 · 주차·반려동물 가능 희망",
      createdAt: iso(1000 * 60 * 60 * 2),
    }),
    makeCustomer({
      id: "demo_cust_3",
      name: "박준호",
      phone: "01055556666",
      dealType: "매매",
      roomType: "쓰리룸",
      deposit: 65000,
      nonOccupancy: false,
      moveInFrom: daysFromToday(60),
      moveInTo: daysFromToday(60),
      moveInSingle: true,
      loanType: "디딤돌",
      parkingType: "유",
      petAllowed: "무",
      notes: "테스트 손님 · 매매 쓰리룸",
      createdAt: iso(1000 * 60 * 60),
    }),
  ];

  const demoProperties: ListedProperty[] = [
    makeListed({
      id: "demo_prop_1",
      address: "서울 강동구 성내동 123-45",
      roomNo: "1203호",
      floorPassword: "1234*",
      roomPassword: "5678*",
      tenantPhone: "01011112222",
      landlordPhone: "",
      hasPartnerAgency: true,
      partnerAgency: {
        name: "성내동 테스트부동산",
        phone: "0212345678",
        dong: "성내동",
      },
      dealType: "전세",
      roomType: "원룸",
      deposit: 10000,
      maintenanceFee: 10,
      maintenanceIncludes: ["인터넷", "수도"],
      parkingType: "무",
      parkingFeeType: "별도",
      petAllowed: "무",
      elevator: true,
      options: ["에어컨", "냉장고", "세탁기"],
      moveInFrom: daysFromToday(14),
      moveInTo: daysFromToday(14),
      moveInSingle: true,
      moveInDate: formatMoveInRange(daysFromToday(14), daysFromToday(14)),
      insuranceType: "유",
      notes: "남향 · 3층 · 즉시입주 가능",
      createdAt: iso(1000 * 60 * 50),
    }),
    makeListed({
      id: "demo_prop_2",
      address: "서울 강동구 천호동 456-7",
      roomNo: "502호",
      floorPassword: "0000",
      roomPassword: "4321",
      tenantPhone: "",
      landlordPhone: "01033334444",
      hasPartnerAgency: false,
      partnerAgency: { name: "", phone: "", dong: "" },
      dealType: "월세",
      roomType: "투룸",
      deposit: 3000,
      monthlyRent: 75,
      maintenanceFee: 8,
      maintenanceIncludes: ["전기"],
      parkingType: "유",
      parkingFeeType: "별도",
      parkingFee: 5,
      petAllowed: "유",
      elevator: true,
      options: ["에어컨", "인덕션"],
      moveInFrom: daysFromToday(7),
      moveInTo: daysFromToday(30),
      moveInSingle: false,
      moveInDate: formatMoveInRange(daysFromToday(7), daysFromToday(30)),
      insuranceType: "무",
      notes: "동향 · 반려동물 협의",
      createdAt: iso(1000 * 60 * 40),
    }),
    makeListed({
      id: "demo_prop_3",
      address: "서울 송파구 잠실동 22",
      roomNo: "1501호",
      floorPassword: "2580",
      roomPassword: "1470",
      tenantPhone: "01077778888",
      hasPartnerAgency: true,
      partnerAgency: {
        name: "잠실 협력공인",
        phone: "0255556666",
        dong: "잠실동",
      },
      dealType: "매매",
      roomType: "쓰리룸",
      deposit: 62000,
      maintenanceFee: 15,
      maintenanceIncludes: ["청소", "주차"],
      parkingType: "유",
      parkingFeeType: "포함",
      petAllowed: "무",
      elevator: true,
      options: ["에어컨", "냉장고", "세탁기", "가스레인지"],
      moveInFrom: daysFromToday(90),
      moveInTo: daysFromToday(90),
      moveInSingle: true,
      moveInDate: formatMoveInRange(daysFromToday(90), daysFromToday(90)),
      insuranceType: "무",
      notes: "남서향 · 고층 · 입주협의",
      createdAt: iso(1000 * 60 * 30),
    }),
  ];

  const scheduleProps1: Property[] = [
    makeProperty({
      id: "demo_sch_prop_1a",
      address: "서울 강동구 성내동 123-45",
      roomNo: "1203호",
      arriveTime: "10:00",
      floorPassword: "1234*",
      roomPassword: "5678*",
      tenantPhone: "01011112222",
      landlordPhone: "",
      hasPartnerAgency: true,
      partnerAgency: {
        name: "성내동 테스트부동산",
        phone: "0212345678",
        dong: "성내동",
      },
      dealType: "전세",
      roomType: "원룸",
      deposit: 10000,
      maintenanceFee: 10,
      maintenanceIncludes: ["인터넷", "수도"],
      parkingType: "무",
      parkingFeeType: "별도",
      petAllowed: "무",
      elevator: true,
      options: ["에어컨", "냉장고", "세탁기"],
      insuranceType: "유",
      notes: "남향 · 3층 · 즉시입주",
      moveInFrom: daysFromToday(14),
      moveInTo: daysFromToday(14),
      moveInSingle: true,
      moveInDate: formatMoveInRange(daysFromToday(14), daysFromToday(14)),
    }),
    makeProperty({
      id: "demo_sch_prop_1b",
      address: "서울 강동구 천호동 456-7",
      roomNo: "502호",
      arriveTime: "11:30",
      floorPassword: "0000",
      roomPassword: "4321",
      tenantPhone: "",
      landlordPhone: "01033334444",
      hasPartnerAgency: false,
      partnerAgency: { name: "", phone: "", dong: "" },
      dealType: "월세",
      roomType: "투룸",
      deposit: 3000,
      monthlyRent: 75,
      maintenanceFee: 8,
      maintenanceIncludes: ["전기"],
      parkingType: "유",
      parkingFeeType: "별도",
      parkingFee: 5,
      petAllowed: "유",
      elevator: true,
      options: ["에어컨", "인덕션"],
      insuranceType: "무",
      notes: "동향 · 반려동물 협의",
      moveInFrom: daysFromToday(7),
      moveInTo: daysFromToday(30),
      moveInSingle: false,
      moveInDate: formatMoveInRange(daysFromToday(7), daysFromToday(30)),
    }),
  ];

  const scheduleProps2: Property[] = [
    makeProperty({
      id: "demo_sch_prop_2a",
      address: "서울 송파구 잠실동 22",
      roomNo: "1501호",
      arriveTime: "14:00",
      floorPassword: "2580",
      roomPassword: "1470",
      tenantPhone: "01077778888",
      landlordPhone: "",
      hasPartnerAgency: true,
      partnerAgency: {
        name: "잠실 협력공인",
        phone: "0255556666",
        dong: "잠실동",
      },
      dealType: "매매",
      roomType: "쓰리룸",
      deposit: 62000,
      maintenanceFee: 15,
      maintenanceIncludes: ["청소", "주차"],
      parkingType: "유",
      parkingFeeType: "포함",
      petAllowed: "무",
      elevator: true,
      options: ["에어컨", "냉장고", "세탁기", "가스레인지"],
      insuranceType: "무",
      notes: "남서향 · 고층 · 입주협의",
      moveInFrom: daysFromToday(90),
      moveInTo: daysFromToday(90),
      moveInSingle: true,
      moveInDate: formatMoveInRange(daysFromToday(90), daysFromToday(90)),
    }),
  ];

  const demoSchedules: Schedule[] = [
    {
      id: "demo_sch_1",
      customerId: "demo_cust_1",
      visitDate: daysFromToday(1),
      visitTime: "09:30",
      properties: scheduleProps1,
      routeSummary: buildRouteSummary(scheduleProps1),
      createdAt: iso(1000 * 60 * 20),
      updatedAt: iso(1000 * 60 * 20),
    },
    {
      id: "demo_sch_2",
      customerId: "demo_cust_3",
      visitDate: daysFromToday(2),
      visitTime: "13:00",
      properties: scheduleProps2,
      routeSummary: buildRouteSummary(scheduleProps2),
      createdAt: iso(1000 * 60 * 10),
      updatedAt: iso(1000 * 60 * 10),
    },
    {
      id: "demo_sch_3",
      guestName: "홍길동(게스트)",
      visitDate: daysFromToday(0),
      visitTime: "16:00",
      properties: [
        makeProperty({
          id: "demo_sch_prop_3a",
          address: "서울 강동구 길동 88",
          roomNo: "301호",
          arriveTime: "16:20",
          floorPassword: "1111",
          roomPassword: "2222",
          tenantPhone: "01000001111",
          hasPartnerAgency: false,
          partnerAgency: { name: "", phone: "", dong: "" },
          dealType: "전세",
          roomType: "원룸",
          deposit: 8000,
          maintenanceFee: 7,
          maintenanceIncludes: ["인터넷"],
          parkingType: "무",
          petAllowed: "무",
          elevator: false,
          options: ["에어컨", "냉장고"],
          insuranceType: "유",
          notes: "북향 · 저층 · 고객없음 일정 테스트",
          moveInFrom: daysFromToday(10),
          moveInTo: daysFromToday(10),
          moveInSingle: true,
          moveInDate: formatMoveInRange(daysFromToday(10), daysFromToday(10)),
        }),
      ],
      routeSummary: [],
      createdAt: iso(1000 * 60 * 5),
      updatedAt: iso(1000 * 60 * 5),
    },
  ];

  const otherCustomers = (await getCustomers()).filter(
    (c) => !c.id.startsWith("demo_cust_")
  );
  const otherProperties = (await getListedProperties()).filter(
    (p) => !p.id.startsWith("demo_prop_")
  );
  const otherSchedules = (await getSchedules()).filter(
    (s) => !s.id.startsWith("demo_sch_")
  );

  await saveCustomers([...demoCustomers, ...otherCustomers]);
  await saveListedProperties([...demoProperties, ...otherProperties]);
  await saveSchedules([...demoSchedules, ...otherSchedules]);

  await touchRecentCustomer("demo_cust_1");
  await touchRecentCustomer("demo_cust_2");
  await touchRecentCustomer("demo_cust_3");

  await setDemoSeedVersion(DEMO_SEED_VERSION);
}
