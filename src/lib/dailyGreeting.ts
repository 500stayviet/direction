/** 로그인 홈 인사 — 날짜 기준으로 하루 하나씩 순환 */
const DAILY_GREETINGS = [
  "오늘도 현장 화이팅",
  "오늘도 좋은 계약 되세요",
  "안전 운전, 좋은 하루 되세요",
  "오늘 동선도 가볍게 가봅시다",
  "한 건 한 건, 오늘도 응원해요",
  "오늘도 손님 응대 화이팅",
  "현장에서도 여유 있게 가봐요",
  "오늘 일정, 차근차근 해봐요",
  "좋은 매물·좋은 인연 있길",
  "오늘도 수고 많으실 하루예요",
  "발걸음마다 좋은 소식 있길",
  "오늘 임장도 깔끔하게 끝나요",
  "전화 한 통, 기회 한 건",
  "오늘도 프로처럼 가봅시다",
  "날씨야 어떠든, 현장 화이팅",
  "손님 미소가 계약의 시작",
  "오늘 동선, 막힘없이 가요",
  "작은 챙김이 큰 신뢰예요",
  "오늘도 한 걸음 더 가봐요",
  "마무리까지 든든하게",
] as const;

/** 로컬 날짜 기준 일 단위 인덱스로 인사말 선택 */
export function getDailyGreeting(date = new Date()): string {
  const y = date.getFullYear();
  const m = date.getMonth();
  const d = date.getDate();
  // 타임존 영향 적게: 로컬 연월일만으로 일수 계산
  const dayIndex = Math.floor(Date.UTC(y, m, d) / 86_400_000);
  const idx =
    ((dayIndex % DAILY_GREETINGS.length) + DAILY_GREETINGS.length) %
    DAILY_GREETINGS.length;
  return DAILY_GREETINGS[idx];
}
