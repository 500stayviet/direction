"use client";

import type { User } from "./types";
import { createClient, resetBrowserClient } from "./supabase/client";
import { normalizeUsername } from "./supabase/email";
import { clearAppAuth, loadAppAuth, saveAppAuth } from "./supabase/appAuth";
import { clearEntityCache, patchCreatedByNameInCache } from "./entityCache";
import { backfillShopName } from "./format";

/** 계정 공유 위험이 있던 예전 공용 키 — 로그인/아웃 시 삭제 */
const LEGACY_SHARED_KEYS = [
  "realty_users",
  "realty_session",
  "realty_customers",
  "realty_schedules",
  "realty_navi_preference",
  "realty_recent_customers",
] as const;

/** 탭 접속 1회 스플래시 — 로그아웃 시에도 유지 */
export const BOOT_SPLASH_DONE_KEY = "realty_boot_splash_done";

let cachedUser: User | null = null;

function canUseStorage(): boolean {
  return typeof window !== "undefined" && !!window.localStorage;
}

/**
 * 계정 전환 시 남는 런타임 캐시 제거.
 * - sessionStorage (스플래시 완료 플래그는 유지 — 로그아웃 후 재표시 방지)
 * - 예전 localStorage 키
 */
/** 예전 공용 키·Supabase 브라우저 토큰 (앱 세션 realty_app_auth 는 유지) */
function clearLegacyAndSupabaseLocalKeys(opts?: {
  includeAccountScopedKeys?: boolean;
}): void {
  if (!canUseStorage()) return;
  for (const k of LEGACY_SHARED_KEYS) {
    localStorage.removeItem(k);
  }
  const toRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    const drop =
      key.startsWith("sb-") ||
      key.includes("auth-token") ||
      (opts?.includeAccountScopedKeys === true && key.startsWith("realty_u_"));
    if (drop) toRemove.push(key);
  }
  for (const key of toRemove) localStorage.removeItem(key);
}

/**
 * 계정 전환 시 남는 런타임 캐시 제거.
 * - sessionStorage (스플래시 완료 플래그는 유지 — 로그아웃 후 재표시 방지)
 * - 예전 localStorage 키
 */
export function clearAuthRuntimeCache(): void {
  cachedUser = null;
  clearAppAuth();
  clearEntityCache();
  void import("./storage")
    .then((m) => m.invalidateWorkspaceIdCache())
    .catch(() => undefined);
  if (typeof window === "undefined") return;
  try {
    const splashDone = sessionStorage.getItem(BOOT_SPLASH_DONE_KEY);
    sessionStorage.clear();
    if (splashDone) {
      sessionStorage.setItem(BOOT_SPLASH_DONE_KEY, splashDone);
    }
  } catch {
    /* ignore */
  }
  clearLegacyAndSupabaseLocalKeys({ includeAccountScopedKeys: true });
  resetBrowserClient();
}

/** 세션·화면 상태를 완전히 비우기 위해 홈으로 하드 이동 */
export function hardRedirectHome(): void {
  if (typeof window === "undefined") return;
  // 캐시된 홈 HTML(304) 때문에 옛 번들이 섞이지 않게 쿼리 부여
  window.location.assign(`/?_=${Date.now()}`);
}

/** 회원가입 완료 후 로그인 화면으로 이동 */
export function hardRedirectLogin(opts?: {
  registered?: boolean;
  username?: string;
}): void {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams();
  if (opts?.registered) params.set("registered", "1");
  if (opts?.username) params.set("username", opts.username);
  const qs = params.toString();
  window.location.replace(qs ? `/login?${qs}` : "/login");
}

let forceReloginStarted = false;

/**
 * 세션이 더 이상 유효하지 않을 때 — 안내 문구 대신 로그인 화면으로 보냄.
 * (이미 /login 이면 무시)
 */
export function forceRelogin(): void {
  if (typeof window === "undefined") return;
  const path = window.location.pathname;
  if (
    path === "/login" ||
    path.startsWith("/login/") ||
    path === "/signup" ||
    path.startsWith("/signup/") ||
    path.startsWith("/admin")
  ) {
    return;
  }
  if (forceReloginStarted) return;
  forceReloginStarted = true;
  clearAuthRuntimeCache();
  hardRedirectLogin();
}

