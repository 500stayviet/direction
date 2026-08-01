"use client";

import type { User } from "./types";
import { createClient } from "./supabase/client";
import { normalizeUsername, usernameToEmail } from "./supabase/email";

/** 계정 공유 위험이 있던 예전 공용 키 — 로그인/아웃 시 삭제 */
const LEGACY_SHARED_KEYS = [
  "realty_users",
  "realty_session",
  "realty_customers",
  "realty_schedules",
  "realty_navi_preference",
  "realty_recent_customers",
] as const;

let cachedUser: User | null = null;

function canUseStorage(): boolean {
  return typeof window !== "undefined" && !!window.localStorage;
}

/**
 * 계정 전환 시 남는 런타임 캐시 제거.
 * - sessionStorage 전체
 * - 예전 localStorage 키
 */
export function clearAuthRuntimeCache(): void {
  cachedUser = null;
  if (typeof window === "undefined") return;
  try {
    sessionStorage.clear();
  } catch {
    /* ignore */
  }
  if (!canUseStorage()) return;
  for (const k of LEGACY_SHARED_KEYS) {
    localStorage.removeItem(k);
  }
  // 계정별 예전 로컬 데이터 키 정리
  const toRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith("realty_u_")) toRemove.push(key);
  }
  for (const key of toRemove) localStorage.removeItem(key);
}

/** 세션·화면 상태를 완전히 비우기 위해 홈으로 하드 이동 */
export function hardRedirectHome(): void {
  if (typeof window === "undefined") return;
  window.location.replace("/");
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

export async function getSessionUserId(): Promise<string | null> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) {
      cachedUser = null;
      return null;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select(
        "id, username, shop_name, display_name, phone, password_hint, created_at"
      )
      .eq("id", session.user.id)
      .maybeSingle();

    if (error || !data) {
      cachedUser = null;
      return null;
    }

    cachedUser = rowToUser(data);
    return cachedUser;
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
  if (!normalized || !password) {
    return { ok: false, message: "아이디 또는 비밀번호가 올바르지 않습니다." };
  }

  try {
    const supabase = createClient();
    clearAuthRuntimeCache();
    await supabase.auth.signOut();

    const { error } = await supabase.auth.signInWithPassword({
      email: usernameToEmail(normalized),
      password,
    });

    if (error) {
      return { ok: false, message: "아이디 또는 비밀번호가 올바르지 않습니다." };
    }

    const user = await getCurrentUser();
    if (!user) {
      return {
        ok: false,
        message: "로그인됐지만 프로필이 없습니다. 다시 가입해 주세요.",
      };
    }
    return { ok: true, user };
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "로그인 중 오류가 발생했습니다.";
    return { ok: false, message };
  }
}

export async function logoutUser(): Promise<void> {
  try {
    const supabase = createClient();
    await supabase.auth.signOut();
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
  if (!newPassword || newPassword.length < 6) {
    return { ok: false, message: "새 비밀번호는 6자 이상이어야 합니다." };
  }

  try {
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: normalized,
        hint: hint.trim(),
        newPassword,
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
