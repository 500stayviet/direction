import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  hashIntakeSampleText,
  listMissingIntakeFields,
  maskIntakeSampleText,
  sanitizeParsedForSample,
  shouldRecordIntakeSample,
} from "./intakeSampleCollect.ts";
import type { IntakeParseResult } from "./intakeParse.ts";

describe("intakeSampleCollect", () => {
  it("전화번호를 마스킹한다", () => {
    const masked = maskIntakeSampleText("홍길동 010-1234-5678 원룸 전세");
    assert.match(masked, /010\*{4}5678/);
    assert.doesNotMatch(masked, /1234/);
  });

  it("parsed에서 PII를 제거한다", () => {
    const sanitized = sanitizeParsedForSample({
      options: [],
      notes: "",
      name: "홍길동",
      phone: "010-1234-5678",
    });
    assert.equal(sanitized.name, "[이름]");
    assert.equal(sanitized.phone, "****");
  });

  it("비어 있는 필드를 나열한다", () => {
    const parsed: IntakeParseResult = {
      options: [],
      notes: "",
      roomType: "원룸",
      dealType: "전세",
    };
    const missing = listMissingIntakeFields(parsed);
    assert.ok(missing.includes("deposit"));
    assert.ok(missing.includes("dong"));
    assert.ok(!missing.includes("roomType"));
  });

  it("짧은 입력은 기록하지 않는다", () => {
    assert.equal(shouldRecordIntakeSample("원룸"), false);
    assert.equal(shouldRecordIntakeSample("원룸 전세 2억 암사동"), true);
  });

  it("동일 원문은 같은 해시를 만든다", () => {
    assert.equal(
      hashIntakeSampleText("원룸 전세"),
      hashIntakeSampleText("  원룸   전세 ")
    );
  });
});
