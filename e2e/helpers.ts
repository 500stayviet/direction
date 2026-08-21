import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomBytes, randomUUID } from "crypto";

export type TestUser = {
  username: string;
  password: string;
  passwordHint: string;
  shopName: string;
  name: string;
};

/** 부트 스플래시·AuthGate invisible 대기 회피 */
export async function prepareAppPage(page: Page) {
  await page.addInitScript(() => {
    try {
      sessionStorage.setItem("realty_boot_splash_done", "1");
      const granted = String(Date.now());
      localStorage.setItem("direction.deviceConsent.microphone", granted);
      localStorage.setItem("direction.deviceConsent.photos", granted);
    } catch {
      /* ignore */
    }
  });
}

/** 마이크·사진 앱 안내 모달이 있으면 허용 */
export async function allowDeviceConsentIfShown(page: Page) {
  const heading = page.getByRole("heading", { name: /허용하시겠습니까/ });
  try {
    await heading.waitFor({ state: "visible", timeout: 4000 });
    await page.getByRole("button", { name: "허용", exact: true }).click();
    await heading.waitFor({ state: "hidden", timeout: 4000 });
  } catch {
    /* already granted this month */
  }
}

export function hasE2eBackendEnv(): boolean {
  return Boolean(
    (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim() &&
      (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim() &&
      (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim()
  );
}

export function requireE2eBackendEnv(test: { skip: () => void }) {
  if (!hasE2eBackendEnv()) {
    test.skip();
  }
}

export function uniqueUser(prefix = "e2e"): TestUser {
  const suffix = randomBytes(3).toString("hex");
  return {
    username: `${prefix}${suffix}`,
    password: "testpass1",
    passwordHint: "e2e-hint",
    shopName: `이투이${suffix}`,
    name: `테스터${suffix}`,
  };
}

export async function fillSignupForm(page: Page, user: TestUser) {
  await page.getByPlaceholder("예: 천호동").fill(user.shopName);
  await page.getByPlaceholder("홍길동").fill(user.name);
  const usernameInput = page.getByPlaceholder("영문·숫자 4자 이상");
  await usernameInput.fill(user.username);
  const checkBtn = page.getByRole("button", { name: "중복확인" });
  await expect(checkBtn).toBeEnabled({ timeout: 10_000 });
  await checkBtn.click();
  await expect(page.getByText("사용 가능한 아이디")).toBeVisible();
  await page.getByPlaceholder("6자 이상").fill(user.password);
  await page.getByPlaceholder("비밀번호 다시 입력").fill(user.password);
  await page
    .getByPlaceholder("본인만 알아볼 수 있는 힌트")
    .fill(user.passwordHint);
  await page
    .locator('label:has-text("동의합니다") input[type="checkbox"]')
    .check();
}

export async function fillLoginForm(
  page: Page,
  user: Pick<TestUser, "username" | "password">
) {
  await page.getByPlaceholder("아이디를 입력하세요").fill(user.username);
  await page.getByPlaceholder("비밀번호를 입력하세요").fill(user.password);
}

export async function signupViaUi(page: Page, user: TestUser) {
  await prepareAppPage(page);
  await page.goto("/signup");
  // AuthGate booted 전환까지 대기 (invisible 해제)
  await expect(page.getByPlaceholder("영문·숫자 4자 이상")).toBeVisible({
    timeout: 30_000,
  });
  await fillSignupForm(page, user);
  await page.getByRole("button", { name: "가입하고 시작하기" }).click();
  await expect(page).toHaveURL(/\/login/, { timeout: 30_000 });
  await expect(page.getByText("회원가입이 완료되었습니다")).toBeVisible();
}

export async function loginViaUi(
  page: Page,
  user: Pick<TestUser, "username" | "password"> & { name?: string }
) {
  await prepareAppPage(page);
  try {
    await page.goto("/login", { waitUntil: "domcontentloaded" });
  } catch (err) {
    // hardRedirect 직후 navigation abort 가능
    if (!String(err).includes("ERR_ABORTED")) throw err;
    await page.goto("/login", { waitUntil: "domcontentloaded" });
  }
  await expect(page.getByPlaceholder("아이디를 입력하세요")).toBeVisible({
    timeout: 30_000,
  });
  await fillLoginForm(page, user);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL(/\/(\?|$)/);
  await expect(
    page.locator("button").filter({ hasText: /^로그아웃$/ })
  ).toBeVisible({ timeout: 45_000 });
  await dismissHomeModalsIfShown(page);
}

/** 로그인 후 홈 기능 소개 모달이 있으면 닫기 */
export async function dismissFeatureIntroIfShown(
  page: Page,
  timeoutMs = 2500
) {
  const heading = page.getByRole("heading", {
    name: "이런 기능을 쓸 수 있어요",
  });
  try {
    await heading.waitFor({ state: "visible", timeout: timeoutMs });
    await page
      .locator("button")
      .filter({ hasText: /^일주일간 보지 않기$/ })
      .click({ timeout: 4000 });
    await heading.waitFor({ state: "hidden", timeout: 4000 });
  } catch {
    /* already dismissed this visit */
  }
}

/** 데모 시드 고객이 있으면 홈에 뜨는 계약 데드라인 모달 */
export async function dismissDeadlineModalIfShown(
  page: Page,
  timeoutMs = 2500
) {
  const heading = page.getByRole("heading", { name: "마지막 계약 데드라인" });
  try {
    await heading.waitFor({ state: "visible", timeout: timeoutMs });
    await page.getByRole("button", { name: "확인", exact: true }).click();
    await heading.waitFor({ state: "hidden", timeout: 4000 });
  } catch {
    /* none this visit */
  }
}

/** 홈 위 기능소개·데드라인 모달이 로그아웃 등을 가리지 않게 닫기 */
export async function dismissHomeModalsIfShown(page: Page) {
  await dismissFeatureIntroIfShown(page, 4000);
  await dismissDeadlineModalIfShown(page, 2500);
}

export async function logoutViaHome(page: Page) {
  await prepareAppPage(page);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await dismissHomeModalsIfShown(page);
  await page.getByRole("button", { name: "로그아웃" }).click();
  await expect(page.getByRole("link", { name: "로그인" })).toBeVisible({
    timeout: 20_000,
  });
  // hardRedirect 완료 대기
  await page.waitForLoadState("domcontentloaded");
}

export async function getAppAuth(page: Page): Promise<{
  access_token: string;
  user: { id: string; username: string; shopName?: string; name?: string };
} | null> {
  return page.evaluate(() => {
    try {
      const raw = localStorage.getItem("realty_app_auth_v1");
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  });
}

export function requireEnv(name: string): string {
  const v = (process.env[name] ?? "").trim();
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export function serviceSupabase(): SupabaseClient {
  return createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

/** e2e 가입 계정·소유 고객/매물/일정 하드삭제 (테스트 후 DB 적재 방지) */

/** Playwright: Web Speech API mock (대화 입력 E2E) */
export async function prepareIntakeE2ePage(page: Page) {
  await prepareAppPage(page);
  await page.addInitScript(() => {
    class MockSpeechRecognition {
      lang = "ko-KR";
      interimResults = true;
      continuous = true;
      onresult:
        | ((ev: {
            results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
          }) => void)
        | null = null;
      onend: (() => void) | null = null;
      onerror: ((ev?: { error?: string }) => void) | null = null;

      start() {
        (
          window as unknown as {
            __e2eEmitSpeech?: (text: string) => void;
            __e2eEmitSpeechResults?: (
              rows: Array<{ isFinal: boolean; transcript: string }>
            ) => void;
          }
        ).__e2eEmitSpeech = (text: string) => {
          const results = [{ isFinal: true, 0: { transcript: text } }];
          this.onresult?.({ results });
          this.onend?.();
        };
        (
          window as unknown as {
            __e2eEmitSpeechResults?: (
              rows: Array<{ isFinal: boolean; transcript: string }>
            ) => void;
          }
        ).__e2eEmitSpeechResults = (rows) => {
          const results = rows.map((row) => ({
            isFinal: row.isFinal,
            0: { transcript: row.transcript },
          }));
          this.onresult?.({ results });
          this.onend?.();
        };
      }

      stop() {
        this.onend?.();
      }
    }
    (
      window as unknown as {
        webkitSpeechRecognition: new () => MockSpeechRecognition;
      }
    ).webkitSpeechRecognition = MockSpeechRecognition;
    (
      window as unknown as { SpeechRecognition: new () => MockSpeechRecognition }
    ).SpeechRecognition = MockSpeechRecognition;
  });
}

export async function emitTalkStep(page: Page, text: string) {
  await page.evaluate((spoken) => {
    const emit = (
      window as unknown as { __e2eEmitSpeech?: (t: string) => void }
    ).__e2eEmitSpeech;
    if (!emit) {
      throw new Error("mock speech not ready — click 대화 시작 first");
    }
    emit(spoken);
  }, text);
}

/** STT가 동만 final·전체는 interim처럼 쪼개 보낼 때 */
export async function emitTalkSttResults(
  page: Page,
  rows: Array<{ isFinal: boolean; transcript: string }>
) {
  await page.evaluate((spokenRows) => {
    const emit = (
      window as unknown as {
        __e2eEmitSpeechResults?: (
          r: Array<{ isFinal: boolean; transcript: string }>
        ) => void;
      }
    ).__e2eEmitSpeechResults;
    if (!emit) {
      throw new Error("mock speech not ready — click 대화 시작 first");
    }
    emit(spokenRows);
  }, rows);
}

export async function skipTalkSteps(page: Page, count: number) {
  for (let i = 0; i < count; i += 1) {
    await page.getByRole("button", { name: "건너뛰기" }).click();
  }
}

export async function purgeE2eUser(userId: string | null | undefined) {
  if (!userId) return;
  const admin = serviceSupabase();
  for (const table of ["schedules", "listed_properties", "customers"] as const) {
    await admin.from(table).delete().eq("user_id", userId);
  }
  await admin.from("workspace_members").delete().eq("user_id", userId);
  await admin.from("promo_redemptions").delete().eq("user_id", userId);
  await admin.from("referrals").delete().eq("referred_user_id", userId);
  await admin.from("profiles").delete().eq("id", userId);
  await admin.auth.admin.deleteUser(userId);
}

export async function adminLogin(request: APIRequestContext): Promise<string> {
  const res = await request.post("/api/admin/login", {
    data: {
      username: requireEnv("ADMIN_ID"),
      password: requireEnv("ADMIN_PASSWORD"),
    },
  });
  const body = (await res.json()) as {
    ok?: boolean;
    token?: string;
    message?: string;
  };
  if (!res.ok() || !body.ok || !body.token) {
    throw new Error(body.message ?? `admin login failed: ${res.status()}`);
  }
  return body.token;
}

export async function findAccountIdByUsername(
  request: APIRequestContext,
  token: string,
  username: string
): Promise<string> {
  const res = await request.get(
    `/api/admin/accounts?q=${encodeURIComponent(username)}&limit=20`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const body = (await res.json()) as {
    ok?: boolean;
    accounts?: Array<{ id: string; username: string }>;
    message?: string;
  };
  if (!res.ok() || !body.ok) {
    throw new Error(body.message ?? "account search failed");
  }
  const hit = (body.accounts ?? []).find((a) => a.username === username);
  if (!hit) throw new Error(`account not found: ${username}`);
  return hit.id;
}

export async function adminSetSuspended(
  request: APIRequestContext,
  token: string,
  accountId: string,
  suspend: boolean,
  reason = "e2e 정지 테스트"
) {
  const res = await request.post(`/api/admin/accounts/${accountId}`, {
    headers: { Authorization: `Bearer ${token}` },
    data: suspend
      ? { action: "suspend", reason }
      : { action: "unsuspend" },
  });
  const text = await res.text();
  let body: { ok?: boolean; message?: string } = {};
  try {
    body = text ? (JSON.parse(text) as { ok?: boolean; message?: string }) : {};
  } catch {
    throw new Error(
      `suspend action bad JSON (${res.status()}): ${text.slice(0, 200)}`
    );
  }
  if (!res.ok() || !body.ok) {
    throw new Error(body.message ?? `suspend action failed: ${res.status()}`);
  }
}

export async function fetchWorkspaceId(
  page: Page
): Promise<{ workspaceId: string; shareCode: string }> {
  const auth = await getAppAuth(page);
  if (!auth?.access_token) throw new Error("no app auth");
  const res = await page.request.get("/api/workspace/status", {
    headers: { Authorization: `Bearer ${auth.access_token}` },
  });
  const body = (await res.json()) as {
    ok?: boolean;
    workspace?: {
      workspaceId?: string;
      shareCode?: string;
    };
    message?: string;
  };
  if (!res.ok() || !body.ok || !body.workspace?.workspaceId) {
    throw new Error(body.message ?? "workspace status failed");
  }
  return {
    workspaceId: body.workspace.workspaceId,
    shareCode: String(body.workspace.shareCode ?? ""),
  };
}

export async function insertSharedProperty(opts: {
  ownerUserId: string;
  workspaceId: string;
  marker: string;
  shared?: boolean;
  notes?: string;
}) {
  const admin = serviceSupabase();
  const id = randomUUID();
  const now = new Date().toISOString();
  const shared = opts.shared !== false;
  // 목록에 address가 보이므로 marker를 지번에 넣음 (구·동·본번 형식 유지)
  const jibun = String(Math.floor(1000 + Math.random() * 8999));
  const address = `서울 강동구 천호동 ${jibun}`;
  const payload = {
    id,
    address,
    notes: opts.notes ?? opts.marker,
    roomNo: "101",
    floorPassword: "",
    roomPassword: "",
    arriveTime: "",
    tenantPhone: "01012345678",
    landlordPhone: "",
    hasPartnerAgency: false,
    partnerAgency: { name: "", dong: "", phone: "" },
    roomType: "원룸" as const,
    dealType: "월세" as const,
    deposit: 1000,
    monthlyRent: 50,
    maintenanceFee: 0,
    maintenanceIncludes: [] as string[],
    options: [] as string[],
    petAllowed: "무" as const,
    elevator: false,
    parkingType: "무" as const,
    parkingFeeType: "별도" as const,
    loanAvailable: "무" as const,
    insuranceType: "무" as const,
    landUse: "",
    moveInFrom: "2026-12-01",
    moveInTo: "2026-12-01",
    moveInSingle: true,
    moveInDate: "2026.12.01",
    partnerAgencyShared: false,
    workspaceShared: shared,
    createdAt: now,
    updatedAt: now,
    createdBy: opts.ownerUserId,
    createdByName: "e2e",
  };
  const { error } = await admin.from("listed_properties").insert({
    id,
    user_id: opts.ownerUserId,
    workspace_id: opts.workspaceId,
    created_by: opts.ownerUserId,
    created_by_name: "e2e",
    workspace_shared: shared,
    payload,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  });
  if (error) throw new Error(`insert property: ${error.message}`);
  return { id, address, marker: opts.marker, jibun };
}

/** 매물 리스트 카드에 보이는 주소(서울·서울시·서울특별시 제외) */
export function listCardAddress(address: string): string {
  return address
    .trim()
    .replace(/^서울특별시\s+/, "")
    .replace(/^서울시\s+/, "")
    .replace(/^서울\s+/, "")
    .trim();
}

/** 원룸 등 고객을 DB에 직접 넣고 상세 표시를 검증할 때 사용 */
export async function insertCustomer(opts: {
  ownerUserId: string;
  workspaceId?: string | null;
  name: string;
  phone?: string;
  roomType?: string;
  preferredGus?: string[];
  preferredDongs?: string[];
  landCategory?: string;
}) {
  const admin = serviceSupabase();
  const id = randomUUID();
  const now = new Date().toISOString();
  const roomType = opts.roomType ?? "원룸";
  const preferredGus = opts.preferredGus ?? ["강동구"];
  const preferredDongs = opts.preferredDongs ?? ["강동구|성내동"];
  const payload = {
    id,
    name: opts.name,
    phone: opts.phone ?? "010-9999-8877",
    dealType: "월세" as const,
    roomType,
    deposit: 1000,
    depositTo: 1000,
    depositSingle: true,
    monthlyRent: 50,
    monthlyRentTo: 50,
    monthlyRentSingle: true,
    budget: "보증금 1,000 · 월 50",
    moveInFrom: "2026-12-01",
    moveInTo: "2026-12-01",
    moveInSingle: true,
    moveInDate: "2026.12.01",
    nonOccupancy: false,
    loanNeeded: "무" as const,
    loanType: "해당없음",
    insuranceNeeded: "무" as const,
    elevatorNeeded: "무" as const,
    parkingType: "무" as const,
    petAllowed: "무" as const,
    notes: "e2e preferred location",
    landCategory: opts.landCategory,
    preferredGus,
    preferredDongs,
    workspaceShared: false,
    createdAt: now,
    updatedAt: now,
    createdBy: opts.ownerUserId,
    createdByName: "e2e",
  };
  const { error } = await admin.from("customers").insert({
    id,
    user_id: opts.ownerUserId,
    workspace_id: opts.workspaceId ?? null,
    created_by: opts.ownerUserId,
    created_by_name: "e2e",
    workspace_shared: false,
    payload,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  });
  if (error) throw new Error(`insert customer: ${error.message}`);
  return { id, preferredGus, preferredDongs, roomType };
}

/** 네비·일정 상세 E2E — DB에 방문 일정 직접 삽입 */
export async function insertSchedule(opts: {
  ownerUserId: string;
  workspaceId?: string | null;
  customerId?: string;
  guestName?: string;
  visitDate?: string;
  visitTime?: string;
}) {
  const admin = serviceSupabase();
  const id = randomUUID();
  const now = new Date().toISOString();
  const jibun = String(Math.floor(1000 + Math.random() * 8999));
  const address = `서울 강동구 성내동 ${jibun}`;
  const propertyId = randomUUID();
  const property = {
    id: propertyId,
    address,
    roomNo: "",
    buildingName: "",
    floorPassword: "",
    roomPassword: "",
    arriveTime: opts.visitTime ?? "14:00",
    tenantPhone: "01012345678",
    landlordPhone: "",
    hasPartnerAgency: false,
    partnerAgency: { name: "", dong: "", phone: "" },
    roomType: "원룸" as const,
    dealType: "전세" as const,
    deposit: 1000,
    monthlyRent: undefined,
    maintenanceFee: 0,
    maintenanceIncludes: [] as string[],
    options: [] as string[],
    petAllowed: "무" as const,
    elevator: false,
    parkingType: "무" as const,
    parkingFeeType: "별도" as const,
    loanAvailable: "무" as const,
    insuranceType: "무" as const,
    landUse: "",
    moveInFrom: "",
    moveInTo: "",
    moveInSingle: false,
    moveInDate: "협의가능",
    moveInNegotiable: true,
    moveInVacant: false,
    partnerAgencyShared: false,
    workspaceShared: false,
    createdAt: now,
    updatedAt: now,
  };
  const payload = {
    id,
    customerId: opts.customerId,
    guestName: opts.guestName,
    visitDate: opts.visitDate ?? now.slice(0, 10),
    visitTime: opts.visitTime ?? "14:00",
    properties: [property],
    routeSummary: [] as Array<{
      fromIndex: number;
      toIndex: number;
      distanceKm: number;
      durationMin: number;
    }>,
    workspaceShared: false,
    createdAt: now,
    updatedAt: now,
    createdBy: opts.ownerUserId,
    createdByName: "e2e",
  };
  const { error } = await admin.from("schedules").insert({
    id,
    user_id: opts.ownerUserId,
    workspace_id: opts.workspaceId ?? null,
    created_by: opts.ownerUserId,
    created_by_name: "e2e",
    workspace_shared: false,
    payload,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  });
  if (error) throw new Error(`insert schedule: ${error.message}`);
  return { id, address, propertyId };
}

/** 리스트 알람 뱃지(팀공유·매칭 등) 대기 */
export async function expectListBadge(page: Page, label: string) {
  await expect(page.getByText(label, { exact: true }).first()).toBeVisible({
    timeout: 30_000,
  });
}

export async function expectNoListBadge(page: Page, label: string) {
  await expect(page.getByText(label, { exact: true })).toHaveCount(0, {
    timeout: 10_000,
  });
}

/** 동일 계정 own 매칭 — createdAt으로 알람 쪽 결정 */
export async function insertOwnMatchingPair(opts: {
  userId: string;
  workspaceId?: string | null;
  customerCreatedAt: string;
  propertyCreatedAt: string;
}) {
  const admin = serviceSupabase();
  const customerId = randomUUID();
  const propertyId = randomUUID();
  const jibun = String(Math.floor(1000 + Math.random() * 8999));
  const address = `서울 강동구 천호동 ${jibun}`;

  const customerPayload = {
    id: customerId,
    name: "매칭고객",
    phone: "010-2222-3333",
    dealType: "월세" as const,
    roomType: "원룸" as const,
    depositFrom: 1000,
    depositTo: 1000,
    depositSingle: true,
    monthlyRentFrom: 50,
    monthlyRentTo: 50,
    monthlyRentSingle: true,
    preferredGus: ["강동구"],
    preferredDongs: ["강동구|천호동"],
    loanNeeded: "무" as const,
    insuranceNeeded: "무" as const,
    parkingType: "무" as const,
    petAllowed: "무" as const,
    elevatorNeeded: "무" as const,
    moveInFrom: "2026-12-01",
    moveInTo: "2026-12-01",
    moveInSingle: true,
    workspaceShared: false,
    createdAt: opts.customerCreatedAt,
    updatedAt: opts.customerCreatedAt,
    createdBy: opts.userId,
    createdByName: "e2e",
  };

  const propertyPayload = {
    id: propertyId,
    address,
    roomNo: "101",
    roomType: "원룸" as const,
    dealType: "월세" as const,
    deposit: 1000,
    monthlyRent: 50,
    maintenanceFee: 0,
    petAllowed: "무" as const,
    parkingType: "무" as const,
    loanAvailable: "무" as const,
    insuranceType: "무" as const,
    elevator: false,
    moveInFrom: "2026-12-01",
    moveInTo: "2026-12-01",
    moveInSingle: true,
    workspaceShared: false,
    createdAt: opts.propertyCreatedAt,
    updatedAt: opts.propertyCreatedAt,
    createdBy: opts.userId,
    createdByName: "e2e",
  };

  const customerRow = {
    id: customerId,
    user_id: opts.userId,
    workspace_id: opts.workspaceId ?? null,
    created_by: opts.userId,
    created_by_name: "e2e",
    workspace_shared: false,
    payload: customerPayload,
    created_at: opts.customerCreatedAt,
    updated_at: opts.customerCreatedAt,
    deleted_at: null,
  };
  const propertyRow = {
    id: propertyId,
    user_id: opts.userId,
    workspace_id: opts.workspaceId ?? null,
    created_by: opts.userId,
    created_by_name: "e2e",
    workspace_shared: false,
    payload: propertyPayload,
    created_at: opts.propertyCreatedAt,
    updated_at: opts.propertyCreatedAt,
    deleted_at: null,
  };

  const cRes = await admin.from("customers").insert(customerRow);
  if (cRes.error) throw new Error(cRes.error.message);
  const pRes = await admin.from("listed_properties").insert(propertyRow);
  if (pRes.error) throw new Error(pRes.error.message);

  return { customerId, propertyId, address };
}

/** 멤버 고객 + 오너 비공유 매물 (사이트내 매칭) */
export async function insertSiteMatchPair(opts: {
  memberUserId: string;
  ownerUserId: string;
  workspaceId: string;
}) {
  const admin = serviceSupabase();
  const customerId = randomUUID();
  const propertyId = randomUUID();
  const now = new Date().toISOString();
  const jibun = String(Math.floor(1000 + Math.random() * 8999));
  const address = `서울 강동구 천호동 ${jibun}`;

  const customerPayload = {
    id: customerId,
    name: "사이트고객",
    phone: "010-3333-4444",
    dealType: "월세" as const,
    roomType: "원룸" as const,
    depositFrom: 1000,
    depositTo: 1000,
    depositSingle: true,
    monthlyRentFrom: 50,
    monthlyRentTo: 50,
    monthlyRentSingle: true,
    preferredGus: ["강동구"],
    preferredDongs: ["강동구|천호동"],
    loanNeeded: "무" as const,
    insuranceNeeded: "무" as const,
    parkingType: "무" as const,
    petAllowed: "무" as const,
    elevatorNeeded: "무" as const,
    moveInFrom: "2026-12-01",
    moveInTo: "2026-12-01",
    moveInSingle: true,
    workspaceShared: false,
    createdAt: now,
    updatedAt: now,
    createdBy: opts.memberUserId,
    createdByName: "e2e",
  };

  const propertyPayload = {
    id: propertyId,
    address,
    roomNo: "101",
    roomType: "원룸" as const,
    dealType: "월세" as const,
    deposit: 1000,
    monthlyRent: 50,
    maintenanceFee: 0,
    petAllowed: "무" as const,
    parkingType: "무" as const,
    loanAvailable: "무" as const,
    insuranceType: "무" as const,
    elevator: false,
    moveInFrom: "2026-12-01",
    moveInTo: "2026-12-01",
    moveInSingle: true,
    workspaceShared: false,
    createdAt: now,
    updatedAt: now,
    createdBy: opts.ownerUserId,
    createdByName: "e2e",
  };

  const cRes = await admin.from("customers").insert({
    id: customerId,
    user_id: opts.memberUserId,
    workspace_id: opts.workspaceId,
    created_by: opts.memberUserId,
    created_by_name: "e2e",
    workspace_shared: false,
    payload: customerPayload,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  });
  if (cRes.error) throw new Error(cRes.error.message);

  const pRes = await admin.from("listed_properties").insert({
    id: propertyId,
    user_id: opts.ownerUserId,
    workspace_id: opts.workspaceId,
    created_by: opts.ownerUserId,
    created_by_name: "e2e",
    workspace_shared: false,
    payload: propertyPayload,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  });
  if (pRes.error) throw new Error(pRes.error.message);

  return { customerId, propertyId, address };
}

