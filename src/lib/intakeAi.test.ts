import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  intakeAiLeftover,
  mergeIntakeAi,
  sanitizeIntakeAiPatch,
} from "./intakeAi.ts";
import { parseIntakeText } from "./intakeParse.ts";

describe("intakeAiLeftover", () => {
  it("룰이 채운 칸은 빼고 단지명 같은 잔여만 남긴다", () => {
    const leftover = intakeAiLeftover(
      "암사동 원룸 전세 2억 블루하임 남향",
      {
        roomType: "원룸",
        dealType: "전세",
        deposit: 20000,
        dong: "암사동",
        gu: "강동구",
        options: [],
        notes: "남향",
      },
      "message"
    );
    assert.match(leftover, /블루하임/);
    assert.doesNotMatch(leftover, /암사동|원룸|전세|2억|남향/);
  });

  it("잔여가 이미 내용에 있으면 API를 건너뛴다", () => {
    const raw = `천호동 314-7 제이디파크빌 403호
방2 거실 주방
매매 32,000만원 실입주 가능
26.04.22`;
    const parsed = parseIntakeText(raw, "property");
    assert.match(parsed.notes, /제이디파크빌/);
    assert.equal(intakeAiLeftover(raw, parsed, "message"), "");
  });

  it("사진 잔여는 280자에서 자른다", () => {
    const hangul = "가나다라마바사아자차".repeat(40);
    const raw = `암사동 원룸 전세 2억 ${hangul}`;
    const parsed = parseIntakeText(raw, "customer");
    const leftover = intakeAiLeftover(raw, parsed, "photo");
    assert.ok(leftover.length <= 280);
    assert.ok(leftover.length >= 200);
  });
});

describe("mergeIntakeAi", () => {
  it("빈 칸만 채우고 금액은 덮지 않는다", () => {
    const parsed = parseIntakeText("원룸 전세 2억 암사동", "customer");
    const merged = mergeIntakeAi(parsed, {
      name: "김철수",
      dong: "천호동",
      memo: "남향 희망",
      deposit: 99999,
      monthlyRent: 50,
      dealType: "월세",
    });
    assert.equal(merged.name, "김철수");
    assert.equal(merged.dong, "암사동");
    assert.equal(merged.deposit, 20000);
    assert.equal(merged.dealType, "전세");
    assert.equal(merged.monthlyRent, undefined);
    assert.match(merged.notes, /남향 희망/);
  });

  it("비어 있는 동·날짜만 채우고 애매한 점은 날짜로 쓰지 않는다", () => {
    const parsed = parseIntakeText("원룸 전세 2억", "customer");
    const filled = mergeIntakeAi(parsed, {
      dong: "암사동",
      gu: "강동구",
      moveInFrom: "2026-04-22",
    });
    assert.equal(filled.dong, "암사동");
    assert.equal(filled.gu, "강동구");
    assert.equal(filled.moveInFrom, "2026-04-22");

    const rejected = mergeIntakeAi(parsed, { moveInFrom: "8.25", dong: "가짜동" });
    assert.equal(rejected.moveInFrom, undefined);
    assert.equal(rejected.dong, undefined);
  });

  it("이사 협의는 날짜로 넣지 않고 단지명은 내용에 붙인다", () => {
    const parsed = parseIntakeText("원룸 월세 성내동", "property");
    const merged = mergeIntakeAi(
      parsed,
      {
        buildingName: "파크힐",
        moveInFrom: "2026-05-01",
        memo: "이사 협의 2~3개월",
      },
      "이사 협의 2~3개월 파크힐"
    );
    assert.equal(merged.moveInFrom, undefined);
    assert.match(merged.notes, /파크힐/);
    assert.match(merged.notes, /이사 협의/);
  });
});

describe("sanitizeIntakeAiPatch", () => {
  it("전화·금액 키는 버리고 서울 동만 받는다", () => {
    const patch = sanitizeIntakeAiPatch({
      phone: "01012345678",
      deposit: 1000,
      dong: "암사동",
      name: "성내동",
      roomNo: "201호",
    });
    assert.equal(patch.dong, "암사동");
    assert.equal(patch.roomNo, "201호");
    assert.equal(patch.name, undefined);
    assert.equal("phone" in patch, false);
    assert.equal("deposit" in patch, false);
  });
});
