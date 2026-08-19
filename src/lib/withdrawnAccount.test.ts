import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  WITHDRAWN_USERNAME_COOLDOWN_DAYS,
  daysUntilUsernameReusable,
  isUsernameInWithdrawnCooldown,
  withdrawnUsernameBlockedMessage,
  withdrawnUsernameCooldownEnds,
} from "./withdrawnAccount.ts";

describe("withdrawnAccount cooldown", () => {
  it("탈퇴 직후에는 쿨다운 중", () => {
    const deletedAt = "2026-08-01T00:00:00.000Z";
    const now = new Date("2026-08-10T00:00:00.000Z");
    assert.equal(isUsernameInWithdrawnCooldown(deletedAt, now), true);
  });

  it("30일 경과 후에는 재가입 가능", () => {
    const deletedAt = "2026-07-01T00:00:00.000Z";
    const now = new Date("2026-08-01T00:00:00.000Z");
    assert.equal(isUsernameInWithdrawnCooldown(deletedAt, now), false);
  });

  it("쿨다운 종료 시각은 탈퇴일 + 30일", () => {
    const deletedAt = "2026-08-01T12:00:00.000Z";
    const end = withdrawnUsernameCooldownEnds(deletedAt);
    assert.equal(end.toISOString(), "2026-08-31T12:00:00.000Z");
  });

  it("남은 일수 메시지", () => {
    const deletedAt = "2026-08-01T00:00:00.000Z";
    const now = new Date("2026-08-20T00:00:00.000Z");
    assert.equal(daysUntilUsernameReusable(deletedAt, now), 11);
    assert.match(withdrawnUsernameBlockedMessage(deletedAt, now), /11일 후/);
  });

  it("상수는 30일", () => {
    assert.equal(WITHDRAWN_USERNAME_COOLDOWN_DAYS, 30);
  });
});
