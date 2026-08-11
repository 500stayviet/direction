import { parseISODate, toISODate, todayISO } from "@/lib/date";
import type { Customer } from "@/lib/types";

/** 희망 입주 시작일 기준 D-day (한 달 = 31일) */
export const CONTRACT_DEADLINE_DAYS = 31;

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

/** 희망 입주 시작일 기준 마지막 계약 데드라인 (= 입주 31일 전) */
export function getContractDeadlineISO(moveInISO: string): string | null {
  return addDaysISO(moveInISO, -CONTRACT_DEADLINE_DAYS);
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
 * 오늘이 '희망 입주 시작일까지 정확히 31일 전'일 때만 true
 * — 기준: 희망 입주 시작일(moveInFrom). 종료일(moveInTo)은 보지 않음
 */
export function isContractDeadlineActive(
  customer: Customer,
  today: string = todayISO()
): boolean {
  const moveIn = getCustomerMoveInTarget(customer);
  if (!moveIn) return false;
  if (moveIn < today) return false;
  return daysUntilISO(moveIn, today) === CONTRACT_DEADLINE_DAYS;
}

/** 데드라인까지 남은 일수 (음수면 데드라인 지남) */
export function daysUntilISO(iso: string, today: string = todayISO()): number {
  const a = parseISODate(today);
  const b = parseISODate(iso);
  if (!a || !b) return NaN;
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * 알림 배지 문구
 * — 단일이든 기간이든 라벨은 동일 (상세 날짜는 카드 하단 희망입주에서 확인)
 */
export function getContractDeadlineLabel(customer: Customer): string | null {
  if (!isContractDeadlineActive(customer)) return null;
  return "희망 입주일 31일전";
}
