import { isVisitLapsed, todayISO } from "@/lib/date";
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
  return today > due;
}

export function shouldAutoCompleteCustomer(c: Customer): boolean {
  if (c.contractCompleted) return false;
  if (c.roomType === "토지") return false;
  if (c.dealType === "매매" && c.nonOccupancy) return false;
  return isMoveInDueReached(c.moveInFrom, c.moveInTo, c.moveInSingle);
}

export function shouldAutoCompleteProperty(p: ListedProperty): boolean {
  if (p.contractCompleted) return false;
  if (p.moveInVacant || p.moveInNegotiable) return false;
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

export function shouldAutoCompleteSchedule(s: Schedule): boolean {
  if (s.visitCompleted) return false;
  return isVisitLapsed(s.visitDate, s.visitTime);
}

export function applyScheduleDueComplete(s: Schedule): Schedule {
  if (!shouldAutoCompleteSchedule(s)) return s;
  return {
    ...s,
    visitCompleted: true,
    updatedAt: new Date().toISOString(),
  };
}
