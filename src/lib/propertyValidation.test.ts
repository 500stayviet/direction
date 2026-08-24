import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createEmptyProperty } from "./constants.ts";
import { getMissingRequiredFields } from "./propertyValidation.ts";

describe("propertyValidation 건물 종류", () => {
  it("건물 매물은 건물 종류가 빠지면 필수", () => {
    const missing = getMissingRequiredFields({
      ...createEmptyProperty(),
      roomType: "건물",
      dealType: "매매",
      deposit: 10000,
      elevator: true,
    });
    assert.ok(missing.includes("buildingKind"));
  });

  it("건물 종류를 고르면 해당 필드는 통과", () => {
    const missing = getMissingRequiredFields({
      ...createEmptyProperty(),
      roomType: "건물",
      buildingKind: "근생건물",
      dealType: "매매",
      deposit: 10000,
      elevator: true,
    });
    assert.equal(missing.includes("buildingKind"), false);
  });

  it("원룸은 건물 종류를 묻지 않는다", () => {
    const missing = getMissingRequiredFields({
      ...createEmptyProperty(),
      roomType: "원룸",
      roomCount: 1,
      bathroomCount: 1,
    });
    assert.equal(missing.includes("buildingKind"), false);
  });
});

describe("propertyValidation 주차·엘베 생략", () => {
  it("아파트 매매는 주차·엘베 미입력도 통과", () => {
    const missing = getMissingRequiredFields({
      ...createEmptyProperty(),
      roomType: "아파트",
      roomCount: 3,
      bathroomCount: 1,
      dealType: "매매",
      deposit: 50000,
      loanAvailable: "유",
    });
    assert.ok(!missing.includes("parking"));
    assert.ok(!missing.includes("elevator"));
  });

  it("원룸 매매는 주차 생략·엘베는 필수", () => {
    const missing = getMissingRequiredFields({
      ...createEmptyProperty(),
      roomType: "원룸",
      roomCount: 1,
      bathroomCount: 1,
      dealType: "매매",
      deposit: 10000,
      loanAvailable: "유",
    });
    assert.ok(!missing.includes("parking"));
    assert.ok(missing.includes("elevator"));
  });
});
