const USED_KEY = "realty_list_swipe_used_v1";
const LAST_NUDGE_AT_KEY = "realty_list_swipe_nudge_at_v1";
const SESSION_NUDGE_KEY = "realty_list_swipe_nudge_session_v1";
const REMIND_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

/** 고객·매물 리스트 공통: 스와이프 완료/삭제를 한 번이라도 성공하면 힌트 영구 중단 */
export function markCustomerSwipeUsed() {
  try {
    localStorage.setItem(USED_KEY, "1");
    // 예전 키도 정리
    localStorage.removeItem("realty_customer_swipe_used_v1");
  } catch {
    /* ignore */
  }
}

/**
 * 고객·매물 리스트 공통.
 * 미사용 유저만: 세션당 1회.
 * 첫 노출 후 7일 지나도 여전히 미사용이면 다시 1회 리마인드.
 */
export function consumeCustomerSwipeNudge(): boolean {
  try {
    const used =
      localStorage.getItem(USED_KEY) === "1" ||
      localStorage.getItem("realty_customer_swipe_used_v1") === "1";
    if (used) return false;
    if (
      sessionStorage.getItem(SESSION_NUDGE_KEY) === "1" ||
      sessionStorage.getItem("realty_customer_swipe_nudge_session_v1") === "1"
    ) {
      return false;
    }

    const lastRaw =
      localStorage.getItem(LAST_NUDGE_AT_KEY) ??
      localStorage.getItem("realty_customer_swipe_nudge_at_v1");
    if (lastRaw) {
      const last = Number(lastRaw);
      if (Number.isFinite(last) && Date.now() - last < REMIND_AFTER_MS) {
        return false;
      }
    }

    sessionStorage.setItem(SESSION_NUDGE_KEY, "1");
    localStorage.setItem(LAST_NUDGE_AT_KEY, String(Date.now()));
    return true;
  } catch {
    return false;
  }
}
