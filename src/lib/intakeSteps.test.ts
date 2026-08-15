import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  INTAKE_GUIDE_STEPS,
  buildIntakeFromSteps,
  parseIntakeStep,
  parseIntakeStepChain,
  splitIntakeStepCancel,
} from "./intakeSteps.ts";

describe("intakeSteps", () => {
  it("단계별로 매물유형만 넣고 뒤 유형은 메모로 보내지 않는다", () => {
    const step = parseIntakeStep("원룸 아파트", "roomType", "property");
    assert.equal(step.ok, true);
    assert.equal(step.partial.roomType, "원룸");
    assert.equal(step.partial.notes, undefined);

    const built = buildIntakeFromSteps({ roomType: step.partial }, "property");
    assert.equal(built.roomType, "원룸");
    assert.equal(built.notes, "");
  });

  it("단계 취소 키워드를 분리한다", () => {
    assert.equal(splitIntakeStepCancel("삭제").cancel, true);
    assert.equal(splitIntakeStepCancel("아니 투룸").remainder, "투룸");
  });

  it("단계별 확정값을 조립한다", () => {
    const room = parseIntakeStep("원룸", "roomType", "property");
    const deal = parseIntakeStep("매매", "dealType", "property");
    const money = parseIntakeStep("1억", "money", "property", {
      ...room.partial,
      ...deal.partial,
      dealType: "매매",
    });
    const built = buildIntakeFromSteps(
      {
        roomType: room.partial,
        dealType: deal.partial,
        money: money.partial,
      },
      "property"
    );
    assert.equal(built.roomType, "원룸");
    assert.equal(built.dealType, "매매");
    assert.equal(built.deposit, 10000);
    assert.equal(built.notes, "");
  });

  it("메모 단계는 입력 그대로 받는다", () => {
    const step = parseIntakeStep("아니 9월 15일", "notes", "property");
    assert.equal(step.ok, true);
    assert.equal(step.partial.notes, "아니 9월 15일");
  });

  it("전체 문장을 다시 말해도 거래가액·일정·플래그를 파싱한다", () => {
    const prior = {
      roomType: "원룸" as const,
      dealType: "매매" as const,
      dong: "성내동",
      gu: "강동구",
      options: [] as string[],
    };
    const full =
      "원룸 매매 강동구 성내동 매매가 2억 9월 15일 대출 무 보증보험 무 주차 유 엘베 무";

    const money = parseIntakeStep(full, "money", "customer", prior);
    assert.equal(money.ok, true);
    assert.equal(money.partial.deposit, 20000);

    const dates = parseIntakeStep(full, "dates", "customer", prior);
    assert.equal(dates.ok, true);
    assert.equal(dates.partial.moveInFrom, "2026-09-15");

    const flags = parseIntakeStep(full, "flags", "customer", prior);
    assert.equal(flags.ok, true);
    assert.equal(flags.partial.loan, "무");

    const flagsAfterLoan = parseIntakeStep(
      "보증보험 무",
      "flags",
      "customer",
      flags.partial
    );
    assert.equal(flagsAfterLoan.partial.insurance, "무");

    const flagsAfterInsurance = parseIntakeStep(
      "주차 유",
      "flags",
      "customer",
      flagsAfterLoan.partial
    );
    assert.equal(flagsAfterInsurance.partial.parking, "유");
  });

  it("대출 가·대출 가능도 유로 받는다", () => {
    assert.equal(parseIntakeStep("대출 가", "flags", "property").partial.loan, "유");
    assert.equal(parseIntakeStep("대출 가능", "flags", "property").partial.loan, "유");
    assert.equal(
      parseIntakeStep("보증보험 불", "flags", "property", {
        loan: "유",
        options: [],
      }).partial.insurance,
      "무"
    );
  });

  it("유/무 줄은 한 항목씩 채운 뒤 다음 줄로 넘긴다", () => {
    const full = "대출 유 보증보험 무 주차 유 엘베 무";
    const priorSteps = {
      roomType: { roomType: "원룸", options: [] },
      dealType: { dealType: "매매", options: [] },
      location: { gu: "강동구", dong: "천호동", options: [] },
      money: { deposit: 20000, options: [] },
      dates: { moveInFrom: "2026-08-25", moveInTo: "2026-09-10", options: [] },
    };
    const flagsIndex = INTAKE_GUIDE_STEPS.property.findIndex(
      (line) => line.key === "flags"
    );
    const chain = parseIntakeStepChain(full, flagsIndex, "property", priorSteps);
    assert.equal(chain.commits.length, 4);
    assert.equal(chain.commits.every((row) => row.key === "flags"), true);
    assert.equal(chain.commits[3]?.partial.loan, "유");
    assert.equal(chain.commits[3]?.partial.insurance, "무");
    assert.equal(chain.commits[3]?.partial.parking, "유");
    assert.equal(chain.commits[3]?.partial.elevator, "무");
    assert.match(chain.commits[3]?.display ?? "", /엘베 무/);
  });

  it("짧은 거래가액 답변에는 이전 맥락을 붙인다", () => {
    const prior = {
      roomType: "원룸" as const,
      dealType: "매매" as const,
      dong: "성내동",
      options: [] as string[],
    };
    const money = parseIntakeStep("매매가 2억", "money", "customer", prior);
    assert.equal(money.ok, true);
    assert.equal(money.partial.deposit, 20000);
  });

  it("전체 문장의 매매 1억은 거래가액 칸에 넣는다", () => {
    const prior = {
      roomType: "원룸" as const,
      dealType: "매매" as const,
      dong: "성내동",
      gu: "강동구",
      options: [] as string[],
    };
    const full = "원룸 매매 강동구 성내동 매매 1억";
    const money = parseIntakeStep(full, "money", "property", prior);
    assert.equal(money.ok, true);
    assert.equal(money.partial.deposit, 10000);
  });

  it("주소 뒤 매매가는 거래가액 줄까지 연속 반영한다", () => {
    const full = "원룸 전세 강동구 천호동 매매가 2억";
    const chain = parseIntakeStepChain(full, 0, "property", {});
    assert.equal(chain.commits.length, 4);
    assert.equal(chain.commits[0]?.key, "roomType");
    assert.equal(chain.commits[1]?.key, "dealType");
    assert.equal(chain.commits[2]?.key, "location");
    assert.equal(chain.commits[3]?.key, "money");
    assert.equal(chain.commits[3]?.partial.deposit, 20000);
    assert.equal(chain.leftover, "");
    const built = buildIntakeFromSteps(
      Object.fromEntries(chain.commits.map((row) => [row.key, row.partial])),
      "property"
    );
    assert.equal(built.roomType, "원룸");
    assert.equal(built.dealType, "전세");
    assert.equal(built.dong, "천호동");
    assert.equal(built.deposit, 20000);
    assert.equal(built.notes, "");
  });

  it("월세 뒤 매매가도 거래가액까지 연속 반영한다", () => {
    const full = "원룸 월세 강동구 천호동 매매가 5억";
    const chain = parseIntakeStepChain(full, 0, "property", {});
    assert.equal(chain.commits.length, 4);
    assert.equal(chain.commits[3]?.key, "money");
    assert.equal(chain.commits[3]?.partial.deposit, 50000);
    const built = buildIntakeFromSteps(
      Object.fromEntries(chain.commits.map((row) => [row.key, row.partial])),
      "property"
    );
    assert.equal(built.dealType, "월세");
    assert.equal(built.deposit, 50000);
    assert.equal(built.notes, "");
  });

  it("대화 고객명 줄은 첫 단어만 칸에 넣는다", () => {
    assert.equal(parseIntakeStep("홍길동", "name", "customer").partial.name, "홍길동");
    assert.equal(parseIntakeStep("명칭 성내", "name", "customer").partial.name, "성내");
    assert.equal(
      parseIntakeStep("고객명 홍길동 010-1234", "name", "customer").partial.name,
      "홍길동"
    );
    assert.equal(parseIntakeStep("홍길동입니다", "name", "customer").partial.name, "홍길동");
    assert.equal(parseIntakeStep("원룸", "name", "customer").partial.name, "원룸");
    assert.equal(parseIntakeStep("홍", "name", "customer").ok, false);
  });
});
