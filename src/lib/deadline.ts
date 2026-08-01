import { parseISODate, toISODate, todayISO } from "@/lib/date";
import type { Customer } from "@/lib/types";

/** YYYY-MM-DD 에 개월 수 더하기/빼기 */
export function addMonthsISO(iso: string, delta: number): string | null {
  const d = parseISODate(iso);
  if (!d) return null;
  const next = new Date(d.getFullYear(), d.getMonth() + delta, d.getDate());
  return toISODate(next);
}

/** 희망 입주일 기준 마지막 계약 데드라인 (= 입주 1개월 전) */
export function getContractDeadlineISO(moveInISO: string): string | null {
  return addMonthsISO(moveInISO, -1);
}

/** 알람 기준이 되는 희망 입주일 (시작일) */
export function getCustomerMoveInTarget(customer: Customer): string | null {
  if (customer.contractCompleted) return null;
  if (customer.dealType === "매매" && customer.nonOccupancy) return null;
  if (customer.moveInFrom) return customer.moveInFrom;
  if (customer.moveInDate && /^\d{4}-\d{2}-\d{2}$/.test(customer.moveInDate)) {
    return customer.moveInDate;
  }
  return null;
}

/**
 * 오늘이 '입주 정확히 1개월 전'(마지막 계약 데드라인 당일)일 때만 true
 * — 아직 1개월보다 많이 남은 경우: 제외
 * — 이미 1개월이 안 남은 경우(데드라인 지남): 제외
 * — 입주일이 지난 경우: 제외
 */
export function isContractDeadlineActive(
  customer: Customer,
  today: string = todayISO()
): boolean {
  const moveIn = getCustomerMoveInTarget(customer);
  if (!moveIn) return false;
  if (moveIn < today) return false;
  const deadline = getContractDeadlineISO(moveIn);
  if (!deadline) return false;
  return today === deadline;
}

/** 데드라인까지 남은 일수 (음수면 데드라인 지남) */
export function daysUntilISO(iso: string, today: string = todayISO()): number {
  const a = parseISODate(today);
  const b = parseISODate(iso);
  if (!a || !b) return NaN;
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

export function getContractDeadlineLabel(customer: Customer): string | null {
  if (!isContractDeadlineActive(customer)) return null;
  return "오늘 · 마지막 계약 데드라인";
}
