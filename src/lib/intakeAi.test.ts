import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildFilledFieldsSummary,
  intakeAiLeftover,
  leftoverForMemoAppend,
  leftoverNeedsAi,
  mergeIntakeAi,
  sanitizeIntakeAiPatch,
  shouldCallIntakeAi,
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

  it("희망 문장은 통째로 남기고 칸에 쓴 문장은 빼다", () => {
    const raw =
      "원룸 월세 2000/65 강동구천호동 엘베는 없어도되는데 있으면 좋아요";
    const parsed = parseIntakeText(raw, "customer");
    assert.equal(parsed.deposit, 2000);
    assert.equal(parsed.monthlyRent, 65);
    assert.equal(parsed.elevator, undefined);
    const leftover = intakeAiLeftover(raw, parsed, "message");
    assert.match(leftover, /엘베는 없어도되는데 있으면 좋아요/);
    assert.doesNotMatch(leftover, /강동9|강동구|천호동|2000|65|원룸|월세/);
    assert.equal(leftoverNeedsAi(leftover, parsed), false);
  });

  it("엘베 유와 희망 문장이 같이 있으면 유는 남기고 희망만 leftover", () => {
    const raw =
      "원룸 월세 2000/65 강동구 천호동 엘리베이터 유 엘베는 없어도되는데 있으면 좋아요 보증보험은 허그 가입합니다.";
    const parsed = parseIntakeText(raw, "customer");
    assert.equal(parsed.elevator, "유");
    const leftover = intakeAiLeftover(raw, parsed, "message");
    assert.match(leftover, /엘베는 없어도되는데 있으면 좋아요/);
    assert.match(leftover, /보증보험은 허그/);
    assert.doesNotMatch(leftover, /엘리베이터 유/);
    assert.equal(leftoverNeedsAi(leftover, parsed), false);
  });

  it("라벨 메모는 잔여에서 빼서 같은 글을 두 번 붙이지 않는다", () => {
    const raw = `김영희
010-9876-5432
월세
원룸
보증금 1000 / 월세 50
강동구 성내동
대출 유
주차 유
메모: 저층 남향 저녁시간 방문불가 아기있음 주차는 낮에만가능`;
    const parsed = parseIntakeText(raw, "customer");
    assert.match(parsed.notes, /주차는 낮에만가능/);
    assert.equal(parsed.notes.split("\n").length, 1);
    assert.equal(intakeAiLeftover(raw, parsed, "message"), "");
  });

  it("선호 동이 여러 개여도 구·동은 잔여에서 뺀다", () => {
    const raw =
      "임지나 01055555555 월세 원룸 2000/65 강동구 천호동 고덕동 8월21일 ~ 10월 22일 대출 무 전세보증보험 유 주차 유 엘리베이터 유 엘베는 없어도되는데 있으면 좋아요 보증보험은 허그 가입합니다.";
    const parsed = parseIntakeText(raw, "customer");
    const leftover = intakeAiLeftover(raw, parsed, "message");
    assert.doesNotMatch(leftover, /강동9|천호동|고덕동|강동구/);
    assert.equal(leftoverNeedsAi(leftover, parsed), false);
  });

  it("칸에 넣은 구·동은 붙여 쓴 원문도 잔여에서 빼고 희망사항만 남긴다", () => {
    const raw =
      "원룸 월세 2000/65 강동구천호동 엘베는 없어도되는데 있으면 좋아요";
    const parsed = parseIntakeText(raw, "customer");
    const leftover = intakeAiLeftover(raw, parsed, "message");
    assert.doesNotMatch(leftover, /강동9|강동구|천호동|2000|65|원룸|월세/);
    assert.match(leftover, /엘베는 없어도되는데 있으면 좋아요/);
  });

  it("오염된 주소 잔여는 고객·매물 모두 AI·내용에 쓰지 않는다", () => {
    const customer = parseIntakeText(
      "원룸 월세 강동구 천호동 2000/65",
      "customer"
    );
    const property = parseIntakeText(
      "원룸 월세 강동구 천호동 2000/65",
      "property"
    );
    assert.equal(intakeAiLeftover("강동9천호동", customer, "message"), "");
    assert.equal(intakeAiLeftover("강동9천호동", property, "message"), "");
    assert.equal(leftoverNeedsAi("강동9천호동", customer), false);
    assert.equal(leftoverNeedsAi("강동9천호동", property), false);
    const merged = mergeIntakeAi(customer, {
      buildingName: "강동9천호동",
      memo: "강동9천호동 남향",
    }, "강동9천호동");
    assert.doesNotMatch(merged.notes, /강동9/);
    assert.match(merged.notes, /남향/);
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

  it("일요일 불가만 있으면 API를 건너뛴다", () => {
    const parsed = parseIntakeText("원룸 전세 2억 암사동", "property");
    assert.equal(leftoverNeedsAi("일요일불가", parsed), false);
    assert.equal(
      leftoverNeedsAi("집보는건 일요일불가 저녁타임 예약", parsed),
      false
    );
  });

  it("고객 메시지 잔여: 금액·유무 필 줄임말은 빼고 희망 문장만 남긴다", () => {
    const raw =
      "강동구 천호동 111-1 101호 전세가 2억/50만원\n관5만 주차필 보증필 대출필 엘베필 낮시간 방문불가";
    const parsed = parseIntakeText(raw, "customer");
    const leftover = intakeAiLeftover(raw, parsed, "message");
    assert.equal(leftover, "낮시간 방문불가");
    assert.equal(leftoverForMemoAppend(leftover, parsed, "message"), "낮시간 방문불가");
    assert.equal(leftoverNeedsAi(leftover, parsed), false);
  });

  it("칸 조각만 남은 잔여는 메모에 붙이지 않는다", () => {
    const parsed = parseIntakeText("원룸 전세 2억 암사동", "customer");
    assert.equal(
      leftoverForMemoAppend("전세가 만 주차필 보증필", parsed, "message"),
      ""
    );
  });

  it("숫자·칸 잔여가 섞인 글은 API로 보낸다", () => {
    const raw = [
      "천호동 314-7 제이디파크빌 403호",
      "방2 거실 주방 화장실 다용도실",
      "엘레베이터 주차",
      "매매 32,000만원 실입주 가능",
      "(이사 협의 2~3개월)",
      "집 보는거는 저녁타임 미리 예약 하고 가능합니다. 집보는건 일요일불가",
    ].join("\n");
    const parsed = parseIntakeText(raw, "property");
    const leftover = intakeAiLeftover(raw, parsed, "message");
    assert.match(leftover, /일요일불가/);
    assert.equal(leftoverNeedsAi(leftover, parsed), true);
  });

  it("동이 비어 있고 잔여에 동이 있으면 API가 필요하다", () => {
    const leftover = "성내동 파크힐";
    const parsed = parseIntakeText("원룸 전세 2억", "property");
    assert.equal(parsed.dong, undefined);
    assert.equal(leftoverNeedsAi(leftover, parsed), true);
  });

  it("칸에 넣은 날짜·유무 잔여는 메모가 아니라 API로 보낸다", () => {
    const leftover = "보증금 3월 1일 ~ 4월 15일 대출 유 보증보험 무 유 유 메모";
    const parsed = parseIntakeText(
      "원룸 월세 성내동 3월 1일 ~ 4월 15일 대출 유",
      "customer"
    );
    assert.equal(leftoverNeedsAi(leftover, parsed), true);
  });

  it("사진 잔여는 280자에서 자른다", () => {
    const hangul = "가나다라마바사아자차".repeat(40);
    const raw = `암사동 원룸 전세 2억 ${hangul}`;
    const parsed = parseIntakeText(raw, "customer");
    const leftover = intakeAiLeftover(raw, parsed, "photo");
    assert.ok(leftover.length <= 280);
    assert.ok(leftover.length >= 200);
  });

  it("보증금이 비면 잔여에서 금액을 남긴다", () => {
    const leftover = intakeAiLeftover(
      "원룸 전세 2억 블루하임",
      {
        roomType: "원룸",
        dealType: "전세",
        options: [],
        notes: "",
      },
      "message"
    );
    assert.match(leftover, /2억/);
    assert.match(leftover, /블루하임/);
    assert.doesNotMatch(leftover, /전세|원룸/);
    assert.equal(
      leftoverNeedsAi(leftover, {
        roomType: "원룸",
        dealType: "전세",
        options: [],
        notes: "",
      }),
      true
    );
  });
});

