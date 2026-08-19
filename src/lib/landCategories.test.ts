import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  landUseZonesForCategory,
  needsLandUseZone,
  pruneLandUseForCategory,
} from "./landCategories.ts";

describe("토지 용도지역", () => {
  it("대·잡종지는 용도지역을 고르고 전·답·임야는 숨긴다", () => {
    assert.equal(needsLandUseZone("대"), true);
    assert.equal(needsLandUseZone("잡종지"), true);
    assert.equal(needsLandUseZone("공장용지"), true);
    assert.equal(needsLandUseZone("전"), false);
    assert.equal(needsLandUseZone("답"), false);
    assert.equal(needsLandUseZone("임야"), false);
    assert.equal(needsLandUseZone(""), false);
  });

  it("대는 주거 용도지역이 나오고 공장용지는 공업만 나온다", () => {
    assert.ok(landUseZonesForCategory("대").includes("제2종일반주거"));
    assert.equal(landUseZonesForCategory("공장용지").includes("제2종일반주거"), false);
    assert.ok(landUseZonesForCategory("공장용지").includes("일반공업"));
  });

  it("지목을 바꾸면 안 맞는 용도지역은 비운다", () => {
    assert.equal(
      pruneLandUseForCategory("대", "제2종일반주거"),
      "제2종일반주거"
    );
    assert.equal(pruneLandUseForCategory("전", "제2종일반주거"), "");
    assert.equal(pruneLandUseForCategory("공장용지", "제2종일반주거"), "");
  });
});
