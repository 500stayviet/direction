import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  findAllDongsInText,
  findDongInText,
  parseSeoulAddress,
  resolveGuFromDong,
} from "./seoulRegions.ts";

describe("resolveGuFromDong", () => {
  it("유일한 동은 구를 바로 찾는다", () => {
    assert.equal(resolveGuFromDong("암사동"), "강동구");
    assert.equal(resolveGuFromDong("천호동"), "강동구");
    assert.equal(resolveGuFromDong("성내동"), "강동구");
    assert.equal(resolveGuFromDong("역삼동"), "강남구");
  });

  it("신사동은 구 힌트가 있을 때만 정한다", () => {
    assert.equal(resolveGuFromDong("신사동"), undefined);
    assert.equal(resolveGuFromDong("신사동", "은평구"), "은평구");
    assert.equal(resolveGuFromDong("신사동", "강남구"), "강남구");
  });
});

describe("findDongInText", () => {
  it("천호2동을 천호동으로 본다", () => {
    const hit = findDongInText("매물 천호2동 바로입주");
    assert.equal(hit?.dong, "천호동");
    assert.equal(hit?.gu, "강동구");
  });

  it("종로구 글자 안의 종로를 동으로 보지 않는다", () => {
    const hit = findDongInText("종로구 혜화동");
    assert.equal(hit?.dong, "혜화동");
    assert.equal(hit?.gu, "종로구");
  });

  it("글에 나온 동을 모두 모은다", () => {
    const hits = findAllDongsInText("강동구 암사동 바로입주 디딤돌 천호동");
    assert.deepEqual(
      hits.map((h) => h.dong),
      ["암사동", "천호동"]
    );
    assert.equal(hits[0]?.gu, "강동구");
    assert.equal(hits[1]?.gu, "강동구");
  });
});

describe("parseSeoulAddress", () => {
  it("구 없이 동·지번만 있어도 구를 채운다", () => {
    assert.deepEqual(parseSeoulAddress("서울 암사동 123-4"), {
      gu: "강동구",
      dong: "암사동",
      detail: "123-4",
    });
    assert.deepEqual(parseSeoulAddress("암사동 88-3"), {
      gu: "강동구",
      dong: "암사동",
      detail: "88-3",
    });
  });

  it("서울 강동구 암사1동을 암사동으로 정규화한다", () => {
    assert.deepEqual(parseSeoulAddress("서울 강동구 암사1동 12-3"), {
      gu: "강동구",
      dong: "암사동",
      detail: "12-3",
    });
  });
});
