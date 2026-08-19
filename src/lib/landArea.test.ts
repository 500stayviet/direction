import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatAreaDisplay,
  formatAreaWithUnit,
  formatLandAreaLine,
  m2ToPyeong,
  parseAreaInput,
  pyeongToM2,
} from "./landArea.ts";

describe("토지 면적 평·㎡", () => {
  it("평과 ㎡를 서로 바꾼다", () => {
    assert.equal(pyeongToM2(1).toFixed(6), (400 / 121).toFixed(6));
    assert.equal(m2ToPyeong(400 / 121).toFixed(6), (1).toFixed(6));
  });

  it("정수는 그대로, 소수는 둘째 자리까지 보여 준다", () => {
    assert.equal(formatAreaDisplay(45), "45");
    assert.equal(formatAreaDisplay(45.12), "45.12");
    assert.equal(formatAreaDisplay(45.1), "45.10");
    assert.equal(formatAreaDisplay(undefined), "");
  });

  it("값이 있으면 단위를 뒤에 붙인다", () => {
    assert.equal(formatAreaWithUnit(45, "평"), "45평");
    assert.equal(formatAreaWithUnit(45.12, "평"), "45.12평");
    assert.equal(formatAreaWithUnit(148.76, "㎡"), "148.76㎡");
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
  });
});
