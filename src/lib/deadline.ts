import { parseISODate, toISODate, todayISO } from "@/lib/date";
import type { Customer } from "@/lib/types";

/** 희망 입주·임대희망일 시작일 기준 D-day */
export const CONTRACT_DEADLINE_DAYS = 45;

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
 * 오늘이 '희망 입주 시작일까지 정확히 45일 전'일 때만 true
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
 * 오늘이 입주 시작일까지 정확히 45일 전일 때만 true
 */
export function isMoveInDeadlineActive(
  moveInISO: string | null | undefined,
  today: string = todayISO()
): boolean {
  if (!moveInISO) return false;
  if (moveInISO < today) return false;
  return daysUntilISO(moveInISO, today) === CONTRACT_DEADLINE_DAYS;
}

function moveInStartISO(from?: string, date?: string): string | null {
  if (from) return from;
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  return null;
}

/**
 * 알림 배지 문구
 * — 단일이든 기간이든 라벨은 동일 (상세 날짜는 카드 하단 희망입주에서 확인)
 */
export function getContractDeadlineLabel(customer: Customer): string | null {
  if (!isContractDeadlineActive(customer)) return null;
  return `희망 입주일 ${CONTRACT_DEADLINE_DAYS}일전`;
}

export function getPropertyDeadlineLabel(property: {
  contractCompleted?: boolean;
  moveInVacant?: boolean;
  moveInNegotiable?: boolean;
  moveInFrom?: string;
  moveInDate?: string;
}): string | null {
  if (property.contractCompleted) return null;
  if (property.moveInVacant || property.moveInNegotiable) return null;
  if (
    !isMoveInDeadlineActive(
      moveInStartISO(property.moveInFrom, property.moveInDate)
    )
  ) {
    return null;
  }
  return `임대희망일 ${CONTRACT_DEADLINE_DAYS}일전`;
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
