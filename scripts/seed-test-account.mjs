/**
 * 테스트 계정(test)에 손님·매물·일정 시드 삽입
 * 사용: node scripts/seed-test-account.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const env = Object.fromEntries(
  readFileSync(join(root, ".env.local"), "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

function daysFromToday(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

function formatMoney(n) {
  if (n == null || Number.isNaN(n)) return "0만";
  return `${Number(n).toLocaleString("ko-KR")}만`;
}

function formatDepositRent(dealType, deposit, monthlyRent) {
  if (dealType === "매매") return `매가 ${formatMoney(deposit)}`;
  if (dealType === "전세") {
    if (monthlyRent && monthlyRent > 0) {
      return `보증 ${formatMoney(deposit)} · 월 ${formatMoney(monthlyRent)}`;
    }
    return `전세 ${formatMoney(deposit)}`;
  }
  return `보증 ${formatMoney(deposit)} · 월 ${formatMoney(monthlyRent ?? 0)}`;
}

function formatMoveInRange(from, to) {
  if (!from && !to) return "";
  if (from && to && from !== to) return `${from} ~ ${to}`;
  return from || to || "";
}

function buildRouteSummary(properties) {
  const summary = [];
  for (let i = 0; i < properties.length - 1; i++) {
    summary.push({
      fromIndex: i,
      toIndex: i + 1,
      distanceKm: 1.2 + i * 0.8,
      durationMin: 8 + i * 5,
    });
  }
  return summary;
}

function makeCustomer(p) {
  const createdAt = p.createdAt ?? new Date().toISOString();
  return {
    ...p,
    budget: formatDepositRent(p.dealType, p.deposit, p.monthlyRent),
    moveInDate: formatMoveInRange(p.moveInFrom, p.moveInTo),
    createdAt,
    updatedAt: createdAt,
  };
}

function makeListed(p) {
  const createdAt = p.createdAt ?? new Date().toISOString();
  return { ...p, createdAt, updatedAt: createdAt };
}

function makeProperty(partial) {
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
    partnerAgency: partial.partnerAgency ?? { name: "", phone: "", dong: "" },
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

function buildDemoSeedData() {
  const t0 = Date.now();
  const iso = (ms) => new Date(t0 - ms).toISOString();

  const customers = [
    makeCustomer({
      id: "demo_cust_1",
      name: "김민수",
      phone: "01012345678",
      dealType: "전세",
      roomType: "원룸",
      deposit: 10000,
      monthlyRent: 20,
      moveInFrom: daysFromToday(45),
      moveInTo: daysFromToday(60),
      moveInSingle: false,
      loanType: "버팀목",
      parkingType: "무",
      petAllowed: "무",
      notes: "테스트 손님 · 강동 원룸 전세 · 반전세 가능",
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
      monthlyRent: 0,
      nonOccupancy: false,
      moveInFrom: daysFromToday(60),
      moveInTo: daysFromToday(90),
      moveInSingle: false,
      loanType: "디딤돌",
      parkingType: "유",
      petAllowed: "무",
      notes: "테스트 손님 · 매매 쓰리룸 · 실입주",
      createdAt: iso(1000 * 60 * 60),
    }),
    makeCustomer({
      id: "demo_cust_4",
      name: "홍길동",
      phone: "01022223333",
      dealType: "전세",
      roomType: "원룸",
      deposit: 8000,
      monthlyRent: 15,
      moveInFrom: daysFromToday(10),
      moveInTo: daysFromToday(20),
      moveInSingle: false,
      loanType: "중기청",
      parkingType: "무",
      petAllowed: "무",
      notes: "테스트 손님 · 길동 원룸 전세",
      createdAt: iso(1000 * 60 * 30),
    }),
  ];

  const properties = [
    makeListed({
      id: "demo_prop_1",
      address: "서울 강동구 성내동 123-45",
      roomNo: "101동 1203호",
      floorPassword: "1234*",
      roomPassword: "5678*",
      arriveTime: "10:00",
      tenantPhone: "01011112222",
      landlordPhone: "01022221111",
      hasPartnerAgency: true,
      partnerAgency: {
        name: "성내동 테스트부동산",
        phone: "0212345678",
        dong: "성내동",
      },
      dealType: "전세",
      roomType: "원룸",
      deposit: 10000,
      monthlyRent: 20,
      maintenanceFee: 10,
      maintenanceIncludes: ["인터넷", "TV", "수도"],
      parkingType: "무",
      parkingFeeType: "별도",
      parkingFee: 0,
      petAllowed: "무",
      elevator: true,
      options: ["에어컨", "냉장고", "세탁기"],
      moveInFrom: daysFromToday(14),
      moveInTo: daysFromToday(45),
      moveInSingle: false,
      moveInDate: formatMoveInRange(daysFromToday(14), daysFromToday(45)),
      insuranceType: "유",
      notes: "남향 · 3층 · 즉시입주 가능 · 반전세 협의",
      createdAt: iso(1000 * 60 * 50),
    }),
    makeListed({
      id: "demo_prop_2",
      address: "서울 강동구 천호동 456-7",
      roomNo: "502호",
      floorPassword: "0000",
      roomPassword: "4321",
      arriveTime: "11:30",
      tenantPhone: "01044445555",
      landlordPhone: "01033334444",
      hasPartnerAgency: true,
      partnerAgency: {
        name: "천호 협력공인",
        phone: "0244445555",
        dong: "천호동",
      },
      dealType: "월세",
      roomType: "투룸",
      deposit: 3000,
      monthlyRent: 75,
      maintenanceFee: 8,
      maintenanceIncludes: ["전기", "가스"],
      parkingType: "유",
      parkingFeeType: "별도",
      parkingFee: 5,
      petAllowed: "유",
      elevator: true,
      options: ["에어컨", "인덕션", "세탁기"],
      moveInFrom: daysFromToday(7),
      moveInTo: daysFromToday(30),
      moveInSingle: false,
      moveInDate: formatMoveInRange(daysFromToday(7), daysFromToday(30)),
      insuranceType: "무",
      notes: "동향 · 반려동물 협의 · 주차 1대",
      createdAt: iso(1000 * 60 * 40),
    }),
    makeListed({
      id: "demo_prop_3",
      address: "서울 송파구 잠실동 22",
      roomNo: "1501호",
      floorPassword: "2580",
      roomPassword: "1470",
      arriveTime: "14:00",
      tenantPhone: "01077778888",
      landlordPhone: "01066667777",
      hasPartnerAgency: true,
      partnerAgency: {
        name: "잠실 협력공인",
        phone: "0255556666",
        dong: "잠실동",
      },
      dealType: "매매",
      roomType: "쓰리룸",
      deposit: 62000,
      monthlyRent: 0,
      maintenanceFee: 15,
      maintenanceIncludes: ["청소", "주차", "인터넷"],
      parkingType: "유",
      parkingFeeType: "포함",
      parkingFee: 0,
      petAllowed: "무",
      elevator: true,
      options: ["에어컨", "냉장고", "세탁기", "가스레인지"],
      moveInFrom: daysFromToday(90),
      moveInTo: daysFromToday(120),
      moveInSingle: false,
      moveInDate: formatMoveInRange(daysFromToday(90), daysFromToday(120)),
      insuranceType: "유",
      notes: "남서향 · 고층 · 입주협의",
      createdAt: iso(1000 * 60 * 30),
    }),
  ];

  const filled = (extra) =>
    makeProperty({
      floorPassword: "1234",
      roomPassword: "5678",
      tenantPhone: "01011112222",
      landlordPhone: "01022221111",
      hasPartnerAgency: true,
      partnerAgency: {
        name: "테스트부동산",
        phone: "0211112222",
        dong: "성내동",
      },
      maintenanceFee: 10,
      maintenanceIncludes: ["인터넷", "수도"],
      parkingType: "유",
      parkingFeeType: "별도",
      parkingFee: 5,
      petAllowed: "무",
      elevator: true,
      options: ["에어컨", "냉장고", "세탁기"],
      insuranceType: "유",
      notes: "테스트 매물 · 입력칸 전체 채움",
      ...extra,
    });

  const scheduleProps1 = [
    filled({
      id: "demo_sch_prop_1a",
      address: "서울 강동구 성내동 123-45",
      roomNo: "101동 1203호",
      arriveTime: "10:00",
      partnerAgency: {
        name: "성내동 테스트부동산",
        phone: "0212345678",
        dong: "성내동",
      },
      dealType: "전세",
      roomType: "원룸",
      deposit: 10000,
      monthlyRent: 20,
      maintenanceIncludes: ["인터넷", "TV", "수도"],
      parkingType: "무",
      parkingFee: 0,
      notes: "남향 · 3층 · 즉시입주 · 반전세 협의",
      moveInFrom: daysFromToday(14),
      moveInTo: daysFromToday(45),
      moveInSingle: false,
      moveInDate: formatMoveInRange(daysFromToday(14), daysFromToday(45)),
    }),
    filled({
      id: "demo_sch_prop_1b",
      address: "서울 강동구 천호동 456-7",
      roomNo: "502호",
      arriveTime: "11:30",
      tenantPhone: "01044445555",
      landlordPhone: "01033334444",
      partnerAgency: {
        name: "천호 협력공인",
        phone: "0244445555",
        dong: "천호동",
      },
      dealType: "월세",
      roomType: "투룸",
      deposit: 3000,
      monthlyRent: 75,
      maintenanceIncludes: ["전기", "가스"],
      petAllowed: "유",
      options: ["에어컨", "인덕션", "세탁기"],
      insuranceType: "무",
      notes: "동향 · 반려동물 협의 · 주차 1대",
      moveInFrom: daysFromToday(7),
      moveInTo: daysFromToday(30),
      moveInSingle: false,
      moveInDate: formatMoveInRange(daysFromToday(7), daysFromToday(30)),
    }),
  ];

  const scheduleProps2 = [
    filled({
      id: "demo_sch_prop_2a",
      address: "서울 송파구 잠실동 22",
      roomNo: "1501호",
      arriveTime: "14:00",
      tenantPhone: "01077778888",
      landlordPhone: "01066667777",
      partnerAgency: {
        name: "잠실 협력공인",
        phone: "0255556666",
        dong: "잠실동",
      },
      dealType: "매매",
      roomType: "쓰리룸",
      deposit: 62000,
      monthlyRent: 0,
      maintenanceFee: 15,
      maintenanceIncludes: ["청소", "주차", "인터넷"],
      parkingFeeType: "포함",
      parkingFee: 0,
      options: ["에어컨", "냉장고", "세탁기", "가스레인지"],
      notes: "남서향 · 고층 · 입주협의",
      moveInFrom: daysFromToday(90),
      moveInTo: daysFromToday(120),
      moveInSingle: false,
      moveInDate: formatMoveInRange(daysFromToday(90), daysFromToday(120)),
    }),
  ];

  const scheduleProps3 = [
    filled({
      id: "demo_sch_prop_3a",
      address: "서울 강동구 길동 88",
      roomNo: "301호",
      arriveTime: "16:20",
      floorPassword: "1111",
      roomPassword: "2222",
      tenantPhone: "01000001111",
      landlordPhone: "01099990000",
      partnerAgency: {
        name: "길동 공인중개사",
        phone: "0266667777",
        dong: "길동",
      },
      dealType: "전세",
      roomType: "원룸",
      deposit: 8000,
      monthlyRent: 15,
      maintenanceFee: 7,
      parkingType: "무",
      parkingFee: 0,
      elevator: false,
      options: ["에어컨", "냉장고", "인덕션"],
      notes: "북향 · 저층 · 홍길동 방문 일정",
      moveInFrom: daysFromToday(10),
      moveInTo: daysFromToday(20),
      moveInSingle: false,
      moveInDate: formatMoveInRange(daysFromToday(10), daysFromToday(20)),
    }),
  ];

  const scheduleProps4 = [
    filled({
      id: "demo_sch_prop_4a",
      address: "서울 강동구 성내동 200-1",
      roomNo: "802호",
      arriveTime: "15:00",
      floorPassword: "9876",
      roomPassword: "5432",
      tenantPhone: "01012123434",
      landlordPhone: "01056567878",
      partnerAgency: {
        name: "성내 중앙부동산",
        phone: "0277778888",
        dong: "성내동",
      },
      dealType: "월세",
      roomType: "투룸",
      deposit: 2000,
      monthlyRent: 85,
      maintenanceFee: 9,
      maintenanceIncludes: ["인터넷", "전기", "가스"],
      parkingFeeType: "포함",
      parkingFee: 0,
      petAllowed: "유",
      options: ["에어컨", "냉장고", "세탁기", "인덕션"],
      notes: "이서연 손님 · 주차 포함 · 반려동물 OK",
      moveInFrom: daysFromToday(20),
      moveInTo: daysFromToday(40),
      moveInSingle: false,
      moveInDate: formatMoveInRange(daysFromToday(20), daysFromToday(40)),
    }),
    filled({
      id: "demo_sch_prop_4b",
      address: "서울 강동구 천호동 77-3",
      roomNo: "1004호",
      arriveTime: "16:40",
      floorPassword: "1357",
      roomPassword: "2468",
      tenantPhone: "01034345656",
      landlordPhone: "01078789090",
      partnerAgency: {
        name: "천호역 부동산",
        phone: "0288889999",
        dong: "천호동",
      },
      dealType: "월세",
      roomType: "투룸",
      deposit: 5000,
      monthlyRent: 70,
      maintenanceFee: 12,
      maintenanceIncludes: ["인터넷", "TV", "청소"],
      parkingFee: 8,
      petAllowed: "유",
      options: ["에어컨", "냉장고", "세탁기", "가스레인지"],
      insuranceType: "무",
      notes: "역세권 · 반려동물 협의",
      moveInFrom: daysFromToday(15),
      moveInTo: daysFromToday(35),
      moveInSingle: false,
      moveInDate: formatMoveInRange(daysFromToday(15), daysFromToday(35)),
    }),
  ];

  const schedules = [
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
      customerId: "demo_cust_4",
      visitDate: daysFromToday(0),
      visitTime: "16:00",
      properties: scheduleProps3,
      routeSummary: buildRouteSummary(scheduleProps3),
      createdAt: iso(1000 * 60 * 5),
      updatedAt: iso(1000 * 60 * 5),
    },
    {
      id: "demo_sch_4",
      customerId: "demo_cust_2",
      visitDate: daysFromToday(3),
      visitTime: "14:30",
      properties: scheduleProps4,
      routeSummary: buildRouteSummary(scheduleProps4),
      createdAt: iso(1000 * 60 * 3),
      updatedAt: iso(1000 * 60 * 3),
    },
  ];

  return { customers, properties, schedules };
}

const { data: list } = await supabase.auth.admin.listUsers({
  page: 1,
  perPage: 50,
});
let user = list.users.find((u) => u.email === "test@users.direction.app");

if (!user) {
  const { data: created, error } = await supabase.auth.admin.createUser({
    email: "test@users.direction.app",
    password: "test1234",
    email_confirm: true,
    user_metadata: {
      username: "test",
      shop_name: "테스트부동산",
      display_name: "테스트중개",
      phone: "01012345678",
      password_hint: "테스트",
    },
  });
  if (error) throw error;
  user = created.user;
  await supabase.rpc("admin_upsert_profile", {
    p_id: user.id,
    p_username: "test",
    p_shop_name: "테스트부동산",
    p_display_name: "테스트중개",
    p_phone: "01012345678",
    p_password_hint: "테스트",
  });
}

const userId = user.id;
const { customers, properties, schedules } = buildDemoSeedData();

const { error: cErr } = await supabase.from("customers").upsert(
  customers.map((c) => ({
    id: c.id,
    user_id: userId,
    payload: c,
    created_at: c.createdAt,
    updated_at: c.updatedAt,
  })),
  { onConflict: "user_id,id" }
);
if (cErr) throw cErr;

const { error: pErr } = await supabase.from("listed_properties").upsert(
  properties.map((p) => ({
    id: p.id,
    user_id: userId,
    payload: p,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
  })),
  { onConflict: "user_id,id" }
);
if (pErr) throw pErr;

const { error: sErr } = await supabase.from("schedules").upsert(
  schedules.map((s) => ({
    id: s.id,
    user_id: userId,
    payload: s,
    created_at: s.createdAt,
    updated_at: s.updatedAt,
  })),
  { onConflict: "user_id,id" }
);
if (sErr) throw sErr;

const { error: prErr } = await supabase
  .from("profiles")
  .update({
    demo_seed_version: "demo_v6",
    recent_customer_ids: customers.map((c) => c.id),
  })
  .eq("id", userId);
if (prErr) throw prErr;

console.log("OK user=", userId);
console.log(
  `customers=${customers.length} properties=${properties.length} schedules=${schedules.length}`
);
console.log("login: test / test1234 (hint: 테스트)");
