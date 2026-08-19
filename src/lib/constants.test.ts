import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatUnitCountsLine,
  pruneUnitCountsForKind,
  unitKeysForBuildingKind,
  normalizeBuildingKind,
  needsMaintenanceFee,
} from "./constants.ts";

describe("건물 종류 방·상가수", () => {
  it("예전 상가주택·다가구 저장값을 새 이름으로 맞춘다", () => {
    assert.equal(normalizeBuildingKind("상가주택"), "상가주택(다가구)");
    assert.equal(normalizeBuildingKind("다가구"), "단독주택(다중주택)");
    assert.equal(normalizeBuildingKind("다세대주택"), "다세대주택");
  });
  it("다중주택·상가주택은 원룸·투룸·3룸+·상가", () => {
    assert.deepEqual(unitKeysForBuildingKind("단독주택(다중주택)"), [
      "원룸",
      "투룸",
      "3룸+",
      "상가",
    ]);
    assert.deepEqual(unitKeysForBuildingKind("상가주택(다가구)"), [
      "원룸",
      "투룸",
      "3룸+",
      "상가",
    ]);
  });

  it("다세대주택은 원룸·투룸·3룸+", () => {
    assert.deepEqual(unitKeysForBuildingKind("다세대주택"), [
      "원룸",
      "투룸",
      "3룸+",
    ]);
  });

  it("근생건물은 상가·사무실", () => {
    assert.deepEqual(unitKeysForBuildingKind("근생건물"), ["상가", "사무실"]);
  });

  it("종류를 바꾸면 안 쓰는 칸은 0으로 비운다", () => {
    const pruned = pruneUnitCountsForKind(
      { 원룸: 3, 투룸: 1, "3룸+": 0, 상가: 2, 사무실: 4 },
      "근생건물"
    );
    assert.equal(pruned.원룸, 0);
    assert.equal(pruned.투룸, 0);
    assert.equal(pruned.상가, 2);
    assert.equal(pruned.사무실, 4);
  });

  it("표시 줄은 종류에 맞는 0보다 큰 값만 붙인다", () => {
    assert.equal(
      formatUnitCountsLine(
        { 원룸: 2, 투룸: 0, "3룸+": 1, 상가: 1, 사무실: 3 },
        "단독주택(다중주택)"
      ),
      "원룸 2 · 3룸+ 1 · 상가 1"
    );
    assert.equal(
      formatUnitCountsLine(
        { 원룸: 2, 투룸: 0, "3룸+": 1, 상가: 1, 사무실: 3 },
        "근생건물"
      ),
      "상가 1 · 사무실 3"
    );
  });
});

describe("관리비", () => {
  it("전세·월세만 관리비가 있다", () => {
    assert.equal(needsMaintenanceFee("전세", "원룸"), true);
    assert.equal(needsMaintenanceFee("월세", "아파트"), true);
    assert.equal(needsMaintenanceFee("매매", "원룸"), false);
    assert.equal(needsMaintenanceFee("전세", "토지"), false);
    assert.equal(needsMaintenanceFee("매매", "건물"), false);
    assert.equal(needsMaintenanceFee(undefined, "원룸"), false);
  });
});
