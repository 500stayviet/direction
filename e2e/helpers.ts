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
    } catch {
      /* ignore */
    }
  });
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
  await page.getByPlaceholder("예: 천호동 (선택)").fill(user.shopName);
  await page.getByPlaceholder("홍길동 (선택)").fill(user.name);
  await page.getByPlaceholder("영문·숫자 4자 이상").fill(user.username);
  await page.getByRole("button", { name: "중복확인" }).click();
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
  const greet = user.name ? `${user.name}님,` : /님,/;
  await expect(page.getByText(greet)).toBeVisible({ timeout: 30_000 });
}

export async function logoutViaHome(page: Page) {
  await prepareAppPage(page);
  await page.goto("/", { waitUntil: "domcontentloaded" });
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
    moveInFrom: "",
    moveInTo: "",
    moveInSingle: false,
    moveInDate: "",
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
