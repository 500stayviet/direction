import type { DealType } from "@/lib/types";

export type DealTypeChoice = DealType | "" | undefined;

export type DealMoneyFields = {
  deposit: number;
  depositTo: number;
  monthlyRent: number;
  monthlyRentTo: number;
};

const emptyMoney = (): DealMoneyFields => ({
  deposit: 0,
  depositTo: 0,
  monthlyRent: 0,
  monthlyRentTo: 0,
});

/**
 * 거래종류를 다시 고를 때 거래가액.
 * - 전세(보증금)·월세(보증금+월세) → 매매: 보증금을 매매가로 유지, 월세 비움
 * - 매매(매매가) → 월세: 거래가액 전부 초기화
 * - 그 외 월세가 아니면 월세만 비움
 */
export function applyDealTypeToMoney(
  prev: DealTypeChoice,
  next: DealTypeChoice,
  money: DealMoneyFields
): DealMoneyFields {
  const from = prev || "";
  const to = next || "";

  if (from === "매매" && to === "월세") {
    return emptyMoney();
  }

  if (to === "매매" && (from === "전세" || from === "월세")) {
    return {
      deposit: money.deposit,
      depositTo: money.depositTo || money.deposit,
      monthlyRent: 0,
      monthlyRentTo: 0,
    };
  }

  if (to !== "월세") {
    return {
      ...money,
      monthlyRent: 0,
      monthlyRentTo: 0,
    };
  }

  return money;
}

export function isDealMoneyCleared(money: DealMoneyFields): boolean {
  return (
    money.deposit <= 0 &&
    money.depositTo <= 0 &&
    money.monthlyRent <= 0 &&
    money.monthlyRentTo <= 0
  );
}
