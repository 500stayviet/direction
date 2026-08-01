import type { User } from "@/lib/types";

const APP_AUTH_KEY = "realty_app_auth_v1";
const APP_USER_COOKIE = "realty_app_user_v1";

export type AppAuth = {
  access_token: string;
  refresh_token: string;
  user: User;
  savedAt: number;
};

function writeUserCookie(user: User): void {
  if (typeof document === "undefined") return;
  try {
    const value = encodeURIComponent(JSON.stringify(user));
    // 화면 로그인 상태용 (토큰은 localStorage). 7일
    document.cookie = `${APP_USER_COOKIE}=${value}; Path=/; Max-Age=${60 * 60 * 24 * 7}; SameSite=Lax`;
  } catch {
    /* ignore */
  }
}

function readUserCookie(): User | null {
  if (typeof document === "undefined") return null;
  try {
    const match = document.cookie
      .split("; ")
      .find((row) => row.startsWith(`${APP_USER_COOKIE}=`));
    if (!match) return null;
    const raw = decodeURIComponent(match.slice(APP_USER_COOKIE.length + 1));
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

function clearUserCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${APP_USER_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export function saveAppAuth(
  session: { access_token: string; refresh_token: string },
  user: User
): void {
  if (typeof window === "undefined") return;
  const payload: AppAuth = {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    user,
    savedAt: Date.now(),
  };
  try {
    window.localStorage.setItem(APP_AUTH_KEY, JSON.stringify(payload));
  } catch {
    /* private mode 등 */
  }
  writeUserCookie(user);
}

export function loadAppAuth(): AppAuth | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(APP_AUTH_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppAuth;
      if (parsed?.user?.id) return parsed;
    }
  } catch {
    /* fall through */
  }

  // localStorage가 비어도 쿠키 사용자로 화면 로그인 유지
  const user = readUserCookie();
  if (!user?.id) return null;
  return {
    access_token: "",
    refresh_token: "",
    user,
    savedAt: Date.now(),
  };
}

export function clearAppAuth(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(APP_AUTH_KEY);
  } catch {
    /* ignore */
  }
  clearUserCookie();
}