function rowToUser(row: {
  id: string;
  username: string;
  shop_name: string;
  display_name: string;
  phone: string;
  password_hint: string;
  created_at: string;
  matching_enabled?: boolean | null;
  plan_tier?: string | null;
  promo_source?: string | null;
}): User {
  const raw = String(row.shop_name ?? "")
    .trim()
    .replace(/\s+/g, " ");
  const shopName =
    raw && raw !== "현장동선" ? backfillShopName(raw) : raw || "현장동선";
  return {
    id: row.id,
    username: row.username,
    shopName,
    name: row.display_name,
    phone: row.phone,
    passwordHint: row.password_hint,
    createdAt: row.created_at,
    matchingEnabled: row.matching_enabled === false ? false : undefined,
    planTier: row.plan_tier ? String(row.plan_tier) : undefined,
    promoSource: row.promo_source ? String(row.promo_source) : undefined,
  };
}

/** 입력된 업장명에 접미사가 없으면 DB에 한 번 보정 */
function persistShopNameBackfill(
  userId: string,
  rawShop: string,
  nextShop: string
) {
  if (!rawShop || rawShop === "현장동선" || rawShop === nextShop) return;
  void (async () => {
    try {
      const supabase = createClient();
      await supabase
        .from("profiles")
        .update({ shop_name: nextShop })
        .eq("id", userId);
      await supabase.auth.updateUser({
        data: { shop_name: nextShop },
      });
    } catch {
      /* ignore */
    }
  })();
}

export function getCachedUser(): User | null {
  return cachedUser;
}

/** 동기 — 화면 로그인 표시용 (localStorage·쿠키·메모리) */
export function peekCurrentUser(): User | null {
  if (typeof window === "undefined") return null;
  if (cachedUser?.id) {
    const raw = String(cachedUser.shopName ?? "")
      .trim()
      .replace(/\s+/g, " ");
    const shopName =
      raw && raw !== "현장동선" ? backfillShopName(raw) : raw || "현장동선";
    if (shopName !== cachedUser.shopName) {
      cachedUser = { ...cachedUser, shopName };
    }
    return cachedUser;
  }
  const app = loadAppAuth();
  if (app?.user?.id) {
    const raw = String(app.user.shopName ?? "")
      .trim()
      .replace(/\s+/g, " ");
    const shopName =
      raw && raw !== "현장동선" ? backfillShopName(raw) : raw || "현장동선";
    cachedUser =
      shopName !== app.user.shopName
        ? { ...app.user, shopName }
        : app.user;
    return cachedUser;
  }
  return null;
}

/** 서버에서 정지 여부 최신화 후 로컬 세션 반영 */
export async function refreshSuspendedFromServer(
  accessToken: string
): Promise<{ suspended: boolean; reason: string }> {
  try {
    const res = await fetch("/api/auth/account-status", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const body = (await res.json()) as {
      ok?: boolean;
      suspended?: boolean;
      reason?: string | null;
      matchingEnabled?: boolean;
      planTier?: string;
      promoSource?: string | null;
    };
    if (!res.ok || !body.ok) {
      // 401 등은 콘솔 노이즈만 만들지 않고 로컬 상태로 폴백
      const u = peekCurrentUser();
      return {
        suspended: Boolean(u?.suspended),
        reason: u?.suspendedReason ?? "",
      };
    }
    const suspended = Boolean(body.suspended);
    const reason = suspended ? String(body.reason ?? "관리자 정지") : "";
    const matchingEnabled = body.matchingEnabled !== false;
    const planTier = body.planTier ? String(body.planTier) : undefined;
    const promoSource = body.promoSource ? String(body.promoSource) : undefined;
    const current = peekCurrentUser();
    if (current) {
      const next: User = {
        ...current,
        suspended: suspended || undefined,
        suspendedReason: suspended ? reason : undefined,
        matchingEnabled: matchingEnabled ? undefined : false,
        planTier: planTier && planTier !== "free" ? planTier : undefined,
        promoSource,
      };
      cachedUser = next;
      const app = loadAppAuth();
      if (app) {
        saveAppAuth(
          {
            access_token: app.access_token || accessToken,
            refresh_token: app.refresh_token,
          },
          next
        );
      }
    }
    return { suspended, reason };
  } catch {
    const u = peekCurrentUser();
    return {
      suspended: Boolean(u?.suspended),
      reason: u?.suspendedReason ?? "",
    };
  }
}

/** access token이 이 시간보다 더 남았으면 refreshSession 생략 */
const ACCESS_TOKEN_REFRESH_SKEW_MS = 60_000;

function jwtExpiresAtMs(token: string): number | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const json = JSON.parse(
      atob(part.replace(/-/g, "+").replace(/_/g, "/"))
    ) as { exp?: number };
    return typeof json.exp === "number" ? json.exp * 1000 : null;
  } catch {
    return null;
  }
}

