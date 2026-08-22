/**
 * 알람 해제 규칙 (앱·푸시·배ner 공통)
 *
 * ## 상단 배너
 * - 홈·고객·매물·네비 **리스트** 진입 시 미확인 알람이 있으면 약 5초 표시 후 자동 숨김
 * - 새 알람이 늘어나면 다른 화면에서도 잠시 표시
 * - 탭 시 **먼저 온 알람**(alertSince) 한 건으로 이동
 * - 뱃지·탭 제목·반짝임 등 알람 자체는 확인할 때까지 유지
 *
 * ## 매칭 (match / newMatch)
 * - 알림·푸시 탭 → 상세 + `?scrollMatch=1` → 반짝이는 매칭 카드로 스크롤만
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
