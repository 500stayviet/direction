const SESSION_NUDGE_KEY = "realty_list_swipe_nudge_session_v1";

/**
 * 리스트 첫 카드 좌우 살짝 흔들림 — 브라우저 탭(세션)당 1회.
 * 삭제·계약완료 기능과 별개로, 안내 애니메이션만 다시 보여 준다.
 */
export function consumeCustomerSwipeNudge(): boolean {
  try {
    if (
      sessionStorage.getItem(SESSION_NUDGE_KEY) === "1" ||
      sessionStorage.getItem("realty_customer_swipe_nudge_session_v1") === "1"
    ) {
      return false;
    }
    sessionStorage.setItem(SESSION_NUDGE_KEY, "1");
    return true;
  } catch {
    return false;
  }
}
