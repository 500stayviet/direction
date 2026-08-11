/**
 * 테스트 계정(test) 데이터 전부 삭제 후 체험 시드 삽입
 * 날짜는 실행일(가입·오늘) 기준 — 방문 당일 / 입주 +31일(계약마감 체험)
 * 사용: node scripts/seed-test-account.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const DEMO_SEED_VERSION = "demo_v12";
const DEMO_GANGDONG_OFFICE_ADDRESS = "서울특별시 강동구 성내동 540";
const DEMO_TEST_PHONE = "111-1111-1111";
const CONTRACT_DEADLINE_DAYS = 31;

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

function startOfLocalDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function daysFrom(base, offset) {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + offset);
  return toISODate(d);
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

function buildDemoSeedData(baseDate = startOfLocalDay(new Date())) {
  const base = startOfLocalDay(baseDate);
  const baseMs = base.getTime();
  const iso = (ms) => new Date(baseMs + 12 * 3600_000 - ms).toISOString();

  const visitDate = daysFrom(base, 0);
  const moveInFrom = daysFrom(base, CONTRACT_DEADLINE_DAYS);
  const moveInTo = daysFrom(base, CONTRACT_DEADLINE_DAYS + 14);
  const moveInDate = formatMoveInRange(moveInFrom, moveInTo);
  const propMoveInFrom = daysFrom(base, 14);
  const propMoveInTo = daysFrom(base, CONTRACT_DEADLINE_DAYS + 14);
  const propMoveInDate = formatMoveInRange(propMoveInFrom, propMoveInTo);

  const customers = [
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
    dealType: "전세",
    roomType: "원룸",
    deposit: 10000,
    monthlyRent: 20,
    maintenanceFee: 10,
    maintenanceIncludes: ["인터넷", "TV", "수도", "전기"],
    parkingType: "유",
    parkingFeeType: "별도",
    parkingFee: 5,
    petAllowed: "무",
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

  const properties = [
    makeListed({
      id: "demo_prop_1",
      ...propertyFields,
      createdAt: iso(1000 * 60 * 50),
    }),
  ];

  const scheduleProps = [
    makeProperty({
      id: "demo_sch_prop_1a",
      ...propertyFields,
    }),
  ];

  const schedules = [
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

  return { customers, properties, schedules, visitDate, moveInFrom };
}

const { data: list } = await supabase.auth.admin.listUsers({
  page: 1,
  perPage: 100,
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
      phone: DEMO_TEST_PHONE,
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
    p_phone: DEMO_TEST_PHONE,
    p_password_hint: "테스트",
  });
}

const userId = user.id;
const signupBase = user.created_at
  ? startOfLocalDay(new Date(user.created_at))
  : startOfLocalDay(new Date());
// 체험은 오늘 기준으로 날짜를 맞춤 (가입일이 과거여도 바로 작동)
const base = startOfLocalDay(new Date());

for (const table of ["customers", "listed_properties", "schedules"]) {
  const { error } = await supabase.from(table).delete().eq("user_id", userId);
  if (error) throw error;
}

const { customers, properties, schedules, visitDate, moveInFrom } =
  buildDemoSeedData(base);

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
    demo_seed_version: DEMO_SEED_VERSION,
    recent_customer_ids: customers.map((c) => c.id),
  })
  .eq("id", userId);
if (prErr) throw prErr;

console.log("OK wiped + seeded user=", userId);
console.log(
  `customers=${customers.length} properties=${properties.length} schedules=${schedules.length}`
);
console.log("signupBase=", toISODate(signupBase), "dateBase=", toISODate(base));
console.log("visitDate=", visitDate, "moveInFrom=", moveInFrom, `(deadline D-${CONTRACT_DEADLINE_DAYS})`);
console.log("login: test / test1234 (hint: 테스트)");
