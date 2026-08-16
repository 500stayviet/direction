import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isScheduleEnded, isVisitLapsed } from "./date.ts";

describe("isVisitLapsed", () => {
  it("방문 시각 12시간 전에는 false", () => {
    const now = new Date("2026-08-16T21:59:00+09:00");
    assert.equal(isVisitLapsed("2026-08-16", "10:00", now), false);
  });

  it("방문 시각 12시간 후에는 true", () => {
    const now = new Date("2026-08-16T22:00:00+09:00");
    assert.equal(isVisitLapsed("2026-08-16", "10:00", now), true);
  });

  it("한 자리 시각도 동일하게 계산한다", () => {
    const now = new Date("2026-08-16T21:00:00+09:00");
    assert.equal(isVisitLapsed("2026-08-16", "9:00", now), true);
    assert.equal(isVisitLapsed("2026-08-16", "9:00", new Date("2026-08-16T20:59:00+09:00")), false);
  });

  it("시각이 없으면 당일 0시부터 12시간을 센다", () => {
    const now = new Date("2026-08-16T12:00:00+09:00");
    assert.equal(isVisitLapsed("2026-08-16", undefined, now), true);
    assert.equal(isVisitLapsed("2026-08-16", "", new Date("2026-08-16T11:59:00+09:00")), false);
  });
});

describe("isScheduleEnded", () => {
  it("완료 표시면 시각과 상관없이 종료", () => {
    const now = new Date("2026-08-16T09:00:00+09:00");
    assert.equal(
      isScheduleEnded(
        {
          visitCompleted: true,
          visitDate: "2026-08-20",
          visitTime: "10:00",
        },
        now
      ),
      true
    );
  });

  it("미완료여도 12시간이 지나면 종료", () => {
    const now = new Date("2026-08-16T22:00:00+09:00");
    assert.equal(
      isScheduleEnded(
        {
          visitCompleted: false,
          visitDate: "2026-08-16",
          visitTime: "10:00",
        },
        now
      ),
      true
    );
  });
});
