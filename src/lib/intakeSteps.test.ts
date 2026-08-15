import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildIntakeFromSteps,
  parseIntakeStep,
  splitIntakeStepCancel,
} from "./intakeSteps.ts";

describe("intakeSteps", () => {
  it("단계별로 매물유형만 넣고 뒤 유형은 메모로 보내지 않는다", () => {
    const step = parseIntakeStep("원룸 아파트", "roomType", "property");
    assert.equal(step.ok, true);
    assert.equal(step.partial.roomType, "원룸");
    assert.equal(step.partial.notes, undefined);

    const built = buildIntakeFromSteps({ roomType: step.partial }, "property");
    assert.equal(built.roomType, "원룸");
    assert.equal(built.notes, "");
  });

  it("단계 취소 키워드를 분리한다", () => {
    assert.equal(splitIntakeStepCancel("삭제").cancel, true);
    assert.equal(splitIntakeStepCancel("아니 투룸").remainder, "투룸");
  });

  it("단계별 확정값을 조립한다", () => {
    const room = parseIntakeStep("원룸", "roomType", "property");
    const deal = parseIntakeStep("매매", "dealType", "property");
    const money = parseIntakeStep("1억", "money", "property", {
      ...room.partial,
      ...deal.partial,
      dealType: "매매",
    });
    const built = buildIntakeFromSteps(
      {
        roomType: room.partial,
        dealType: deal.partial,
        money: money.partial,
      },
      "property"
    );
    assert.equal(built.roomType, "원룸");
    assert.equal(built.dealType, "매매");
    assert.equal(built.deposit, 10000);
    assert.equal(built.notes, "");
  });

  it("메모 단계는 입력 그대로 받는다", () => {
    const step = parseIntakeStep("아니 9월 15일", "notes", "property");
    assert.equal(step.ok, true);
    assert.equal(step.partial.notes, "아니 9월 15일");
  });
});
