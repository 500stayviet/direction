import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CONTRACT_DEADLINE_DAYS,
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

  it("입주 45일 전부터 당일까지 알람", () => {
    const moveIn45 = addDaysISO(TODAY, CONTRACT_DEADLINE_DAYS)!;
    const moveIn10 = addDaysISO(TODAY, 10)!;
    const moveIn0 = TODAY;

    assert.equal(isMoveInDeadlineActive(moveIn45, TODAY), true);
    assert.equal(
      getContractDeadlineLabel(customer(moveIn45), TODAY),
      "희망 입주일 45일전"
    );

    assert.equal(isMoveInDeadlineActive(moveIn10, TODAY), true);
    assert.equal(
      getContractDeadlineLabel(customer(moveIn10), TODAY),
      "희망 입주일 10일전"
    );

    assert.equal(isMoveInDeadlineActive(moveIn0, TODAY), true);
    assert.equal(
      getContractDeadlineLabel(customer(moveIn0), TODAY),
      "희망 입주일 당일"
    );
  });

  it("매물도 임대희망일 남은 일수로 표시", () => {
    assert.equal(
      getPropertyDeadlineLabel(
        {
          moveInFrom: addDaysISO(TODAY, 5)!,
        },
        TODAY
      ),
      "임대희망일 5일전"
    );
  });

  it(`CONTRACT_DEADLINE_DAYS는 ${CONTRACT_DEADLINE_DAYS}`, () => {
    assert.equal(CONTRACT_DEADLINE_DAYS, 45);
  });
});
