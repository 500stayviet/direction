/** 로그인 화면 기억 값. 세션 토큰과 분리 — 로그아웃·강제종료 후에도 남김 */

export const REMEMBER_USERNAME_KEY = "realty_remember_username";
export const AUTO_LOGIN_KEY = "realty_auto_login";
/** 자동로그인 유지 기간 (서버 쿠키·클라이언트 쿠키 동일) */
export const AUTO_LOGIN_MAX_AGE_SEC = 60 * 60 * 24 * 7;

function canUseStorage(): boolean {
  return typeof window !== "undefined";
}

function readCookie(name: string): string {
  if (typeof document === "undefined") return "";
  try {
    const row = document.cookie
      .split("; ")
      .find((part) => part.startsWith(`${name}=`));
    if (!row) return "";
    return decodeURIComponent(row.slice(name.length + 1)).trim();
  } catch {
    return "";
  }
}

function writeCookie(name: string, value: string, maxAgeSec: number): void {
  if (typeof document === "undefined") return;
  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:"
      ? "; Secure"
      : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSec}; SameSite=Lax${secure}`;
}

export function getRememberedUsername(): string {
  if (!canUseStorage()) return "";
  try {
    const fromStore = window.localStorage.getItem(REMEMBER_USERNAME_KEY)?.trim() ?? "";
    if (fromStore) return fromStore;
  } catch {
    /* private mode */
  }
  return readCookie(REMEMBER_USERNAME_KEY);
}

export function setRememberedUsername(username: string | null): void {
  const next = (username ?? "").trim().toLowerCase();
  if (!canUseStorage()) return;
  try {
    if (next) window.localStorage.setItem(REMEMBER_USERNAME_KEY, next);
    else window.localStorage.removeItem(REMEMBER_USERNAME_KEY);
  } catch {
    /* ignore */
  }
  writeCookie(REMEMBER_USERNAME_KEY, next, next ? 60 * 60 * 24 * 365 : 0);
}

/** 미설정이면 켜진 것으로 봄 */
export function isAutoLoginEnabled(): boolean {
  if (!canUseStorage()) return true;
  try {
    return window.localStorage.getItem(AUTO_LOGIN_KEY) !== "0";
  } catch {
    return true;
  }
}

export function setAutoLoginEnabled(on: boolean): void {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(AUTO_LOGIN_KEY, on ? "1" : "0");
  } catch {
    /* ignore */
  }
}
