"use client";

import type { User } from "./types";
import { createClient, resetBrowserClient } from "./supabase/client";
import { normalizeUsername } from "./supabase/email";
import { clearAppAuth, loadAppAuth, saveAppAuth } from "./supabase/appAuth";
import { clearEntityCache } from "./entityCache";

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
export function clearAuthRuntimeCache(): void {
  cachedUser = null;
  clearAppAuth();
  clearEntityCache();
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
  if (!canUseStorage()) return;
  for (const k of LEGACY_SHARED_KEYS) {
    localStorage.removeItem(k);
  }
  // 계정별 예전 로컬 데이터 키 + supabase auth 토큰 정리
  const toRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (
      key?.startsWith("realty_u_") ||
      key?.startsWith("sb-") ||
      key?.includes("auth-token")
    ) {
      toRemove.push(key);
    }
  }
  for (const key of toRemove) localStorage.removeItem(key);
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

function rowToUser(row: {
  id: string;
  username: string;
  shop_name: string;
  display_name: string;
  phone: string;
  password_hint: string;
  created_at: string;
}): User {
  return {
    id: row.id,
    username: row.username,
    shopName: row.shop_name,
    name: row.display_name,
    phone: row.phone,
    passwordHint: row.password_hint,
    createdAt: row.created_at,
  };
}

export function getCachedUser(): User | null {
  return cachedUser;
}

/** 동기 — 화면 로그인 표시용 (localStorage·쿠키·메모리) */
export function peekCurrentUser(): User | null {
  if (typeof window === "undefined") return null;
  if (cachedUser?.id) return cachedUser;
  const app = loadAppAuth();
  if (app?.user?.id) {
    cachedUser = app.user;
    return cachedUser;
  }
  return null;
}

/** API 호출용 access token — 앱 백업 → 갱신 → Supabase 세션 순으로 확보 */
export async function getAccessToken(): Promise<string | null> {
  const appAuth = loadAppAuth();
  const fromApp = appAuth?.access_token?.trim() ?? "";

  try {
    const supabase = createClient();

    // 앱에 토큰이 있으면 세션에 먼저 올려 RLS가 anon으로 떨어지지 않게 함
    if (fromApp && appAuth?.refresh_token?.trim()) {
      try {
        await Promise.race([
          supabase.auth.setSession({
            access_token: fromApp,
            refresh_token: appAuth.refresh_token,
          }),
          new Promise<void>((resolve) => window.setTimeout(resolve, 2000)),
        ]);
      } catch {
        /* refresh 시도 */
      }
    }

    if (fromApp) {
      // 만료됐을 수 있어 refresh 한 번 시도
      if (appAuth?.refresh_token?.trim()) {
        const refreshed = await supabase.auth.refreshSession({
          refresh_token: appAuth.refresh_token,
        });
        const session = refreshed.data.session;
        if (session?.access_token && appAuth.user) {
          saveAppAuth(
            {
              access_token: session.access_token,
              refresh_token: session.refresh_token || appAuth.refresh_token,
            },
            appAuth.user
          );
          return session.access_token;
        }
      }
      return fromApp;
    }

    if (appAuth?.refresh_token?.trim()) {
      const refreshed = await supabase.auth.refreshSession({
        refresh_token: appAuth.refresh_token,
      });
      const session = refreshed.data.session;
      if (session?.access_token && appAuth.user) {
        saveAppAuth(
          {
            access_token: session.access_token,
            refresh_token: session.refresh_token || appAuth.refresh_token,
          },
          appAuth.user
        );
        return session.access_token;
      }
    }

    const {
      data: { session },
    } = await Promise.race([
      supabase.auth.getSession(),
      new Promise<{ data: { session: null } }>((resolve) =>
        window.setTimeout(() => resolve({ data: { session: null } }), 2000)
      ),
    ]);

    if (session?.access_token) {
      const user = appAuth?.user ?? cachedUser;
      if (user) {
        saveAppAuth(
          {
            access_token: session.access_token,
            refresh_token:
              session.refresh_token || appAuth?.refresh_token || "",
          },
          user
        );
      }
      return session.access_token;
    }
  } catch {
    /* ignore */
  }

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
  return {
    id: authUser.id,
    username,
    shopName: String(meta.shop_name ?? "현장동선"),
    name: String(meta.display_name ?? username),
    phone: String(meta.phone ?? ""),
    passwordHint: String(meta.password_hint ?? ""),
    createdAt: authUser.created_at ?? new Date().toISOString(),
  };
}

export async function getCurrentUser(): Promise<User | null> {
  // 하드 리로드 후에도 바로 로그인 유지
  const appAuth = loadAppAuth();
  if (appAuth?.user) {
    cachedUser = appAuth.user;
    // 토큰 복구 시도 — 실패해도 화면 로그인(내정보/로그아웃)은 유지
    // (쿠키만 있는 경우 clear 하면 홈이 비로그인으로 깜빡이거나 고정됨)
    void getAccessToken().catch(() => undefined);
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
            "id, username, shop_name, display_name, phone, password_hint, created_at"
          )
          .eq("id", session.user.id)
          .maybeSingle();

        if (!error && data) {
          cachedUser = rowToUser(data);
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
    if (canUseStorage()) {
      for (const k of LEGACY_SHARED_KEYS) localStorage.removeItem(k);
      const toRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (
          key?.startsWith("sb-") ||
          key?.includes("auth-token")
        ) {
          toRemove.push(key);
        }
      }
      for (const key of toRemove) localStorage.removeItem(key);
    }
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
      void supabase
        .from("profiles")
        .upsert({
          id: body.user.id,
          username: body.user.username,
          shop_name: body.user.shopName,
          display_name: body.user.name,
          phone: body.user.phone,
          password_hint: body.user.passwordHint,
        })
        .then(() => undefined);
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
    const appAuth = loadAppAuth();
    const accessToken = appAuth?.access_token?.trim() ?? "";
    if (!accessToken) {
      return {
        ok: false,
        message: "로그인이 필요합니다. 다시 로그인해 주세요.",
      };
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
      return {
        ok: false,
        message: body.message ?? "정보 수정에 실패했습니다.",
      };
    }

    const nextUser = body.user;
    cachedUser = nextUser;
    if (appAuth?.refresh_token) {
      saveAppAuth(
        {
          access_token: appAuth.access_token,
          refresh_token: appAuth.refresh_token,
        },
        nextUser
      );
    }

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
    const appAuth = loadAppAuth();
    const accessToken = appAuth?.access_token?.trim() ?? "";
    if (!accessToken) {
      return {
        ok: false,
        message: "로그인이 필요합니다. 다시 로그인해 주세요.",
      };
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
      return {
        ok: false,
        message: body.message ?? "회원 탈퇴에 실패했습니다.",
      };
    }

    clearAuthRuntimeCache();
    return { ok: true };
  } catch {
    return { ok: false, message: "서버에 연결할 수 없습니다." };
  }
}

export { DELETE_CONFIRM_PHRASE };
