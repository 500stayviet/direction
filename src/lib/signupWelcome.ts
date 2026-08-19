const SIGNUP_WELCOME_KEY = "direction.signupWelcomePending";

/** 가입 직후 홈에서 완료 안내를 한 번 보여 준다 */
export function markSignupWelcomePending(): void {
  try {
    sessionStorage.setItem(SIGNUP_WELCOME_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function isSignupWelcomePending(): boolean {
  try {
    return sessionStorage.getItem(SIGNUP_WELCOME_KEY) === "1";
  } catch {
    return false;
  }
}

export function clearSignupWelcomePending(): void {
  try {
    sessionStorage.removeItem(SIGNUP_WELCOME_KEY);
  } catch {
    /* ignore */
  }
}