describe("shouldCallIntakeAi", () => {
  it("분명한 메모만 남으면 AI를 부르지 않는다", () => {
    const parsed = parseIntakeText(
      "강동구 천호동 111-1 101호 전세가 2억/50만원\n관5만 주차필 보증필 대출필 엘베필 낮시간 방문불가",
      "customer"
    );
    const leftover = intakeAiLeftover(
      "강동구 천호동 111-1 101호 전세가 2억/50만원\n관5만 주차필 보증필 대출필 엘베필 낮시간 방문불가",
      parsed,
      "message"
    );
    assert.equal(leftover, "낮시간 방문불가");
    assert.equal(shouldCallIntakeAi(leftover, parsed, "message"), false);
  });

  it("빈 칸 채울 단서가 있으면 AI를 부른다", () => {
    const parsed = parseIntakeText("원룸 전세 2억", "property");
    assert.equal(shouldCallIntakeAi("성내동 파크힐", parsed, "message"), true);
  });
});

describe("buildFilledFieldsSummary", () => {
  it("채워진 칸만 요약한다", () => {
    const parsed = parseIntakeText(
      "강동구 천호동 111-1 101호 전세가 2억/50만원\n관5만 주차필 보증필 대출필 엘베필 낮시간 방문불가",
      "customer"
    );
    const summary = buildFilledFieldsSummary(parsed);
    assert.equal(summary.dealType, "월세");
    assert.equal(summary.deposit, 20000);
    assert.equal(summary.monthlyRent, 50);
    assert.equal(summary.loan, "유");
    assert.equal(summary.parking, "유");
    assert.equal("name" in summary, false);
    assert.equal("jibun" in summary, false);
  });
});

