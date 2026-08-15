import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeOcrIntakeText } from "./intakeOcrNormalize.ts";
import { parseIntakeText } from "./intakeParse.ts";

describe("normalizeOcrIntakeText", () => {
  it("OCR 띄어쓰기·폼 라벨을 정리한다", () => {
    const raw = "매물유형 원룸 거래종류 매매 매 매 가 1 억 8 월 25 일";
    const normalized = normalizeOcrIntakeText(raw);
    assert.match(normalized, /원룸/);
    assert.match(normalized, /매매/);
    assert.match(normalized, /1억/);
    assert.doesNotMatch(normalized, /매물유형|거래종류/);

    const parsed = parseIntakeText(normalized, "property");
    assert.equal(parsed.roomType, "원룸");
    assert.equal(parsed.dealType, "매매");
    assert.equal(parsed.deposit, 10000);
    assert.equal(parsed.notes, "");
  });
});
