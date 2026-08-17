import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  composePropertyRoomNo,
  formatPropertyPlaceLine,
  formatRoomNoHo,
  splitPropertyRoomNo,
} from "./propertyRoomNo.ts";

describe("propertyRoomNo", () => {
  it("동호수와 호수만 나누고 다시 붙인다", () => {
    assert.deepEqual(splitPropertyRoomNo("101동 102호"), {
      dong: "101",
      ho: "102",
    });
    assert.deepEqual(splitPropertyRoomNo("302호"), { dong: "", ho: "302" });
    assert.equal(composePropertyRoomNo("101", "102"), "101동 102호");
    assert.equal(composePropertyRoomNo("", "302"), "302호");
    assert.equal(formatRoomNoHo("1203"), "1203호");
    assert.equal(formatRoomNoHo("1203호"), "1203호");
    assert.equal(formatRoomNoHo("101동 102호"), "101동 102호");
    assert.equal(formatRoomNoHo("101동"), "101동");
    assert.equal(
      formatPropertyPlaceLine({
        buildingName: "힐스테이트",
        roomNo: "101동 102호",
      }),
      "힐스테이트 101동 102호"
    );
  });
});