function accessTokenStillFresh(token: string): boolean {
  const exp = jwtExpiresAtMs(token);
  if (exp == null) return false;
  return exp - Date.now() > ACCESS_TOKEN_REFRESH_SKEW_MS;
}

/** 네트워크 refresh 없이, 아직 유효한 access_token만 반환 */
export function peekAccessTokenIfFresh(): string | null {
  const fromApp = loadAppAuth()?.access_token?.trim() ?? "";
  if (fromApp && accessTokenStillFresh(fromApp)) return fromApp;
  return null;
}

/** API 호출용 access token — 앱 백업 →(만료 임박 시) 갱신 → Supabase 세션 순으로 확보 */
export async function getAccessToken(): Promise<string | null> {
  const appAuth = loadAppAuth();
  const fromApp = appAuth?.access_token?.trim() ?? "";

  // 유효한 앱 토큰이면 네트워크 없이 바로 사용 (호출마다 refresh/setSession 하지 않음)
  if (fromApp && accessTokenStillFresh(fromApp)) {
    return fromApp;
  }

  const refresh = appAuth?.refresh_token?.trim() ?? "";
  if (!refresh) {
    // access만 남고 갱신 불가 → 만료면 null (호출측이 로그인으로 보냄)
    if (fromApp && accessTokenStillFresh(fromApp)) return fromApp;
    return null;
  }

  try {
    const supabase = createClient();

    // setSession(만료 access)은 GoTrue가 refresh를 시도하며 400을 콘솔에 찍음
    // → refreshSession만 직접 호출
    const refreshed = await supabase.auth.refreshSession({
      refresh_token: refresh,
    });
    const session = refreshed.data.session;
    if (session?.access_token && appAuth?.user) {
      saveAppAuth(
        {
          access_token: session.access_token,
          refresh_token: session.refresh_token || refresh,
        },
        appAuth.user
      );
      return session.access_token;
    }

    // refresh 실패(만료·폐기): 세션 정리 — 죽은 토큰으로 401 알림만 뜨지 않게
    if (refreshed.error) {
      clearAuthRuntimeCache();
      return null;
    }

    const {
      data: { session: existing },
    } = await Promise.race([
      supabase.auth.getSession(),
      new Promise<{ data: { session: null } }>((resolve) =>
        window.setTimeout(() => resolve({ data: { session: null } }), 2000)
      ),
    ]);

    if (existing?.access_token && accessTokenStillFresh(existing.access_token)) {
      const user = appAuth?.user ?? cachedUser;
      if (user) {
        saveAppAuth(
          {
            access_token: existing.access_token,
            refresh_token:
              existing.refresh_token || appAuth?.refresh_token || "",
          },
          user
        );
      }
      return existing.access_token;
    }
  } catch {
    /* ignore */
  }

  if (fromApp && accessTokenStillFresh(fromApp)) return fromApp;
  return null;
}

