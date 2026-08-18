/** 앱 기능 소개 모달 — 「다시 보지 않기」는 1주일 숨김. 닫기는 홈을 다시 열면 표시 */

const HIDE_UNTIL_PREFIX = "realty_feature_intro_hide_until_";
/** 예전 영구 숨김 키. 읽으면 무시하고 지운다. */
const LEGACY_FOREVER_PREFIX = "realty_feature_intro_hide_";

/** 1주일 (사용자 요청). 예전에 한 달로 기억하신 것과 달리 현재는 주 단위. */
export const FEATURE_INTRO_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

function hideUntilKey(userId: string) {
  return `${HIDE_UNTIL_PREFIX}${userId}`;
}

function legacyForeverKey(userId: string) {
  return `${LEGACY_FOREVER_PREFIX}${userId}`;
}

function clearLegacyForever(userId: string) {
  try {
    localStorage.removeItem(legacyForeverKey(userId));
  } catch {
    /* ignore */
  }
}

export function isFeatureIntroHidden(
  userId: string,
  now: number = Date.now()
): boolean {
  try {
    clearLegacyForever(userId);
    const raw = localStorage.getItem(hideUntilKey(userId));
    if (!raw) return false;
    const until = Number(raw);
    if (!Number.isFinite(until)) return false;
    return now < until;
  } catch {
    return false;
  }
}

/** 홈에 있을 때만. 숨김 기간이 남은 계정은 제외 */
export function shouldOpenFeatureIntroOnHome(
  pathname: string,
  userId: string | undefined,
  now: number = Date.now()
): boolean {
  if (pathname !== "/") return false;
  if (!userId) return false;
  return !isFeatureIntroHidden(userId, now);
}

/** 「다시 보지 않기」→ now부터 1주일 동안 숨김 */
export function snoozeFeatureIntro(
  userId: string,
  now: number = Date.now()
): void {
  try {
    clearLegacyForever(userId);
    localStorage.setItem(
      hideUntilKey(userId),
      String(now + FEATURE_INTRO_SNOOZE_MS)
    );
  } catch {
    /* ignore */
  }
}
