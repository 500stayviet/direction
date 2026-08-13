import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  completedPreferredGus,
  defaultPreferredLocation,
  encodePreferredDong,
  formatPreferredLocationLabel,
  parsePreferredDong,
  preferredLocationRows,
} from "./preferredLocation.ts";

describe("preferredLocation", () => {
  it("encode/parse 구|동", () => {
    const raw = encodePreferredDong("강동구", "성내동");
    assert.equal(raw, "강동구|성내동");
    assert.deepEqual(parsePreferredDong(raw), {
      gu: "강동구",
      dong: "성내동",
    });
  });

  it("기본값은 강동구·성내동이다", () => {
    assert.deepEqual(defaultPreferredLocation(), {
      preferredGus: ["강동구"],
      preferredDongs: ["강동구|성내동"],
    });
  });

  it("원룸 등에서도 선호위치 행을 만든다", () => {
    const rows = preferredLocationRows({
      preferredGus: ["강동구"],
      preferredDongs: ["강동구|성내동", "강동구|천호동"],
    });
    assert.deepEqual(rows, [
      { gu: "강동구", dongsLabel: "성내동, 천호동" },
    ]);
    assert.equal(
      formatPreferredLocationLabel({
        preferredGus: ["강동구"],
        preferredDongs: ["강동구|성내동"],
      }),
      "강동구 성내동"
    );
  });

  it("preferredGus가 비어도 동에서 구를 복원한다", () => {
    const rows = preferredLocationRows({
      preferredGus: [],
      preferredDongs: ["송파구|잠실동"],
    });
    assert.deepEqual(rows, [{ gu: "송파구", dongsLabel: "잠실동" }]);
    assert.deepEqual(completedPreferredGus([], ["송파구|잠실동"]), [
      "송파구",
    ]);
  });

  it("동이 없으면 표시 행이 없다", () => {
    assert.deepEqual(
      preferredLocationRows({ preferredGus: ["강동구"], preferredDongs: [] }),
      []
    );
  });
});
