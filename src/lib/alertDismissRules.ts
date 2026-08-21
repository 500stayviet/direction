/**
 * 알람 해제 규칙 (앱·푸시·배ner 공통)
 *
 * ## 매칭 (match / newMatch)
 * - 알림·푸시 탭 → 상세 + `?scrollMatch=1` → 조건 매칭 **미리보기 모달** 자동 오픈
 * - 해제: `MatchListPanel`에서 해당 카드 **미리보기 진입** (`markMatchSeen`)
 * - 상세 페이지만 열거나 알림만 탭한 것으로는 해제하지 않음
 *
 * ## 팀 공유 (share)
 * - 알림·배ner·Web Push → 리스트 + `?scrollShare=id` → 카드 반짝임까지
 * - 해제: 리스트에서 **해당 카드 탭**(상세 진입) (`markShareSeen`)
 * - 리스트만 보거나 scrollShare로 위치만 맞춘 것으로는 해제하지 않음
 * - 상세 URL 직접 진입으로는 해제하지 않음 (리스트 카드 탭 필요)
 */

export type AlertDismissKind = "match" | "share";
