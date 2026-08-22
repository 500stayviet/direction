import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isPropertyShareText,
  preprocessPropertyShareText,
} from "./shareIntakePreprocess.ts";
import { parseIntakeText } from "./intakeParse.ts";
import { buildPropertyShareText } from "./shareProperty.ts";
import type { Property } from "./types.ts";

const USER_SHARE_SAMPLE = `매물 안내

■ 1번 매물
주소: 서울특별시 강동구 성내동 540
방문 약속: 오전 10시
유형: 원룸 · 전세
금액: 보증금 1억
관리비: 10만 (인터넷, TV, 수도, 전기)
입주 가능: 2026년 9월 4일 ~ 2026년 10월 12일
대출: 가능
보증보험: 가능
주차: 유 · 별도 · 5만
엘리베이터: 유
옵션: 에어컨, 냉장고, 세탁기, 인덕션
메모: 협력부동산에서 받은 체험 매물입니다. 원터치 네비를 눌러 길찾기를 시험해 보세요.
현관 1234* · 호실 5678*

────────────
천호동 공인중개사사무소
담당 백 경엽
010-5803-1554
-제공-
앱 현장동선`;

describe("property share intake preprocess", () => {
  it("매물 안내 공유문을 인식한다", () => {
    assert.equal(isPropertyShareText(USER_SHARE_SAMPLE), true);
    assert.equal(isPropertyShareText("매물등록 양식\n\n임차인"), false);
  });

  it("푸터·헤더를 제거하고 파서용 메시지로 바꾼다", () => {
    const pre = preprocessPropertyShareText(USER_SHARE_SAMPLE);
    assert.ok(pre);
    assert.match(pre!, /원룸/);
    assert.match(pre!, /전세/);
    assert.match(pre!, /성내동\s*540/);
    assert.match(pre!, /보증금\s*1억/);
    assert.match(pre!, /관리비/);
    assert.match(pre!, /대출\s*유/);
    assert.match(pre!, /엘리베이터\s*유/);
    assert.match(pre!, /방문 약속/);
    assert.match(pre!, /현관 1234/);
    assert.doesNotMatch(pre!, /010-5803-1554/);
    assert.doesNotMatch(pre!, /-제공-/);
  });

  it("전처리 후 룰 파서가 핵심 필드를 읽는다", () => {
    const pre = preprocessPropertyShareText(USER_SHARE_SAMPLE);
    const parsed = parseIntakeText(pre!, "property");
    assert.equal(parsed.roomType, "원룸");
    assert.equal(parsed.dealType, "전세");
    assert.equal(parsed.deposit, 10_000);
    assert.equal(parsed.loan, "유");
    assert.equal(parsed.elevator, "유");
    assert.ok(parsed.options.length >= 1, JSON.stringify(parsed.options));
    assert.match(parsed.notes, /협력부동산/);
    assert.match(parsed.notes, /현관 1234/);
  });

  it("buildPropertyShareText 출력도 전처리 가능", () => {
    const property = {
      id: "p1",
      address: "서울특별시 강동구 성내동 540",
      roomType: "원룸",
      dealType: "전세",
      deposit: 100_000_000,
      monthlyRent: 0,
      loanAvailable: "유",
      insuranceType: "유",
      parkingType: "유",
      parkingFeeType: "별도",
      parkingFee: 5,
      elevator: "유",
      maintenanceFee: 10,
      maintenanceIncludes: ["인터넷", "TV", "수도", "전기"],
      moveInStart: "2026-09-04",
      moveInEnd: "2026-10-12",
      options: ["에어컨", "냉장고"],
      notes: "테스트 메모",
    } as Property;

    const share = buildPropertyShareText([property], {
      shopName: "천호동",
      name: "백경엽",
      phone: "01058031554",
      username: "agent",
    });
    assert.equal(isPropertyShareText(share), true);
    const pre = preprocessPropertyShareText(share);
    assert.ok(pre);
    const parsed = parseIntakeText(pre!, "property");
    assert.equal(parsed.roomType, "원룸");
    assert.equal(parsed.dealType, "전세");
  });
});
