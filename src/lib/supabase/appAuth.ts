import type { User } from "@/lib/types";
import { AUTO_LOGIN_MAX_AGE_SEC } from "@/lib/loginPrefs";

const APP_AUTH_KEY = "realty_app_auth_v1";
const APP_USER_COOKIE = "realty_app_user_v1";

export type AppAuth = {
  access_token: string;
  refresh_token: string;
  user: User;
  savedAt: number;
};

function cookieSecureSuffix(): string {
  if (typeof window === "undefined") return "";
  return window.location.protocol === "https:" ? "; Secure" : "";
}

function publicUserForCookie(user: User): Omit<User, "passwordHint"> & {
  passwordHint: "";
} {
  return { ...user, passwordHint: "" };
}

function writeUserCookie(user: User): void {
  if (typeof document === "undefined") return;
  try {
    const value = encodeURIComponent(
      JSON.stringify(publicUserForCookie(user))
    );
    document.cookie = `${APP_USER_COOKIE}=${value}; Path=/; Max-Age=${AUTO_LOGIN_MAX_AGE_SEC}; SameSite=Lax${cookieSecureSuffix()}`;
  } catch {
    /* ignore */
  }
}

function clearUserCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${APP_USER_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${cookieSecureSuffix()}`;
  document.cookie = `${APP_USER_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}

function parseAuth(raw: string | null): AppAuth | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as AppAuth;
    if (!parsed?.user?.id) return null;
    if (!parsed.access_token && !parsed.refresh_token) return null;
    return parsed;
  } catch {
    return null;
  }
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
    /* private mode */
  }
  try {
    window.sessionStorage.removeItem(APP_AUTH_KEY);
  } catch {
    /* ignore */
  }
  writeUserCookie(user);
}

export function loadAppAuth(): AppAuth | null {
  if (typeof window === "undefined") return null;
  try {
    const fromLocal = parseAuth(window.localStorage.getItem(APP_AUTH_KEY));
    if (fromLocal) return fromLocal;
  } catch {
    /* ignore */
  }
  try {
    return parseAuth(window.sessionStorage.getItem(APP_AUTH_KEY));
  } catch {
    return null;
  }
}

export function clearAppAuth(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(APP_AUTH_KEY);
  } catch {
    /* ignore */
  }
  try {
    window.sessionStorage.removeItem(APP_AUTH_KEY);
  } catch {
    /* ignore */
  }
  clearUserCookie();
}
