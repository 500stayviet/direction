import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  decideIntakeAiCall,
  INTAKE_AI_LIMITS,
  isIntakeAiKeyConfigured,
  resetIntakeAiGuardForTests,
  shouldLogIntakeAiError,
} from "./intakeAiGuard.ts";

describe("intakeAiGuard", () => {
  it("중복·분당 한도에서 DeepSeek를 건너뛴다", () => {
    resetIntakeAiGuardForTests();
    const t0 = 1_700_000_000_000;

    const first = decideIntakeAiCall({
      userId: "u1",
      leftover: "블루하임 남향",
      now: t0,
    });
    const dup = decideIntakeAiCall({
      userId: "u1",
      leftover: "블루하임 남향",
      now: t0 + 10_000,
    });
    assert.equal(first.allow, true);
    assert.equal(dup.allow, false);
    if (!dup.allow) assert.equal(dup.reason, "duplicate");

    resetIntakeAiGuardForTests();
    for (let i = 0; i < INTAKE_AI_LIMITS.userPerMinute; i += 1) {
      const next = decideIntakeAiCall({
        userId: "u2",
        leftover: `잔여 ${i} 단지명`,
        now: t0 + i,
      });
      assert.equal(next.allow, true);
    }
    const blocked = decideIntakeAiCall({
      userId: "u2",
      leftover: "잔여 마지막 단지명",
      now: t0 + INTAKE_AI_LIMITS.userPerMinute,
    });
    assert.equal(blocked.allow, false);
    if (!blocked.allow) assert.equal(blocked.reason, "rate");
  });

  it("같은 AI 에러는 잠시 로그만 줄이고 다음 호출은 막지 않는다", () => {
    resetIntakeAiGuardForTests();
    const t0 = 1_700_000_000_000;
    assert.equal(shouldLogIntakeAiError("balance", t0), true);
    assert.equal(shouldLogIntakeAiError("balance", t0 + 1_000), false);
    const next = decideIntakeAiCall({
      userId: "u3",
      leftover: "파크힐",
      now: t0 + 1_000,
    });
    assert.equal(next.allow, true);
  });

  it("키 설정 여부는 값을 노출하지 않는다", () => {
    assert.equal(isIntakeAiKeyConfigured(""), false);
    assert.equal(isIntakeAiKeyConfigured("   "), false);
    assert.equal(isIntakeAiKeyConfigured("sk-test"), true);
  });
});