describe("mergeIntakeAi", () => {
  it("AI memo에 칸 조각이 있으면 내용에 붙이지 않는다", () => {
    const parsed = parseIntakeText("원룸 전세 2억 암사동", "customer");
    const merged = mergeIntakeAi(parsed, {
      memo: "전세가 만 주차필 보증필",
    });
    assert.equal(merged.notes, parsed.notes);
  });

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

  it("거래종류·보증금이 비면 채운다", () => {
    const parsed = parseIntakeText("원룸 암사동 블루하임", "customer");
    assert.equal(parsed.dealType, undefined);
    assert.equal(parsed.deposit, undefined);
    const merged = mergeIntakeAi(
      parsed,
      { dealType: "전세", deposit: 2, memo: "남향" },
      "전세 2억 블루하임 남향"
    );
    assert.equal(merged.dealType, "전세");
    assert.equal(merged.deposit, 20000);
    assert.match(merged.notes, /남향/);
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
  it("전화는 버리고 빈 거래종류·보증금은 받는다", () => {
    const patch = sanitizeIntakeAiPatch(
      {
        phone: "01012345678",
        deposit: 2,
        dealType: "전세",
        dong: "암사동",
        name: "성내동",
        roomNo: "201호",
      },
      "전세 2억"
    );
    assert.equal(patch.dong, "암사동");
    assert.equal(patch.roomNo, "201호");
    assert.equal(patch.dealType, "전세");
    assert.equal(patch.deposit, 20000);
    assert.equal(patch.name, undefined);
    assert.equal("phone" in patch, false);
  });
});
