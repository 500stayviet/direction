"use client";

import type { User } from "./types";
import { formatPhoneInput } from "./format";
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
  const username = normalizeUsername(input.username);
  const password = input.password;
  const passwordHint = input.passwordHint.trim();
  const shopName = (input.shopName ?? "").trim() || "현장동선";
  const name = (input.name ?? "").trim() || username;
  const phone = formatPhoneInput(input.phone ?? "");

  if (!username) return { ok: false, message: "아이디를 입력해 주세요." };
  if (username.length < 4) {
    return { ok: false, message: "아이디는 4자 이상이어야 합니다." };
  }
  if (!/^[a-z0-9._-]+$/.test(username)) {
    return {
      ok: false,
      message: "아이디는 영문 소문자, 숫자, . _ - 만 사용할 수 있습니다.",
    };
  }
  if (!password || password.length < 6) {
    return { ok: false, message: "비밀번호는 6자 이상이어야 합니다." };
  }
  if (password !== input.passwordConfirm) {
    return { ok: false, message: "비밀번호 확인이 일치하지 않습니다." };
  }
  if (!passwordHint) {
    return { ok: false, message: "비밀번호 힌트를 입력해 주세요." };
  }

  try {
    const supabase = createClient();

    const { data: taken, error: takenError } = await supabase.rpc(
      "username_taken",
      { p_username: username }
    );
    if (takenError) {
      return {
        ok: false,
        message:
          "서버 연결을 확인해 주세요. (.env.local · SQL 마이그레이션)",
      };
    }
    if (taken) {
      return { ok: false, message: "이미 사용 중인 아이디입니다." };
    }

    clearAuthRuntimeCache();
    await supabase.auth.signOut();

    const email = usernameToEmail(username);
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp(
      {
        email,
        password,
        options: {
          data: {
            username,
            shop_name: shopName,
            display_name: name,
          },
        },
      }
    );

    if (signUpError) {
      if (signUpError.message.toLowerCase().includes("already")) {
        return { ok: false, message: "이미 사용 중인 아이디입니다." };
      }
      return { ok: false, message: signUpError.message };
    }

    const authUser = signUpData.user;
    if (!authUser) {
      return {
        ok: false,
        message:
          "가입은 되었지만 세션이 없습니다. 이메일 확인을 끄고 다시 시도해 주세요.",
      };
    }

    // 이메일 확인이 켜져 있으면 세션이 없을 수 있음 → 즉시 로그인 시도
    if (!signUpData.session) {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) {
        return {
          ok: false,
          message:
            "가입되었습니다. Authentication → Confirm email 을 끈 뒤 로그인해 주세요.",
        };
      }
    }

    const { error: profileError } = await supabase.from("profiles").upsert({
      id: authUser.id,
      username,
      shop_name: shopName,
      display_name: name,
      phone,
      password_hint: passwordHint,
    });

    if (profileError) {
      return {
        ok: false,
        message: `프로필 저장 실패: ${profileError.message}`,
      };
    }

    const user = await getCurrentUser();
    if (!user) {
      return { ok: false, message: "가입 후 프로필을 불러오지 못했습니다." };
    }
    return { ok: true, user };
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
