import type { User } from "@/lib/types";

const APP_AUTH_KEY = "realty_app_auth_v1";

export type AppAuth = {
  access_token: string;
  refresh_token: string;
  user: User;
  savedAt: number;
};

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
  window.localStorage.setItem(APP_AUTH_KEY, JSON.stringify(payload));
}

export function loadAppAuth(): AppAuth | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(APP_AUTH_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AppAuth;
  } catch {
    return null;
  }
}

export function clearAppAuth(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(APP_AUTH_KEY);
}
