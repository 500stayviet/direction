export type ListSwipeNudgeTab = "customers" | "properties" | "navi";

const SESSION_NUDGE_PREFIX = "realty_list_swipe_nudge_session_v2:";

/**
 * 리스트 첫 카드 좌우 살짝 흔들림 — 탭(세션)마다 페이지별로 1회.
 * 삭제·계약완료 기능과 별개로, 안내 애니메이션만 다시 보여 준다.
 */
export function consumeListSwipeNudge(tab: ListSwipeNudgeTab): boolean {
  try {
    const key = SESSION_NUDGE_PREFIX + tab;
    if (sessionStorage.getItem(key) === "1") return false;
    sessionStorage.setItem(key, "1");
    return true;
  } catch {
    return false;
  }
}