export async function getSessionUserId(): Promise<string | null> {
  const fromApp = loadAppAuth()?.user.id ?? cachedUser?.id ?? null;
  if (fromApp) return fromApp;
  try {
    const supabase = createClient();
    const { data } = await Promise.race([
      supabase.auth.getSession(),
      new Promise<{ data: { session: null } }>((resolve) =>
        window.setTimeout(() => resolve({ data: { session: null } }), 2000)
      ),
    ]);
    if (data.session?.user?.id) return data.session.user.id;
  } catch {
    /* ignore */
  }
  return null;
}

function userFromAuthSession(authUser: {
  id: string;
  email?: string | null;
  created_at?: string;
  user_metadata?: Record<string, unknown>;
}): User {
  const meta = authUser.user_metadata ?? {};
  const username =
    String(meta.username ?? "").trim() ||
    (authUser.email?.split("@")[0] ?? "user");
  const raw = String(meta.shop_name ?? "")
    .trim()
    .replace(/\s+/g, " ");
  const shopName =
    raw && raw !== "현장동선" ? backfillShopName(raw) : raw || "현장동선";
  return {
    id: authUser.id,
    username,
    shopName,
    name: String(meta.display_name ?? username),
    phone: String(meta.phone ?? ""),
    passwordHint: String(meta.password_hint ?? ""),
    createdAt: authUser.created_at ?? new Date().toISOString(),
    suspended: meta.account_suspended === true || undefined,
    suspendedReason:
      meta.account_suspended === true
        ? String(meta.account_suspended_reason ?? "관리자 정지")
        : undefined,
  };
}

export async function getCurrentUser(): Promise<User | null> {
  // 하드 리로드 후에도 바로 로그인 유지
  const appAuth = loadAppAuth();
  if (appAuth?.user) {
    const raw = String(appAuth.user.shopName ?? "")
      .trim()
      .replace(/\s+/g, " ");
    const shopName =
      raw && raw !== "현장동선" ? backfillShopName(raw) : raw || "현장동선";
    cachedUser =
      shopName !== appAuth.user.shopName
        ? { ...appAuth.user, shopName }
        : appAuth.user;
    if (shopName !== raw && raw && raw !== "현장동선") {
      persistShopNameBackfill(cachedUser.id, raw, shopName);
      saveAppAuth(
        {
          access_token: appAuth.access_token,
          refresh_token: appAuth.refresh_token,
        },
        cachedUser
      );
    }
    // 화면 로그인 유지용 — 백그라운드 토큰 강제 갱신은 하지 않음
    // (만료 refresh_token setSession → 400 콘솔 노이즈 /admin·로그인에서도 발생)
    return cachedUser;
  }

  try {
    const supabase = createClient();
    const {
      data: { session },
    } = await Promise.race([
      supabase.auth.getSession(),
      new Promise<{ data: { session: null } }>((resolve) =>
        window.setTimeout(() => resolve({ data: { session: null } }), 2000)
      ),
    ]);

    if (session?.user) {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select(
            "id, username, shop_name, display_name, phone, password_hint, created_at, matching_enabled, plan_tier, promo_source"
          )
          .eq("id", session.user.id)
          .maybeSingle();

        if (!error && data) {
          const rawShop = String(data.shop_name ?? "")
            .trim()
            .replace(/\s+/g, " ");
          cachedUser = rowToUser(data);
          persistShopNameBackfill(
            data.id,
            rawShop,
            cachedUser.shopName
          );
          saveAppAuth(
            {
              access_token: session.access_token,
              refresh_token: session.refresh_token || "",
            },
            cachedUser
          );
          return cachedUser;
        }
      } catch {
        /* 프로필 조회 실패 시 메타데이터로 표시 */
      }
      cachedUser = userFromAuthSession(session.user);
      saveAppAuth(
        {
          access_token: session.access_token,
          refresh_token: session.refresh_token || "",
        },
        cachedUser
      );
      return cachedUser;
    }

    cachedUser = null;
    return null;
  } catch {
    cachedUser = null;
    return null;
  }
}

export async function isLoggedIn(): Promise<boolean> {
  return !!(await getCurrentUser());
}

export type RegisterInput = {
  shopName?: string;
  name?: string;
  username: string;
  password: string;
  passwordConfirm: string;
  phone?: string;
  passwordHint: string;
  /** 추천인 아이디 또는 프로모 코드 */
  eventCode?: string;
};

