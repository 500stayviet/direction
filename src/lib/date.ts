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
