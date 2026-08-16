import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyDealTypeToMoney, isDealMoneyCleared } from "./dealTypeMoney.ts";

const jeonse = {
  deposit: 10000,
  depositTo: 10000,
  monthlyRent: 0,
  monthlyRentTo: 0,
};

const wolse = {
  deposit: 10000,
  depositTo: 10000,
  monthlyRent: 50,
  monthlyRentTo: 50,
};

const sale = {
  deposit: 20000,
  depositTo: 20000,
  monthlyRent: 0,
  monthlyRentTo: 0,
};

describe("applyDealTypeToMoney", () => {
  it("전세 보증금을 매매가로 유지한다", () => {
    const next = applyDealTypeToMoney("전세", "매매", jeonse);
    assert.equal(next.deposit, 10000);
    assert.equal(next.depositTo, 10000);
    assert.equal(next.monthlyRent, 0);
  });

  it("월세 보증금을 매매가로 유지하고 월세는 비운다", () => {
    const next = applyDealTypeToMoney("월세", "매매", wolse);
    assert.equal(next.deposit, 10000);
    assert.equal(next.monthlyRent, 0);
    assert.equal(next.monthlyRentTo, 0);
  });

  it("매매가에서 월세로 바꾸면 거래가액을 초기화한다", () => {
    const next = applyDealTypeToMoney("매매", "월세", sale);
    assert.equal(next.deposit, 0);
    assert.equal(next.depositTo, 0);
    assert.equal(next.monthlyRent, 0);
    assert.equal(isDealMoneyCleared(next), true);
  });

  it("매매가에서 전세로 바꾸면 금액을 보증금으로 유지한다", () => {
    const next = applyDealTypeToMoney("매매", "전세", sale);
    assert.equal(next.deposit, 20000);
    assert.equal(next.monthlyRent, 0);
  });

  it("전세에서 월세로 바꾸면 보증금은 두고 월세만 비운 채 둔다", () => {
    const next = applyDealTypeToMoney("전세", "월세", jeonse);
    assert.equal(next.deposit, 10000);
    assert.equal(next.monthlyRent, 0);
  });
});