export type AuthResult =
  | { ok: true; user: User }
  | { ok: false; message: string };

export async function registerUser(input: RegisterInput): Promise<AuthResult> {
  // 서버 API로 가입 (확인 메일·이메일 rate limit 회피)
  try {
    clearAuthRuntimeCache();
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {
      /* env 없을 때는 무시 — API에서 처리 */
    }

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const body = (await res.json()) as {
      ok?: boolean;
      message?: string;
      user?: User;
    };

    if (!res.ok || !body.ok || !body.user) {
      return {
        ok: false,
        message: body.message ?? "회원가입에 실패했습니다.",
      };
    }

    return { ok: true, user: body.user };
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "회원가입 중 오류가 발생했습니다.";
    return { ok: false, message };
  }
}

export async function loginUser(
  username: string,
  password: string
): Promise<AuthResult> {
  const normalized = normalizeUsername(username);
  const pwd = password.normalize("NFKC").trim();
  if (!normalized || !pwd) {
    return { ok: false, message: "아이디 또는 비밀번호가 올바르지 않습니다." };
  }

  try {
    // 서버에서 인증 후 브라우저 세션에 주입 (모바일/PWA에서 더 안정적)
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: normalized, password: pwd }),
    });
    const body = (await res.json()) as {
      ok?: boolean;
      message?: string;
      session?: { access_token: string; refresh_token: string };
      user?: User;
    };

    if (!res.ok || !body.ok || !body.session || !body.user) {
      return {
        ok: false,
        message: body.message ?? "아이디 또는 비밀번호가 올바르지 않습니다.",
      };
    }

    // 이전 계정 잔여 토큰만 지우고, 새 앱 세션을 먼저 저장
    cachedUser = null;
    clearLegacyAndSupabaseLocalKeys();
    resetBrowserClient();

    // 앱 세션 백업 — 홈 새로고침 후에도 로그인 유지의 핵심
    saveAppAuth(body.session, body.user);
    cachedUser = body.user;

    try {
      const supabase = createClient();
      await Promise.race([
        supabase.auth.setSession({
          access_token: body.session.access_token,
          refresh_token: body.session.refresh_token,
        }),
        new Promise<never>((_, reject) =>
          window.setTimeout(() => reject(new Error("session-timeout")), 2500)
        ),
      ]);

      // 프로필 생성·upsert는 서버(login/register)만 — 클라이언트 upsert는
      // entitlement 트리거/RLS로 400이 나기 쉬워 제거. 힌트·요금만 조회 보강.
      void supabase
        .from("profiles")
        .select("password_hint, matching_enabled, plan_tier, promo_source")
        .eq("id", body.user.id)
        .maybeSingle()
        .then(({ data: prof }) => {
          if (!prof || !cachedUser) return;
          const next = {
            ...cachedUser,
            passwordHint: String(prof.password_hint ?? ""),
            matchingEnabled:
              prof.matching_enabled === false ? false : undefined,
            planTier: prof.plan_tier ? String(prof.plan_tier) : undefined,
            promoSource: prof.promo_source
              ? String(prof.promo_source)
              : undefined,
          };
          cachedUser = next;
          saveAppAuth(body.session!, next);
        });
    } catch {
      /* appAuth 백업으로 충분 — 홈에서 로그인 상태로 표시됨 */
    }

    return { ok: true, user: body.user };
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "로그인 중 오류가 발생했습니다.";
    return { ok: false, message };
  }
}

export async function logoutUser(): Promise<void> {
  // 1) 로컬/쿠키 먼저 삭제 — 화면 로그인 상태의 핵심
  clearAuthRuntimeCache();

  // 2) 서버 쿠키도 만료 (Secure 쿠키 대응)
  try {
    await Promise.race([
      fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }),
      new Promise<void>((resolve) => window.setTimeout(resolve, 800)),
    ]);
  } catch {
    /* ignore */
  }

  // 3) supabase 세션은 짧게만 대기 (느리면 스킵하고 리다이렉트)
  try {
    const supabase = createClient();
    await Promise.race([
      supabase.auth.signOut({ scope: "local" }),
      new Promise<void>((resolve) => window.setTimeout(resolve, 800)),
    ]);
  } catch {
    /* ignore */
  }

  clearAuthRuntimeCache();
}

