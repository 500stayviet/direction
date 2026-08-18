/** 앱 기능 소개 모달 — 다시 보지 않기만 저장. 닫기는 홈을 다시 열면 표시 */

const FOREVER_PREFIX = "realty_feature_intro_hide_";

function foreverKey(userId: string) {
  return `${FOREVER_PREFIX}${userId}`;
}

export function isFeatureIntroHidden(userId: string): boolean {
  try {
    return localStorage.getItem(foreverKey(userId)) === "1";
  } catch {
    return false;
  }
}

/** 소개를 띄워야 하는지 */
export function shouldShowFeatureIntro(userId: string): boolean {
  return !isFeatureIntroHidden(userId);
}

/** 홈에 있을 때만. 다시 보지 않기를 누른 계정은 제외 */
export function shouldOpenFeatureIntroOnHome(
  pathname: string,
  userId: string | undefined
): boolean {
  if (pathname !== "/") return false;
  if (!userId) return false;
  return shouldShowFeatureIntro(userId);
}

export function hideFeatureIntroForever(userId: string): void {
  try {
    localStorage.setItem(foreverKey(userId), "1");
  } catch {
    /* ignore */
  }
}
