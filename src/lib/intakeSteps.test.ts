import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  INTAKE_GUIDE_STEPS,
  allGuideStepsComplete,
  buildIntakeFromSteps,
  parseIntakeStep,
  parseIntakeStepChain,
  firstIncompleteGuideIndex,
  flagsStepComplete,
  guideStepComplete,
  splitIntakeStepCancel,
  moneyStepExample,
  dealTypeStepExample,
  inferDealTypeFromMoney,
  resolveTalkDealType,
  datesStepNeedsHold,
  locationStepReadyToAdvance,
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
    assert.equal(flags.partial.insurance, "무");
    assert.equal(flags.partial.parking, "유");
    assert.equal(flags.partial.elevator, undefined);

    const elevator = parseIntakeStep(full, "elevator", "customer");
    assert.equal(elevator.partial.elevator, "무");
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

  it("flags는 순서 상관없이 한 발화에서 여러 항목을 채운다", () => {
    const step = parseIntakeStep("주차 유 대출 무 보증 유", "flags", "property");
    assert.equal(step.ok, true);
    assert.equal(step.partial.parking, "유");
    assert.equal(step.partial.loan, "무");
    assert.equal(step.partial.insurance, "유");
  });

  it("보증 가·보증 가능·보증 유도 보증보험으로 받는다", () => {
    assert.equal(
      parseIntakeStep("보증 가", "flags", "property").partial.insurance,
      "유"
    );
    assert.equal(
      parseIntakeStep("보증 가능", "flags", "property").partial.insurance,
      "유"
    );
    assert.equal(
      parseIntakeStep("보증 유", "flags", "property").partial.insurance,
      "유"
    );
    assert.equal(parseIntakeStep("보증", "flags", "property").ok, false);
  });

  it("flags 칸은 여러 구절을 이어 붙여도 누적된다", () => {
    let prior: Partial<IntakeParseResult> = { options: [] };
    const first = parseIntakeStep("대출 가능", "flags", "property", prior);
    assert.equal(first.partial.loan, "유");
    prior = { ...prior, ...first.partial };
    const second = parseIntakeStep(
      "대출 가능 보증 불가",
      "flags",
      "property",
      prior
    );
    assert.equal(second.partial.loan, "유");
    assert.equal(second.partial.insurance, "무");
    prior = { ...prior, ...second.partial };
    const third = parseIntakeStep(
      "대출 가능 보증 불가 주차 가능 엘베 불가",
      "flags",
      "property",
      prior
    );
    assert.equal(flagsStepComplete(third.partial), true);
    assert.equal(third.partial.elevator, undefined);
    const elevator = parseIntakeStep("엘베 불가", "elevator", "property");
    assert.equal(elevator.partial.elevator, "무");
  });

  it("보증만 말해도 보증보험 유/무로 받는다", () => {
    assert.equal(
      parseIntakeStep("보증 무", "flags", "property").partial.insurance,
      "무"
    );
  });

  it("유/무 줄은 한 발화에 모두 있으면 한 번에 채운다", () => {
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
    assert.equal(chain.commits.length, 2);
    assert.equal(chain.commits[0]?.key, "flags");
    assert.equal(chain.commits[0]?.partial.loan, "유");
    assert.equal(chain.commits[0]?.partial.insurance, "무");
    assert.equal(chain.commits[0]?.partial.parking, "유");
    assert.equal(chain.commits[0]?.partial.elevator, undefined);
    assert.doesNotMatch(chain.commits[0]?.display ?? "", /엘베/);
    assert.equal(chain.commits[1]?.key, "elevator");
    assert.equal(chain.commits[1]?.partial.elevator, "무");
    assert.match(chain.commits[1]?.display ?? "", /엘베무/);
  });

  it("flags remainder는 채운 항목만 순서와 상관없이 소비한다", () => {
    const priorSteps = {
      dates: { moveInFrom: "2026-08-25", moveInTo: "2026-09-10", options: [] },
      flags: { loan: "유", insurance: "무", options: [] },
    };
    const flagsIndex = INTAKE_GUIDE_STEPS.property.findIndex(
      (line) => line.key === "flags"
    );
    const chain = parseIntakeStepChain(
      "주차 가능",
      flagsIndex,
      "property",
      priorSteps
    );
    assert.equal(chain.commits.length, 1);
    assert.equal(chain.commits[0]?.partial.parking, "유");
    assert.equal(chain.commits[0]?.partial.loan, "유");
    assert.equal(chain.commits[0]?.partial.insurance, "무");
  });

  it("거래종류·거래가액 예시는 선택·금액에 맞춰 하나만 보여 준다", () => {
    assert.equal(moneyStepExample("월세"), "보증금 1억 · 월세 50");
    assert.equal(moneyStepExample("전세"), "보증금 1억");
    assert.equal(moneyStepExample("매매"), "매매 3억 5천");
    assert.equal(dealTypeStepExample(undefined), "매매 전세 월세");
    assert.equal(dealTypeStepExample("전세"), "전세");
    assert.equal(inferDealTypeFromMoney({ monthlyRent: 50, options: [] }), "월세");
    assert.equal(inferDealTypeFromMoney({ deposit: 10000, options: [] }), "전세");
    assert.equal(
      inferDealTypeFromMoney({ deposit: 30000, dealType: "매매", options: [] }),
      "매매"
    );
    assert.equal(
      resolveTalkDealType(undefined, { deposit: 10000, monthlyRent: 50, options: [] }),
      "월세"
    );
    assert.equal(
      resolveTalkDealType({ dealType: "매매", options: [] }, { deposit: 10000, options: [] }),
      "매매"
    );
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

    // 톡: 만 없이 「3억6500」→ 36500만원. 뒤 잔여에 6500이 남지 않는다
    const bareMan = parseIntakeStep("3억6500", "money", "customer", prior);
    assert.equal(bareMan.ok, true);
    assert.equal(bareMan.partial.deposit, 36500);
    const bareManProp = parseIntakeStep("3억 6500", "money", "property", {
      roomType: "아파트",
      dealType: "매매",
      options: [],
    });
    assert.equal(bareManProp.ok, true);
    assert.equal(bareManProp.partial.deposit, 36500);
  });

  it("거래가액만 있으면 다음 칸으로 넘기지 않고, 다음 내용이 있으면 넘긴다", () => {
    const moneyIndex = INTAKE_GUIDE_STEPS.property.findIndex(
      (line) => line.key === "money"
    );
    const only = parseIntakeStepChain("보증금 2억9천2백10만", moneyIndex, "property", {
      roomType: { roomType: "원룸", options: [] },
      dealType: { dealType: "전세", options: [] },
    });
    assert.equal(only.commits[0]?.key, "money");
    assert.equal(only.commits[0]?.partial.deposit, 29210);
    assert.equal(only.nextIndex, moneyIndex);

    const withDates = parseIntakeStepChain(
      "보증금 2억 3월 1일",
      moneyIndex,
      "property",
      {
        roomType: { roomType: "원룸", options: [] },
        dealType: { dealType: "전세", options: [] },
      }
    );
    assert.ok(withDates.commits.some((row) => row.key === "money"));
    assert.ok(withDates.commits.some((row) => row.key === "dates"));
    assert.ok(withDates.nextIndex > moneyIndex);
  });

  it("월세는 보증금과 월세가 둘 다 있어야 거래가액 칸을 넘긴다", () => {
    const moneyIndex = INTAKE_GUIDE_STEPS.property.findIndex(
      (line) => line.key === "money"
    );
    const prior = {
      roomType: { roomType: "원룸" as const, options: [] as string[] },
      dealType: { dealType: "월세" as const, options: [] as string[] },
    };

    const depositOnly = parseIntakeStepChain(
      "보증금 1억",
      moneyIndex,
      "property",
      prior
    );
    assert.equal(depositOnly.commits[0]?.partial.deposit, 10000);
    assert.equal(depositOnly.commits[0]?.partial.monthlyRent, undefined);
    assert.equal(depositOnly.nextIndex, moneyIndex);

    const rentOnly = parseIntakeStepChain("월세 50", moneyIndex, "property", {
      ...prior,
      money: { deposit: 10000, options: [] },
    });
    assert.equal(rentOnly.commits[0]?.partial.deposit, 10000);
    assert.equal(rentOnly.commits[0]?.partial.monthlyRent, 50);
    assert.equal(rentOnly.nextIndex, moneyIndex);

    const both = parseIntakeStepChain(
      "보증금 1억 월세 50",
      moneyIndex,
      "property",
      prior
    );
    assert.equal(both.commits[0]?.partial.deposit, 10000);
    assert.equal(both.commits[0]?.partial.monthlyRent, 50);
    assert.equal(both.nextIndex, moneyIndex);

    const bothWithDates = parseIntakeStepChain(
      "보증금 1억 월세 50 3월 1일",
      moneyIndex,
      "property",
      prior
    );
    assert.ok(bothWithDates.commits.some((row) => row.key === "money"));
    assert.ok(bothWithDates.commits.some((row) => row.key === "dates"));
    assert.ok(bothWithDates.nextIndex > moneyIndex);
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
    assert.equal(chain.commits[0]?.key, "location");
    assert.equal(chain.commits[1]?.key, "roomType");
    assert.equal(chain.commits[2]?.key, "dealType");
    assert.equal(chain.commits[3]?.key, "money");
    assert.equal(chain.commits[3]?.partial.deposit, 20000);
    assert.equal(chain.nextIndex, 3);
    assert.match(chain.leftover, /매매가\s*2억/);
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

  it("firstIncompleteGuideIndex는 미완료 flags에 머문다", () => {
    const idx = firstIncompleteGuideIndex("property", {
      roomType: { display: "원룸", partial: { roomType: "원룸", options: [] } },
      dealType: { display: "매매", partial: { dealType: "매매", options: [] } },
      location: { display: "강동구", partial: { gu: "강동구", options: [] } },
      money: { display: "2억", partial: { deposit: 20000, options: [] } },
      dates: { display: "8/25~9/15", partial: { moveInFrom: "2026-08-25" } },
      flags: {
        display: "대출가",
        partial: { loan: "유", options: [] },
      },
    });
    assert.equal(INTAKE_GUIDE_STEPS.property[idx]?.key, "flags");
  });

  it("메모는 말이 있어도 입력완료 전에는 미완료다", () => {
    assert.equal(guideStepComplete("notes", { display: "" }), false);
    assert.equal(
      guideStepComplete("notes", { display: "남향", complete: true }),
      true
    );
    assert.equal(
      guideStepComplete("notes", { display: "", complete: true }),
      true
    );
  });

  it("allGuideStepsComplete는 빈 메모 complete도 인정한다", () => {
    const filled = {
      roomType: { display: "원룸" },
      dealType: { display: "매매" },
      location: { display: "성내동" },
      money: { display: "1억" },
      dates: { display: "8/25" },
      flags: {
        display: "대출가",
        partial: {
          loan: "유" as const,
          insurance: "무" as const,
          parking: "유" as const,
        },
      },
      elevator: {
        display: "엘베무",
        partial: { elevator: "무" as const },
      },
      tenantPhone: { display: "010-1234-5678" },
      landlordPhone: { display: "010-9876-5432" },
      notes: { display: "", complete: true },
    };
    assert.equal(allGuideStepsComplete("property", filled), true);
    assert.equal(
      allGuideStepsComplete("property", { ...filled, notes: { display: "" } }),
      false
    );
  });

  it("날짜는 시작일만 있으면 다음 칸으로 넘기지 않는다", () => {
    const datesIndex = INTAKE_GUIDE_STEPS.property.findIndex(
      (line) => line.key === "dates"
    );
    const open = parseIntakeStepChain("9월 15일부터", datesIndex, "property", {});
    assert.equal(open.commits[0]?.key, "dates");
    assert.equal(open.nextIndex, datesIndex);

    const fromWord = parseIntakeStepChain("9월 15일에서", datesIndex, "property", {});
    assert.equal(fromWord.nextIndex, datesIndex);

    const lone = parseIntakeStepChain("9월 15일", datesIndex, "property", {});
    assert.equal(lone.nextIndex, datesIndex);

    const range = parseIntakeStepChain(
      "9월 15일부터 10월 1일",
      datesIndex,
      "property",
      {}
    );
    assert.equal(range.nextIndex, datesIndex);
    assert.equal(range.commits[0]?.partial.moveInFrom, "2026-09-15");
    assert.equal(range.commits[0]?.partial.moveInTo, "2026-10-01");

    const eseoKkaji = parseIntakeStepChain(
      "9월 15일에서 10월 1일까지",
      datesIndex,
      "property",
      {}
    );
    assert.equal(eseoKkaji.nextIndex, datesIndex);
    assert.equal(eseoKkaji.commits[0]?.partial.moveInFrom, "2026-09-15");
    assert.equal(eseoKkaji.commits[0]?.partial.moveInTo, "2026-10-01");

    const bareRange = parseIntakeStepChain(
      "9월 15일 10월 1일",
      datesIndex,
      "property",
      {}
    );
    assert.equal(bareRange.nextIndex, datesIndex);
    assert.equal(bareRange.commits[0]?.partial.moveInFrom, "2026-09-15");
    assert.equal(bareRange.commits[0]?.partial.moveInTo, "2026-10-01");

    const spokenRange = parseIntakeStepChain(
      "구월 십오일 시월 일일",
      datesIndex,
      "property",
      {}
    );
    assert.equal(spokenRange.nextIndex, datesIndex);
    assert.equal(spokenRange.commits[0]?.partial.moveInFrom, "2026-09-15");
    assert.equal(spokenRange.commits[0]?.partial.moveInTo, "2026-10-01");

    const withFlags = parseIntakeStepChain(
      "9월 15일 대출 무",
      datesIndex,
      "property",
      {}
    );
    assert.ok(withFlags.commits.some((row) => row.key === "flags"));

    const secondDay = parseIntakeStepChain(
      "10월 1일",
      datesIndex,
      "property",
      { dates: lone.commits[0]!.partial }
    );
    assert.equal(secondDay.nextIndex, datesIndex);
    assert.equal(secondDay.commits[0]?.partial.moveInFrom, "2026-09-15");
    assert.equal(secondDay.commits[0]?.partial.moveInTo, "2026-10-01");

    assert.equal(
      INTAKE_GUIDE_STEPS.property.find((l) => l.key === "dates")?.example,
      "oo월 oo일    에서    oo월 oo일 까지"
    );
    assert.equal(
      datesStepNeedsHold(lone.commits[0]?.partial),
      true
    );
    assert.equal(
      datesStepNeedsHold(bareRange.commits[0]?.partial),
      true
    );
  });

  it("고객 선호위치는 동이 있어야 하고 다른 구를 더 고를 수 있으면 넘기지 않는다", () => {
    const locationIndex = INTAKE_GUIDE_STEPS.customer.findIndex(
      (line) => line.key === "location"
    );

    const guOnly = parseIntakeStep("강동구", "location", "customer");
    assert.equal(guOnly.ok, false);

    const oneDong = parseIntakeStepChain(
      "성내동",
      locationIndex,
      "customer",
      {}
    );
    assert.equal(oneDong.commits[0]?.key, "location");
    assert.equal(oneDong.nextIndex, locationIndex);
    assert.ok((oneDong.commits[0]?.partial.places?.length ?? 0) >= 1);

    const twoDongs = parseIntakeStepChain(
      "성내동 천호동",
      locationIndex,
      "customer",
      {}
    );
    assert.equal(twoDongs.nextIndex, locationIndex);
    assert.equal(twoDongs.commits[0]?.partial.places?.length, 2);

    const otherGu = parseIntakeStepChain(
      "강동구 성내동 그리고 송파구 풍납동",
      locationIndex,
      "customer",
      {}
    );
    assert.equal(otherGu.nextIndex, locationIndex);
    assert.equal(otherGu.commits[0]?.partial.places?.length, 2);

    const trailing = parseIntakeStepChain(
      "성내동 또는",
      locationIndex,
      "customer",
      {}
    );
    assert.equal(trailing.nextIndex, locationIndex);

    const withMoney = parseIntakeStepChain(
      "성내동 1억",
      locationIndex,
      "customer",
      {}
    );
    assert.ok(withMoney.commits.some((row) => row.key === "money"));

    const secondDong = parseIntakeStepChain(
      "송파구 풍납동",
      locationIndex,
      "customer",
      {
        location: oneDong.commits[0]!.partial,
      }
    );
    assert.equal(secondDong.nextIndex, locationIndex);
    assert.equal(secondDong.commits[0]?.partial.places?.length, 2);
  });

  it("매물 주소지는 지번을 이어서 받을 수 있게 다음 칸으로 바로 넘기지 않는다", () => {
    const locLine = INTAKE_GUIDE_STEPS.property.find((l) => l.key === "location");
    assert.equal(locLine?.name, "주소지");
    assert.equal(locLine?.example, "강동구 성내동 111-1 힐스테이트 101동 102호");

    const locationIndex = INTAKE_GUIDE_STEPS.property.findIndex(
      (line) => line.key === "location"
    );

    const dongOnly = parseIntakeStepChain(
      "강동구 성내동",
      locationIndex,
      "property",
      {}
    );
    assert.equal(dongOnly.commits[0]?.key, "location");
    assert.equal(dongOnly.nextIndex, locationIndex);
    assert.equal(
      locationStepReadyToAdvance(
        "강동구 성내동",
        dongOnly.commits[0]!.partial,
        "property"
      ),
      false
    );

    const withJibun = parseIntakeStepChain(
      "강동구 성내동 111-1",
      locationIndex,
      "property",
      {}
    );
    assert.equal(withJibun.nextIndex, locationIndex);
    assert.equal(withJibun.commits[0]?.partial.dong, "성내동");
    assert.equal(withJibun.commits[0]?.partial.jibun, "111-1");

    const addedJibun = parseIntakeStepChain(
      "111-1",
      locationIndex,
      "property",
      { location: dongOnly.commits[0]!.partial }
    );
    assert.equal(addedJibun.nextIndex, locationIndex);
    assert.equal(addedJibun.commits[0]?.partial.dong, "성내동");
    assert.equal(addedJibun.commits[0]?.partial.jibun, "111-1");

    const spokenE = parseIntakeStepChain(
      "111에1",
      locationIndex,
      "property",
      { location: dongOnly.commits[0]!.partial }
    );
    assert.equal(spokenE.commits[0]?.partial.jibun, "111-1");
    const spokenDasi = parseIntakeStepChain(
      "111다시 1",
      locationIndex,
      "property",
      { location: dongOnly.commits[0]!.partial }
    );
    assert.equal(spokenDasi.commits[0]?.partial.jibun, "111-1");

    const withMoney = parseIntakeStepChain(
      "강동구 성내동 111-1 원룸 매매 1억",
      locationIndex,
      "property",
      {}
    );
    assert.ok(withMoney.commits.some((row) => row.key === "location"));
    assert.ok(withMoney.commits.some((row) => row.key === "roomType"));
    assert.ok(withMoney.commits.some((row) => row.key === "money"));
  });

  it("매물 주소지는 건물명·동호수·호수만도 받는다", () => {
    const locationIndex = INTAKE_GUIDE_STEPS.property.findIndex(
      (line) => line.key === "location"
    );

    const full = parseIntakeStepChain(
      "강동구 성내동 111-1 힐스테이트 101동 102호",
      locationIndex,
      "property",
      {}
    );
    assert.equal(full.nextIndex, locationIndex);
    assert.equal(full.commits[0]?.partial.jibun, "111-1");
    assert.equal(full.commits[0]?.partial.buildingName, "힐스테이트");
    assert.equal(full.commits[0]?.partial.roomNo, "101동 102호");
    assert.match(full.commits[0]?.display ?? "", /힐스테이트/);
    assert.match(full.commits[0]?.display ?? "", /101동 102호/);

    const hoOnly = parseIntakeStep("302호", "location", "property");
    assert.equal(hoOnly.ok, true);
    assert.equal(hoOnly.partial.roomNo, "302호");

    const afterJibun = parseIntakeStepChain(
      "힐스테이트 101동 102호",
      locationIndex,
      "property",
      {
        location: {
          gu: "강동구",
          dong: "성내동",
          jibun: "111-1",
          options: [],
        },
      }
    );
    assert.equal(afterJibun.nextIndex, locationIndex);
    assert.equal(afterJibun.commits[0]?.partial.buildingName, "힐스테이트");
    assert.equal(afterJibun.commits[0]?.partial.roomNo, "101동 102호");
    assert.equal(afterJibun.commits[0]?.partial.jibun, "111-1");

    const hoAfterDong = parseIntakeStepChain(
      "302호",
      locationIndex,
      "property",
      { location: { gu: "강동구", dong: "성내동", options: [] } }
    );
    assert.equal(hoAfterDong.nextIndex, locationIndex);
    assert.equal(hoAfterDong.commits[0]?.partial.roomNo, "302호");
    assert.equal(hoAfterDong.commits[0]?.partial.dong, "성내동");
  });

  it("임차인·임대인 번호는 칸을 나눠 받는다", () => {
    const tenantIndex = INTAKE_GUIDE_STEPS.property.findIndex(
      (line) => line.key === "tenantPhone"
    );
    const landlordIndex = INTAKE_GUIDE_STEPS.property.findIndex(
      (line) => line.key === "landlordPhone"
    );
    const tenantOnly = parseIntakeStepChain(
      "임차인 010-1234-5678",
      tenantIndex,
      "property",
      {}
    );
    assert.equal(tenantOnly.commits[0]?.key, "tenantPhone");
    assert.equal(tenantOnly.nextIndex, landlordIndex);
    assert.equal(tenantOnly.commits[0]?.partial.tenantPhone, "010-1234-5678");

    const both = parseIntakeStepChain(
      "임차인 010-1234-5678 임대인 010-9876-5432",
      tenantIndex,
      "property",
      {}
    );
    assert.equal(both.commits.length, 2);
    assert.equal(both.commits[0]?.key, "tenantPhone");
    assert.equal(both.commits[1]?.key, "landlordPhone");
    assert.equal(both.commits[0]?.partial.tenantPhone, "010-1234-5678");
    assert.equal(both.commits[1]?.partial.landlordPhone, "010-9876-5432");
    assert.equal(both.nextIndex, landlordIndex + 1);

    const landlordOnly = parseIntakeStepChain(
      "임대인 010-9876-5432",
      landlordIndex,
      "property",
      { tenantPhone: { tenantPhone: "010-1234-5678", options: [] } }
    );
    assert.equal(landlordOnly.commits[0]?.key, "landlordPhone");
    assert.equal(landlordOnly.nextIndex, landlordIndex + 1);
    assert.equal(
      landlordOnly.commits[0]?.partial.landlordPhone,
      "010-9876-5432"
    );
  });
});