/** 힌트 확인 후 새 비밀번호 설정 (API + service_role) */
export async function resetPasswordWithHint(
  username: string,
  hint: string,
  newPassword: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const normalized = normalizeUsername(username);
  if (!normalized) {
    return { ok: false, message: "아이디를 입력해 주세요." };
  }
  if (!hint.trim()) {
    return { ok: false, message: "비밀번호 힌트를 입력해 주세요." };
  }
  const nextPassword = newPassword.normalize("NFKC").trim();
  if (!nextPassword || nextPassword.length < 6) {
    return { ok: false, message: "새 비밀번호는 6자 이상이어야 합니다." };
  }

  try {
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: normalized,
        hint: hint.trim(),
        newPassword: nextPassword,
      }),
    });
    const body = (await res.json()) as { ok?: boolean; message?: string };
    if (!res.ok || !body.ok) {
      return {
        ok: false,
        message: body.message ?? "비밀번호를 변경하지 못했습니다.",
      };
    }
    return { ok: true };
  } catch {
    return { ok: false, message: "서버에 연결할 수 없습니다." };
  }
}

export type UpdateProfileInput = {
  shopName?: string;
  name?: string;
  phone?: string;
  passwordHint: string;
};

export async function updateProfile(
  input: UpdateProfileInput
): Promise<AuthResult> {
  const passwordHint = input.passwordHint.trim();
  if (!passwordHint) {
    return { ok: false, message: "비밀번호 힌트를 입력해 주세요." };
  }

  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      forceRelogin();
      return { ok: false, message: "로그인이 필요합니다." };
    }

    const res = await fetch("/api/auth/update-profile", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        shopName: input.shopName,
        name: input.name,
        phone: input.phone,
        passwordHint,
        accessToken,
      }),
    });
    const body = (await res.json()) as {
      ok?: boolean;
      message?: string;
      user?: User;
    };

    if (!res.ok || !body.ok || !body.user) {
      if (res.status === 401) {
        forceRelogin();
        return { ok: false, message: "로그인이 필요합니다." };
      }
      return {
        ok: false,
        message: body.message ?? "정보 수정에 실패했습니다.",
      };
    }

    const nextUser = body.user;
    cachedUser = nextUser;
    const appAuth = loadAppAuth();
    saveAppAuth(
      {
        access_token: accessToken,
        refresh_token: appAuth?.refresh_token || "",
      },
      nextUser
    );
    patchCreatedByNameInCache(nextUser.id, nextUser.name);

    return { ok: true, user: nextUser };
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "정보 수정 중 오류가 발생했습니다.";
    return { ok: false, message };
  }
}

const DELETE_CONFIRM_PHRASE = "계정삭제에 동의합니다";

export async function deleteAccount(
  confirmPhrase: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (confirmPhrase.trim() !== DELETE_CONFIRM_PHRASE) {
    return {
      ok: false,
      message: `「${DELETE_CONFIRM_PHRASE}」를 정확히 입력해 주세요.`,
    };
  }

  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      forceRelogin();
      return { ok: false, message: "로그인이 필요합니다." };
    }

    const res = await fetch("/api/auth/delete-account", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        confirmPhrase: confirmPhrase.trim(),
        accessToken,
      }),
    });
    const body = (await res.json()) as { ok?: boolean; message?: string };

    if (!res.ok || !body.ok) {
      if (res.status === 401) {
        forceRelogin();
        return { ok: false, message: "로그인이 필요합니다." };
      }
      return {
        ok: false,
        message: body.message ?? "계정 삭제에 실패했습니다.",
      };
    }

    clearAuthRuntimeCache();
    return { ok: true };
  } catch {
    return { ok: false, message: "서버에 연결할 수 없습니다." };
  }
}

export { DELETE_CONFIRM_PHRASE };
