"use client";

import type { User } from "./types";
import { createId } from "./id";
import { formatPhoneInput } from "./format";

const USERS_KEY = "realty_users";
const SESSION_KEY = "realty_session";

/** 계정 공유 위험이 있던 예전 공용 키 — 로그인/아웃 시 삭제 */
const LEGACY_SHARED_KEYS = [
  "realty_customers",
  "realty_schedules",
  "realty_navi_preference",
  "realty_recent_customers",
] as const;

function canUseStorage(): boolean {
  return typeof window !== "undefined" && !!window.localStorage;
}

function readUsers(): User[] {
  if (!canUseStorage()) return [];
  try {
    const raw = localStorage.getItem(USERS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as User[];
  } catch {
    return [];
  }
}

function writeUsers(users: User[]): void {
  if (!canUseStorage()) return;
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

/**
 * 계정 전환 시 남는 런타임 캐시 제거.
 * - sessionStorage 전체
 * - 예전 공용 localStorage 키
 * (계정별 realty_u_{id}_* 영구 데이터는 유지)
 */
export function clearAuthRuntimeCache(): void {
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
}

/** 세션·화면 상태를 완전히 비우기 위해 홈으로 하드 이동 */
export function hardRedirectHome(): void {
  if (typeof window === "undefined") return;
  window.location.replace("/");
}

export function getSessionUserId(): string | null {
  if (!canUseStorage()) return null;
  return localStorage.getItem(SESSION_KEY);
}

export function getCurrentUser(): User | null {
  const id = getSessionUserId();
  if (!id) return null;
  return readUsers().find((u) => u.id === id) ?? null;
}

export function isLoggedIn(): boolean {
  return !!getCurrentUser();
}

export function findUserByUsername(username: string): User | undefined {
  return readUsers().find(
    (u) => u.username.toLowerCase() === username.trim().toLowerCase()
  );
}

/** 아이디 + 가입 시 등록한 힌트로 비밀번호 확인 */
export function recoverPassword(
  username: string,
  hint: string
): { ok: true; password: string } | { ok: false; message: string } {
  const user = findUserByUsername(username);
  if (!user) {
    return { ok: false, message: "아이디를 찾을 수 없습니다." };
  }
  if (!hint.trim()) {
    return { ok: false, message: "비밀번호 힌트를 입력해 주세요." };
  }
  if (user.passwordHint.trim() !== hint.trim()) {
    return { ok: false, message: "비밀번호 힌트가 일치하지 않습니다." };
  }
  return { ok: true, password: user.password };
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

export function registerUser(input: RegisterInput): AuthResult {
  const username = input.username.trim();
  const password = input.password;
  const passwordHint = input.passwordHint.trim();
  const shopName = (input.shopName ?? "").trim();
  const name = (input.name ?? "").trim();
  const phone = formatPhoneInput(input.phone ?? "");

  if (!username) return { ok: false, message: "아이디를 입력해 주세요." };
  if (username.length < 4) {
    return { ok: false, message: "아이디는 4자 이상이어야 합니다." };
  }
  if (!password || password.length < 4) {
    return { ok: false, message: "비밀번호는 4자 이상이어야 합니다." };
  }
  if (password !== input.passwordConfirm) {
    return { ok: false, message: "비밀번호 확인이 일치하지 않습니다." };
  }
  if (!passwordHint) {
    return { ok: false, message: "비밀번호 힌트를 입력해 주세요." };
  }
  if (findUserByUsername(username)) {
    return { ok: false, message: "이미 사용 중인 아이디입니다." };
  }

  const user: User = {
    id: createId("user"),
    shopName: shopName || "현장동선",
    name: name || username,
    username,
    password,
    phone,
    passwordHint,
    createdAt: new Date().toISOString(),
  };

  // 이전 세션/공용 캐시 제거 후 새 세션
  clearAuthRuntimeCache();
  localStorage.removeItem(SESSION_KEY);

  const users = readUsers();
  users.push(user);
  writeUsers(users);
  localStorage.setItem(SESSION_KEY, user.id);
  return { ok: true, user };
}

export function loginUser(username: string, password: string): AuthResult {
  const user = findUserByUsername(username);
  if (!user || user.password !== password) {
    return { ok: false, message: "아이디 또는 비밀번호가 올바르지 않습니다." };
  }
  // 이전 계정 런타임 캐시·세션 제거 후 새 세션
  clearAuthRuntimeCache();
  localStorage.removeItem(SESSION_KEY);
  localStorage.setItem(SESSION_KEY, user.id);
  return { ok: true, user };
}

export function logoutUser(): void {
  if (!canUseStorage()) return;
  localStorage.removeItem(SESSION_KEY);
  clearAuthRuntimeCache();
}
