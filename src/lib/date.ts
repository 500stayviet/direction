const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;

export function todayISO(): string {
  const d = new Date();
  return toISODate(d);
}

export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseISODate(iso: string): Date | null {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

/** 표시용: 2026년 8월 1일 */
export function formatDisplayDate(iso: string): string {
  const date = parseISODate(iso);
  if (!date) return "";
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
}

/** ISO 시각 → 서울 기준 년.월.일 시:분 (예: 2026. 8. 12. 17:05) */
export function formatSeoulDateTime(iso?: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  const y = get("year");
  const m = get("month");
  const day = get("day");
  const h = get("hour");
  const min = get("minute");
  return `${y}. ${m}. ${day}. ${h}:${min}`;
}

/** ISO 시각 → 카드용 저장일 (예: 2026.8.1) */
export function formatSavedDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    // YYYY-MM-DD 만 있는 경우
    const parsed = parseISODate(iso.slice(0, 10));
    if (!parsed) return "";
    return `${parsed.getFullYear()}.${parsed.getMonth() + 1}.${parsed.getDate()}`;
  }
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
}

export function currentYear(): number {
  return new Date().getFullYear();
}

export function isoFromYearMonthDay(
  year: number,
  month: number,
  day: number
): string | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(year, month - 1, day);
  if (
    d.getFullYear() !== year ||
    d.getMonth() !== month - 1 ||
    d.getDate() !== day
  ) {
    return null;
  }
  return toISODate(d);
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** 월·일만 있을 때 올해로 넣고, 이미 지난 날이면 내년 */
export function isoFromMonthDay(
  month: number,
  day: number,
  today: Date = new Date()
): string | null {
  const y = today.getFullYear();
  const thisYear = isoFromYearMonthDay(y, month, day);
  if (!thisYear) return null;
  const today0 = startOfDay(today);
  const candidate = parseISODate(thisYear);
  if (!candidate) return null;
  if (candidate < today0) {
    return isoFromYearMonthDay(y + 1, month, day);
  }
  return thisYear;
}

/** 등록용: 오늘보다 이전이면 같은 월·일의 다음 미래(올해 남은 날 또는 내년) */
export function isoNotBeforeToday(
  iso: string,
  today: Date = new Date()
): string | null {
  const d = parseISODate(iso);
  if (!d) return null;
  if (d >= startOfDay(today)) return toISODate(d);
  return isoFromMonthDay(d.getMonth() + 1, d.getDate(), today);
}

/** 기간 끝 월일. 시작보다 앞선 월일이면 이듬해 */
export function isoFollowingMonthDay(
  fromIso: string,
  month: number,
  day: number
): string | null {
  const fromDate = parseISODate(fromIso);
  if (!fromDate) return null;
  const fromMd = (fromDate.getMonth() + 1) * 32 + fromDate.getDate();
  const toMd = month * 32 + day;
  const year =
    toMd >= fromMd ? fromDate.getFullYear() : fromDate.getFullYear() + 1;
  return isoFromYearMonthDay(year, month, day);
}

/** 입주/임대 기간을 오늘 이전으로 두지 않음 */
export function clampMoveInToToday(
  from: string,
  to: string,
  today: Date = new Date()
): { from: string; to: string } | null {
  const fromN = isoNotBeforeToday(from, today);
  if (!fromN) return null;
  let toN = isoNotBeforeToday(to || from, today) ?? fromN;
  if (toN < fromN) {
    const td = parseISODate(toN);
    toN = td
      ? isoFollowingMonthDay(fromN, td.getMonth() + 1, td.getDate()) ?? fromN
      : fromN;
  }
  return { from: fromN, to: toN };
}

export function formatMonthTitle(year: number, monthIndex: number): string {
  return `${year}년 ${monthIndex + 1}월`;
}

export function addMonths(year: number, monthIndex: number, delta: number) {
  const d = new Date(year, monthIndex + delta, 1);
  return { year: d.getFullYear(), monthIndex: d.getMonth() };
}

export function getCalendarCells(year: number, monthIndex: number) {
  const first = new Date(year, monthIndex, 1);
  const startWeekday = first.getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells: Array<{
    day: number | null;
    iso: string | null;
    isToday: boolean;
  }> = [];

  const today = todayISO();

  for (let i = 0; i < startWeekday; i += 1) {
    cells.push({ day: null, iso: null, isToday: false });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const iso = toISODate(new Date(year, monthIndex, day));
    cells.push({ day, iso, isToday: iso === today });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ day: null, iso: null, isToday: false });
  }
  return cells;
}

export { WEEKDAYS };
