import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CONTRACT_DEADLINE_DAYS,
  CONTRACT_DEADLINE_UNTIL_DAYS,
  addDaysISO,
  getContractDeadlineLabel,
  getPropertyDeadlineLabel,
  isMoveInDeadlineActive,
} from "./deadline.ts";
import type { Customer } from "./types.ts";

const TODAY = "2026-08-20";

function customer(moveInFrom: string): Customer {
  return {
    id: "c1",
    name: "테스트",
    phone: "01012345678",
    dealType: "전세",
    roomType: "원룸",
    moveInFrom,
    createdAt: TODAY,
    updatedAt: TODAY,
  };
}

describe("deadline alerts", () => {
  it("입주 46일 전에는 알람 없음", () => {
    const moveIn = addDaysISO(TODAY, CONTRACT_DEADLINE_DAYS + 1)!;
    assert.equal(isMoveInDeadlineActive(moveIn, TODAY), false);
    assert.equal(getContractDeadlineLabel(customer(moveIn), TODAY), null);
  });

  it("입주 45일 전~30일 전까지만 알람", () => {
    const moveIn45 = addDaysISO(TODAY, CONTRACT_DEADLINE_DAYS)!;
    const moveIn30 = addDaysISO(TODAY, CONTRACT_DEADLINE_UNTIL_DAYS)!;
    const moveIn29 = addDaysISO(TODAY, CONTRACT_DEADLINE_UNTIL_DAYS - 1)!;
    const moveIn10 = addDaysISO(TODAY, 10)!;

    assert.equal(isMoveInDeadlineActive(moveIn45, TODAY), true);
    assert.equal(
      getContractDeadlineLabel(customer(moveIn45), TODAY),
      "희망 입주일 45일전"
    );

    assert.equal(isMoveInDeadlineActive(moveIn30, TODAY), true);
    assert.equal(
      getContractDeadlineLabel(customer(moveIn30), TODAY),
      "희망 입주일 30일전"
    );

    assert.equal(isMoveInDeadlineActive(moveIn29, TODAY), false);
    assert.equal(getContractDeadlineLabel(customer(moveIn29), TODAY), null);

    assert.equal(isMoveInDeadlineActive(moveIn10, TODAY), false);
    assert.equal(getContractDeadlineLabel(customer(moveIn10), TODAY), null);
  });

  it("매물도 45~30일 구간만 임대희망일 뱃지", () => {
    assert.equal(
      getPropertyDeadlineLabel(
        {
          moveInFrom: addDaysISO(TODAY, 35)!,
        },
        TODAY
      ),
      "임대희망일 35일전"
    );
    assert.equal(
      getPropertyDeadlineLabel(
        {
          moveInFrom: addDaysISO(TODAY, 20)!,
        },
        TODAY
      ),
      null
    );
  });

  it(`알람 구간은 ${CONTRACT_DEADLINE_DAYS}일~${CONTRACT_DEADLINE_UNTIL_DAYS}일`, () => {
    assert.equal(CONTRACT_DEADLINE_DAYS, 45);
    assert.equal(CONTRACT_DEADLINE_UNTIL_DAYS, 30);
  });
});
