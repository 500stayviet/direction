import { parseISODate, toISODate, todayISO } from "@/lib/date";
import type { Customer } from "@/lib/types";

/** 희망 입주·임대희망일 시작일 기준 — 알람 시작(45일 전) */
export const CONTRACT_DEADLINE_DAYS = 45;
/** 알람 종료 — 입주 30일 전까지 (29일 이하·당일은 제외) */
export const CONTRACT_DEADLINE_UNTIL_DAYS = 30;

/** YYYY-MM-DD 에 일수 더하기/빼기 */
export function addDaysISO(iso: string, delta: number): string | null {
  const d = parseISODate(iso);
  if (!d) return null;
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + delta);
  return toISODate(next);
}

/** YYYY-MM-DD 에 개월 수 더하기/빼기 */
export function addMonthsISO(iso: string, delta: number): string | null {
  const d = parseISODate(iso);
  if (!d) return null;
  const next = new Date(d.getFullYear(), d.getMonth() + delta, d.getDate());
  return toISODate(next);
}

/** 희망 입주 시작일 기준 마지막 계약 데드라인 (= 입주 45일 전) */
export function getContractDeadlineISO(moveInISO: string): string | null {
  return addDaysISO(moveInISO, -CONTRACT_DEADLINE_DAYS);
}

/** 알람 기준이 되는 희망 입주일 (시작일) */
export function getCustomerMoveInTarget(customer: Customer): string | null {
  if (customer.contractCompleted) return null;
  if (customer.roomType === "토지") return null;
  if (customer.dealType === "매매" && customer.nonOccupancy) return null;
  if (customer.moveInFrom) return customer.moveInFrom;
  if (customer.moveInDate && /^\d{4}-\d{2}-\d{2}$/.test(customer.moveInDate)) {
    return customer.moveInDate;
  }
  return null;
}

/**
 * 오늘이 '희망 입주 시작일까지 45~30일' 구간일 때 true
 * — 기준: 희망 입주 시작일(moveInFrom). 종료일(moveInTo)은 보지 않음
 */
export function isContractDeadlineActive(
  customer: Customer,
  today: string = todayISO()
): boolean {
  const moveIn = getCustomerMoveInTarget(customer);
  return isMoveInDeadlineActive(moveIn, today);
}

/** 데드라인까지 남은 일수 (음수면 데드라인 지남) */
export function daysUntilISO(iso: string, today: string = todayISO()): number {
  const a = parseISODate(today);
  const b = parseISODate(iso);
  if (!a || !b) return NaN;
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * 입주 시작일까지 남은 일수 (당일=0). 과거·미입력이면 null.
 */
export function daysUntilMoveIn(
  moveInISO: string | null | undefined,
  today: string = todayISO()
): number | null {
  if (!moveInISO) return null;
  if (moveInISO < today) return null;
  const left = daysUntilISO(moveInISO, today);
  if (!Number.isFinite(left) || left < 0) return null;
  return left;
}

/**
 * 오늘이 '희망 입주 시작일까지 45~30일' 구간일 때 true
 * — 45일 전부터 30일 전까지 매일 표시
 */
export function isMoveInDeadlineActive(
  moveInISO: string | null | undefined,
  today: string = todayISO()
): boolean {
  const left = daysUntilMoveIn(moveInISO, today);
  if (left == null) return false;
  return (
    left <= CONTRACT_DEADLINE_DAYS && left >= CONTRACT_DEADLINE_UNTIL_DAYS
  );
}

function moveInStartISO(from?: string, date?: string): string | null {
  if (from) return from;
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  return null;
}

function formatMoveInDeadlineLabel(prefix: string, daysLeft: number): string {
  return `${prefix} ${daysLeft}일전`;
}

/**
 * 알림 배지 문구 — 남은 일수 반영 (45일 전~30일 전)
 */
export function getContractDeadlineLabel(
  customer: Customer,
  today: string = todayISO()
): string | null {
  const moveIn = getCustomerMoveInTarget(customer);
  const left = daysUntilMoveIn(moveIn, today);
  if (
    left == null ||
    left > CONTRACT_DEADLINE_DAYS ||
    left < CONTRACT_DEADLINE_UNTIL_DAYS
  ) {
    return null;
  }
  return formatMoveInDeadlineLabel("희망 입주일", left);
}

export function getPropertyDeadlineLabel(
  property: {
    contractCompleted?: boolean;
    moveInVacant?: boolean;
    moveInNegotiable?: boolean;
    moveInFrom?: string;
    moveInDate?: string;
  },
  today: string = todayISO()
): string | null {
  if (property.contractCompleted) return null;
  if (property.moveInVacant || property.moveInNegotiable) return null;
  const moveIn = moveInStartISO(property.moveInFrom, property.moveInDate);
  const left = daysUntilMoveIn(moveIn, today);
  if (
    left == null ||
    left > CONTRACT_DEADLINE_DAYS ||
    left < CONTRACT_DEADLINE_UNTIL_DAYS
  ) {
    return null;
  }
  return formatMoveInDeadlineLabel("임대희망일", left);
}

/** 뱃지 정렬용 — 데드라인 당일 00:00 기준 */
export function getDeadlineBadgeSortAt(
  moveInISO: string | null | undefined
): number {
  if (!moveInISO) return 0;
  const deadline = getContractDeadlineISO(moveInISO);
  if (!deadline) return 0;
  const d = parseISODate(deadline);
  return d?.getTime() ?? 0;
}
