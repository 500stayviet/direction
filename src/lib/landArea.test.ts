import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatAreaDisplay,
  formatAreaWithUnit,
  formatLandAreaLine,
  m2ToPyeong,
  parseAreaInput,
  parseIntakeAreaFromText,
  pyeongToM2,
  stripIntakeAreaPhrases,
} from "./landArea.ts";

describe("토지 면적 평·㎡", () => {
  it("평과 ㎡를 서로 바꾼다", () => {
    assert.equal(pyeongToM2(1).toFixed(6), (400 / 121).toFixed(6));
    assert.equal(m2ToPyeong(400 / 121).toFixed(6), (1).toFixed(6));
  });

  it("숫자는 소수점 둘째 자리로 보여 준다", () => {
    assert.equal(formatAreaDisplay(45), "45.00");
    assert.equal(formatAreaDisplay(45.12), "45.12");
    assert.equal(formatAreaDisplay(45.1), "45.10");
    assert.equal(formatAreaDisplay(undefined), "");
  });

  it("값이 있으면 숫자와 단위 사이에 칸을 둔다", () => {
    assert.equal(formatAreaWithUnit(45.1, "평"), "45.10 평");
    assert.equal(formatAreaWithUnit(45.12, "평"), "45.12 평");
    assert.equal(formatAreaWithUnit(148.76, "㎡"), "148.76 ㎡");
  });

  it("한 줄 표시는 평과 ㎡를 같이 붙인다", () => {
    assert.equal(
      formatLandAreaLine(45),
      `${formatAreaWithUnit(45, "평")} · ${formatAreaWithUnit(pyeongToM2(45), "㎡")}`
    );
  });

  it("빈 칸은 면적을 지운다", () => {
    assert.equal(parseAreaInput(""), undefined);
    assert.equal(parseAreaInput("45"), 45);
    assert.equal(parseAreaInput("45평"), 45);
    assert.equal(parseAreaInput("45.10 평"), 45.1);
  });

  it("메시지 intake는 평·㎡·약 표현을 평으로 읽는다", () => {
    assert.equal(parseIntakeAreaFromText("약25평"), 25);
    assert.equal(parseIntakeAreaFromText("약 25평형"), 25);
    assert.equal(parseIntakeAreaFromText("사무실 약 30평 전세"), 30);
    const fromM2 = parseIntakeAreaFromText("82㎡");
    assert.ok(fromM2 != null && Math.abs(fromM2 - m2ToPyeong(82)) < 0.001);
    assert.equal(parseIntakeAreaFromText("약148m2"), m2ToPyeong(148));
  });

  it("면적 문구는 메모에서 제거한다", () => {
    assert.equal(
      stripIntakeAreaPhrases("약 25평 남향", 25),
      "남향"
    );
    assert.equal(
      stripIntakeAreaPhrases("82㎡ 저층", m2ToPyeong(82)),
      "저층"
    );
  });
});
