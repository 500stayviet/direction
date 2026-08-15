import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeOcrIntakeText } from "./intakeOcrNormalize.ts";
import { parseIntakeText } from "./intakeParse.ts";

describe("normalizeOcrIntakeText", () => {
  it("OCR 띄어쓰기·폼 라벨을 정리한다", () => {
    const raw = "매물유형 원룸 거래종류 매매 매 매 가 1 억 8 월 25 일";
    const normalized = normalizeOcrIntakeText(raw);
    assert.match(normalized, /원룸/);
    assert.match(normalized, /매매/);
    assert.match(normalized, /1억/);
    assert.doesNotMatch(normalized, /매물유형|거래종류/);

    const parsed = parseIntakeText(normalized, "property");
    assert.equal(parsed.roomType, "원룸");
    assert.equal(parsed.dealType, "매매");
    assert.equal(parsed.deposit, 10000);
    assert.equal(parsed.notes, "");
  });

  it("현장 매매 OCR: 주소·매매가·실입주·단지명·설명", () => {
    const today = new Date(2026, 3, 15);
    const raw = [
      "천호동 314-7 제이디 파크 빌 403호",
      "방 2 거실 주방 화장실 다용도실",
      "엘레베이터 주차",
      "매매 32 , 000 만원 실 입주 가능",
      "( 이사 협의 2 ~ 3 개월 )",
      "26 . 04 . 22",
    ].join(" ");
    const normalized = normalizeOcrIntakeText(raw);
    const parsed = parseIntakeText(normalized, "property", today);
    assert.equal(parsed.dong, "천호동");
    assert.equal(parsed.jibun, "314-7");
    assert.equal(parsed.roomNo, "403호");
    assert.equal(parsed.roomCount, 2);
    assert.equal(parsed.dealType, "매매");
    assert.equal(parsed.deposit, 32000);
    assert.equal(parsed.moveInImmediate, true);
    assert.match(parsed.notes, /제이디파크빌/);
    assert.match(parsed.notes, /거실/);
    assert.match(parsed.notes, /이사 협의/);
  });

  it("현장 월세 OCR: YY.MM.DD·1억/110/관5·주차1대", () => {
    const today = new Date(2026, 3, 15);
    const raw = [
      "26 . 04 . 22",
      "성내동 427-63 201호",
      "방 2 화 1",
      "1 억 / 110 / 관 5",
      "현 임차인 거주중 / 주차 1 대 가능",
    ].join(" ");
    const normalized = normalizeOcrIntakeText(raw);
    const parsed = parseIntakeText(normalized, "property", today);
    assert.equal(parsed.moveInFrom, "2026-04-22");
    assert.equal(parsed.dong, "성내동");
    assert.equal(parsed.jibun, "427-63");
    assert.equal(parsed.roomNo, "201호");
    assert.equal(parsed.roomCount, 2);
    assert.equal(parsed.bathroomCount, 1);
    assert.equal(parsed.dealType, "월세");
    assert.equal(parsed.deposit, 10000);
    assert.equal(parsed.monthlyRent, 110);
    assert.equal(parsed.maintenanceFee, 5);
    assert.equal(parsed.parking, "유");
    assert.match(parsed.notes, /현임차인/);
  });
});
