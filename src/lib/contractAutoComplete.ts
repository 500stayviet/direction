import { parseISODate, todayISO } from "@/lib/date";
import type { Customer, ListedProperty, Schedule } from "@/lib/types";

const DAY_RE = /^\d{4}-\d{2}-\d{2}/;

function parseDay(iso?: string): string | null {
  const s = (iso ?? "").trim();
  if (!DAY_RE.test(s)) return null;
  return s.slice(0, 10);
}

/**
 * 계약완료 기준일.
 * 단일 → 그날, 시작~끝 → 끝날, 한쪽만 있으면 그 날.
 */
export function getMoveInDueDay(
  from?: string,
  to?: string,
  single?: boolean
): string | null {
  const f = parseDay(from);
  const t = parseDay(to);
  if (!f && !t) return null;
  if (single || (f && (!t || t === f))) return f ?? t;
  if (f && t) return f <= t ? t : f;
  return t ?? f;
}

export function isMoveInDueReached(
  from?: string,
  to?: string,
  single?: boolean,
  today = todayISO()
): boolean {
  const due = getMoveInDueDay(from, to, single);
  if (!due) return false;
  return today >= due;
}

export function shouldAutoCompleteCustomer(c: Customer): boolean {
  if (c.contractCompleted) return false;
  if (c.dealType === "매매" && c.nonOccupancy) return false;
  return isMoveInDueReached(c.moveInFrom, c.moveInTo, c.moveInSingle);
}

export function shouldAutoCompleteProperty(p: ListedProperty): boolean {
  if (p.contractCompleted) return false;
  return isMoveInDueReached(p.moveInFrom, p.moveInTo, p.moveInSingle);
}

function stampComplete<T extends { contractCompleted?: boolean; updatedAt: string }>(
  item: T
): T {
  return {
    ...item,
    contractCompleted: true,
    updatedAt: new Date().toISOString(),
  };
}

export function applyCustomerDueComplete(c: Customer): Customer {
  return shouldAutoCompleteCustomer(c) ? stampComplete(c) : c;
}

export function applyPropertyDueComplete(p: ListedProperty): ListedProperty {
  return shouldAutoCompleteProperty(p) ? stampComplete(p) : p;
}

const TIME_RE = /^(\d{1,2}):(\d{2})/;

/** 방문 약속 시각 + 1일. 시간 없으면 그날 00:00 기준. */
export function getVisitExpireAt(
  visitDate?: string,
  visitTime?: string
): Date | null {
  const day = parseISODate((visitDate ?? "").trim().slice(0, 10));
  if (!day) return null;
  const match = TIME_RE.exec((visitTime ?? "").trim());
  const hours = match ? Math.min(23, Number(match[1])) : 0;
  const minutes = match ? Math.min(59, Number(match[2])) : 0;
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  day.setHours(hours, minutes, 0, 0);
  day.setDate(day.getDate() + 1);
  return day;
}

export function shouldAutoCompleteSchedule(s: Schedule): boolean {
  if (s.visitCompleted) return false;
  const expireAt = getVisitExpireAt(s.visitDate, s.visitTime);
  if (!expireAt) return false;
  return Date.now() >= expireAt.getTime();
}

export function applyScheduleDueComplete(s: Schedule): Schedule {
  if (!shouldAutoCompleteSchedule(s)) return s;
  return {
    ...s,
    visitCompleted: true,
    updatedAt: new Date().toISOString(),
  };
}
