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
  talkDasiIsHyphen,
  moneyStepExample,
  dealTypeStepExample,
  inferDealTypeFromMoney,
  resolveTalkDealType,
  flagsGuideCopy,
  datesStepNeedsHold,
  locationStepNeedsHold,
  locationStepReadyToAdvance,
  restAddressStepReadyToAdvance,
  talkNormalizeModeForStep,
  talkGuideSteps,
} from "./intakeSteps.ts";
import { parseIntakeText } from "./intakeParse.ts";

describe("intakeSteps", () => {
  it("매물·고객 가이드 순서와 아파트 방·화·매도인 줄을 맞춘다", () => {
    assert.deepEqual(
      talkGuideSteps("property").map((l) => l.key).slice(0, 6),
      ["roomType", "dealType", "money", "location", "restAddress", "dates"]
    );
    const propKeys = talkGuideSteps("property").map((l) => l.key);
    assert.equal(propKeys.at(-3), "tenantPhone");
    assert.equal(propKeys.at(-2), "landlordPhone");
    assert.equal(propKeys.at(-1), "notes");
    assert.equal(
      talkGuideSteps("property", "원룸", "매매").some((l) => l.key === "tenantPhone"),
      false
    );
    assert.equal(
      talkGuideSteps("property", "원룸", "매매").find((l) => l.key === "landlordPhone")
        ?.name,
      "매도인 전화번호"
    );
    assert.equal(talkGuideSteps("property", "아파트")[1]?.key, "roomBath");
    assert.equal(talkGuideSteps("property", "원룸")[1]?.key, "dealType");
    const landKeys = talkGuideSteps("property", "토지").map((l) => l.key);
    assert.deepEqual(landKeys.slice(0, 5), [
      "roomType",
      "landCategory",
      "landArea",
      "money",
      "location",
    ]);
    assert.equal(landKeys.includes("dates"), false);
    assert.equal(landKeys.includes("elevator"), false);
    assert.equal(landKeys.includes("restAddress"), false);
    const bldg = talkGuideSteps("property", "건물").map((l) => l.key);
    assert.equal(bldg[1], "buildingKind");
    assert.equal(bldg.includes("elevator"), true);
    assert.equal(bldg.includes("dates"), false);
    const customerKeys = talkGuideSteps("customer").map((l) => l.key);
    assert.deepEqual(customerKeys.slice(0, 6), [
      "name",
      "phone",
      "roomType",
      "dealType",
      "money",
      "location",
    ]);
  });

  it("마이크 칸별 정규화 모드를 고른다", () => {
    assert.equal(talkNormalizeModeForStep("location"), "talk-location");
    assert.equal(talkNormalizeModeForStep("restAddress"), "talk-location");
    assert.equal(talkNormalizeModeForStep("money"), "talk-money");
    assert.equal(talkNormalizeModeForStep("dates"), "talk-dates");
    assert.equal(talkNormalizeModeForStep("phone"), "talk-phone");
    assert.equal(talkNormalizeModeForStep("roomType"), "talk-plain");
  });

  it("단계별로 매물유형만 넣고 뒤 유형은 메모로 보내지 않는다", () => {
    const step = parseIntakeStep("원룸 아파트", "roomType", "property");
    assert.equal(step.ok, true);
    assert.equal(step.partial.roomType, "원룸");
    assert.equal(step.partial.notes, undefined);

    const built = buildIntakeFromSteps({ roomType: step.partial }, "property");
    assert.equal(built.roomType, "원룸");
    assert.equal(built.notes, "");
  });

  it("유형·거래 칸은 주소·금액·날짜를 칸 값에 넣지 않는다", () => {
    const room = parseIntakeStep(
      "원룸 성내동 1억 8월 1일",
      "roomType",
      "property"
    );
    assert.equal(room.ok, true);
    assert.equal(room.partial.roomType, "원룸");
    assert.equal(room.partial.dong, undefined);
    assert.equal(room.partial.deposit, undefined);
    assert.equal(room.partial.moveInFrom, undefined);

    const deal = parseIntakeStep(
      "전세 성내동 2억 9월 1일",
      "dealType",
      "property"
    );
    assert.equal(deal.ok, true);
    assert.equal(deal.partial.dealType, "전세");
    assert.equal(deal.partial.dong, undefined);
    assert.equal(deal.partial.deposit, undefined);
    assert.equal(deal.partial.moveInFrom, undefined);

    const loc = parseIntakeStep("성내동 원룸 1억", "location", "property");
    assert.equal(loc.ok, true);
    assert.equal(loc.partial.dong, "성내동");
    assert.equal(loc.partial.roomType, undefined);
    assert.equal(loc.partial.deposit, undefined);
  });

  it("단계 취소 키워드를 분리한다", () => {
    assert.equal(splitIntakeStepCancel("삭제").cancel, true);
    assert.equal(splitIntakeStepCancel("아니 투룸").remainder, "투룸");
    assert.equal(splitIntakeStepCancel("다시").cancel, true);
    assert.equal(splitIntakeStepCancel("다시 일").cancel, true);
    assert.equal(splitIntakeStepCancel("다시 일").remainder, "일");
    assert.equal(talkDasiIsHyphen("property", "location"), true);
    assert.equal(talkDasiIsHyphen("property", "restAddress"), true);
    assert.equal(talkDasiIsHyphen("customer", "location"), false);
    const locDasi = { dasiIsHyphen: true };
    assert.equal(splitIntakeStepCancel("다시", locDasi).cancel, false);
    assert.equal(splitIntakeStepCancel("다시", locDasi).remainder, "다시");
    assert.equal(splitIntakeStepCancel("다시 일", locDasi).cancel, false);
    assert.equal(splitIntakeStepCancel("다시 일", locDasi).remainder, "다시 일");
    assert.equal(splitIntakeStepCancel("삭제", locDasi).cancel, true);
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
    assert.equal(flags.partial.insurance, undefined);
    assert.equal(flags.partial.parking, "유");
    assert.equal(flags.partial.elevator, undefined);

    const elevator = parseIntakeStep(full, "elevator", "customer");
    assert.equal(elevator.partial.elevator, "무");
  });

  it("주차안되요는 무, 주차필요는 유로 받는다", () => {
    assert.equal(
      parseIntakeStep("주차안되요", "flags", "property").partial.parking,
      "무"
    );
    assert.equal(
      parseIntakeStep("주차 안되요", "flags", "property").partial.parking,
      "무"
    );
    assert.equal(
      parseIntakeStep("주차필요", "flags", "property").partial.parking,
      "유"
    );
    assert.equal(
      parseIntakeStep("주차 필요", "flags", "property").partial.parking,
      "유"
    );
  });

  it("필·불 축약도 필요·불필요로 받는다", () => {
    assert.equal(parseIntakeStep("대출 필", "flags", "customer").partial.loan, "유");
    assert.equal(
      parseIntakeStep("주차 불", "flags", "customer").partial.parking,
      "무"
    );
    assert.equal(
      parseIntakeStep("엘베 필", "elevator", "customer").partial.elevator,
      "유"
    );
    assert.equal(
      parseIntakeText("대출 필 보증 불 주차 필", "customer").loan,
      "유"
    );
    assert.equal(
      parseIntakeText("대출 필 보증 불 주차 필", "customer").insurance,
      "무"
    );
    assert.equal(
      parseIntakeText("대출 필 보증 불 주차 필", "customer").parking,
      "유"
    );
  });

  it("필요·불필요는 대출·보증·주차·엘베 모두 받는다", () => {
    assert.equal(parseIntakeStep("대출필요", "flags", "property").partial.loan, "유");
    assert.equal(
      parseIntakeStep("대출불필요", "flags", "property").partial.loan,
      "무"
    );
    assert.equal(
      parseIntakeStep("보증 필요", "flags", "property").partial.insurance,
      "유"
    );
    assert.equal(
      parseIntakeStep("보증 불필요", "flags", "property").partial.insurance,
      "무"
    );
    assert.equal(
      parseIntakeStep("주차 필요", "flags", "property").partial.parking,
      "유"
    );
    assert.equal(
      parseIntakeStep("주차 불필요", "flags", "property").partial.parking,
      "무"
    );
    assert.equal(
      parseIntakeStep("엘베필요", "elevator", "property").partial.elevator,
      "유"
    );
    assert.equal(
      parseIntakeStep("엘베 불필요", "elevator", "property").partial.elevator,
      "무"
    );
  });

  it("불가·불가능은 띄어쓰기 없어도 무로 받는다", () => {
    assert.equal(
      parseIntakeStep("주차불가", "flags", "property").partial.parking,
      "무"
    );
    assert.equal(
      parseIntakeStep("주차불가능", "flags", "property").partial.parking,
      "무"
    );
    assert.equal(
      parseIntakeStep("보증불가", "flags", "property").partial.insurance,
      "무"
    );
    assert.equal(
      parseIntakeStep("보증보험 불가능", "flags", "property").partial.insurance,
      "무"
    );
    assert.equal(
      parseIntakeStep("대출불가", "flags", "property").partial.loan,
      "무"
    );
    assert.equal(
      parseIntakeStep("엘베불가능", "elevator", "property").partial.elevator,
      "무"
    );
  });

  it("엘베·엘리베이터 있음·없음도 받는다", () => {
    assert.equal(
      parseIntakeStep("엘베 있음", "elevator", "property").partial.elevator,
      "유"
    );
    assert.equal(
      parseIntakeStep("엘베없음", "elevator", "property").partial.elevator,
      "무"
    );
    assert.equal(
      parseIntakeStep("엘리베이터 있음", "elevator", "property").partial.elevator,
      "유"
    );
    assert.equal(
      parseIntakeStep("엘리베이터없음", "elevator", "property").partial.elevator,
      "무"
    );
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
    assert.equal(chain.commits[0]?.partial.insurance, undefined);
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
    assert.equal(
      INTAKE_GUIDE_STEPS.property.find((l) => l.key === "notes")?.example,
      "현관·호실 비밀번호, 남향 저층"
    );
    assert.equal(
      flagsGuideCopy("property", "전세").example,
      "대출가능 - 보증보험가능 - 주차불가"
    );
    assert.equal(flagsGuideCopy("property", "월세").name, "대출 · 주차");
    assert.equal(
      flagsGuideCopy("property", "매매").example,
      "대출가능 - 주차불가"
    );
    assert.equal(flagsStepComplete({ loan: "유", parking: "무" }, "월세"), true);
    assert.equal(flagsStepComplete({ loan: "유", parking: "무" }, "전세"), false);
    assert.equal(flagsGuideCopy("property", "전세", "상가").name, "주차");
    assert.equal(
      flagsGuideCopy("property", "전세", "사무실").example,
      "주차가능"
    );
    assert.equal(
      flagsGuideCopy("customer", "전세").example,
      "대출필요 - 보증보험필요 - 주차필요"
    );
    assert.equal(flagsStepComplete({ parking: "유" }, "전세", "상가"), true);
    assert.equal(
      parseIntakeStep("대출 유 보증 유 주차 가능", "flags", "property", {
        roomType: "상가",
        dealType: "전세",
        options: [],
      }).partial.loan,
      undefined
    );
    assert.equal(
      parseIntakeStep("대출 유 보증 유 주차 가능", "flags", "property", {
        roomType: "상가",
        dealType: "전세",
        options: [],
      }).partial.parking,
      "유"
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
      "보증금 2억 강동구 성내동",
      moneyIndex,
      "property",
      {
        roomType: { roomType: "원룸", options: [] },
        dealType: { dealType: "전세", options: [] },
      }
    );
    assert.ok(withDates.commits.some((row) => row.key === "money"));
    assert.ok(withDates.commits.some((row) => row.key === "location"));
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
      "보증금 1억 월세 50 강동구 성내동",
      moneyIndex,
      "property",
      prior
    );
    assert.ok(bothWithDates.commits.some((row) => row.key === "money"));
    assert.ok(bothWithDates.commits.some((row) => row.key === "location"));
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

  it("유형·거래·금액 다음 주소까지 연속 반영한다", () => {
    const full = "원룸 전세 보증금 2억 강동구 천호동";
    const chain = parseIntakeStepChain(full, 0, "property", {});
    assert.equal(chain.commits[0]?.key, "roomType");
    assert.equal(chain.commits[1]?.key, "dealType");
    assert.equal(chain.commits[2]?.key, "money");
    assert.equal(chain.commits[3]?.key, "location");
    assert.equal(chain.commits[2]?.partial.deposit, 20000);
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

  it("월세 금액 다음 주소까지 연속 반영한다", () => {
    const full = "원룸 월세 보증금 5억 월세 50 강동구 천호동";
    const chain = parseIntakeStepChain(full, 0, "property", {});
    assert.ok(chain.commits.some((row) => row.key === "money"));
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
    assert.equal(
      talkGuideSteps("property", "원룸", "매매")[idx]?.key,
      "flags"
    );
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
      roomType: { display: "원룸", partial: { roomType: "원룸" as const, options: [] } },
      dealType: { display: "매매", partial: { dealType: "매매" as const, options: [] } },
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

    const withNext = parseIntakeStepChain(
      "성내동 대출 유",
      locationIndex,
      "customer",
      {}
    );
    assert.ok(withNext.commits.some((row) => row.key === "location"));

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

    const threeDongs = parseIntakeStepChain(
      "강동구 성내동 송파구 풍납동 강남구 역삼동",
      locationIndex,
      "customer",
      {}
    );
    assert.equal(threeDongs.commits[0]?.partial.places?.length, 3);
    assert.equal(threeDongs.nextIndex, locationIndex);
  });

  it("매물 주소지는 지번을 이어서 받을 수 있게 다음 칸으로 바로 넘기지 않는다", () => {
    const locLine = INTAKE_GUIDE_STEPS.property.find((l) => l.key === "location");
    assert.equal(locLine?.name, "주소지");
    assert.equal(locLine?.example, "강동구 성내동 111-1");

    const restLine = INTAKE_GUIDE_STEPS.property.find(
      (l) => l.key === "restAddress"
    );
    assert.equal(restLine?.name, "나머지 주소");
    assert.equal(restLine?.example, "힐스테이트 ooo동 ooo호");

    const flagsLine = INTAKE_GUIDE_STEPS.property.find((l) => l.key === "flags");
    assert.equal(flagsLine?.nameHint, "(가능/불가)");
    assert.equal(flagsLine?.example, "대출가능 - 보증보험가능 - 주차불가");

    const elevLine = INTAKE_GUIDE_STEPS.property.find((l) => l.key === "elevator");
    assert.equal(elevLine?.nameHint, "(유/무)");
    assert.equal(elevLine?.example, "엘베 유");

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
    assert.equal(withJibun.nextIndex, locationIndex + 1);
    assert.equal(withJibun.commits[0]?.partial.dong, "성내동");
    assert.equal(withJibun.commits[0]?.partial.jibun, "111-1");
    assert.equal(
      locationStepReadyToAdvance(
        "강동구 성내동 111-1",
        withJibun.commits[0]!.partial,
        "property"
      ),
      true
    );

    const addedJibun = parseIntakeStepChain(
      "111-1",
      locationIndex,
      "property",
      { location: dongOnly.commits[0]!.partial }
    );
    assert.equal(addedJibun.nextIndex, locationIndex + 1);
    assert.equal(addedJibun.commits[0]?.partial.dong, "성내동");
    assert.equal(addedJibun.commits[0]?.partial.jibun, "111-1");

    const priorDong = dongOnly.commits[0]!.partial;
    const fullAfterDong = parseIntakeStep(
      "강동구 성내동 111-1",
      "location",
      "property",
      priorDong
    );
    assert.equal(fullAfterDong.ok, true);
    assert.equal(fullAfterDong.partial.jibun, "111-1");

    const fullChainAfterDong = parseIntakeStepChain(
      "강동구 성내동 111-1",
      locationIndex,
      "property",
      { location: priorDong }
    );
    assert.equal(fullChainAfterDong.commits[0]?.partial.jibun, "111-1");
    assert.equal(fullChainAfterDong.nextIndex, locationIndex + 1);

    const spacedAfterDong = parseIntakeStepChain(
      "강동구 성내동 111 1",
      locationIndex,
      "property",
      { location: priorDong }
    );
    assert.equal(spacedAfterDong.commits[0]?.partial.jibun, "111-1");

    const dongOnlyAfterJibun = parseIntakeStep(
      "강동구 성내동",
      "location",
      "property",
      {
        gu: "강동구",
        dong: "성내동",
        jibun: "111-1",
        options: [],
      }
    );
    assert.equal(dongOnlyAfterJibun.partial.jibun, "111-1");

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
    const hangulDasi = parseIntakeStepChain(
      "일일일다시일",
      locationIndex,
      "property",
      { location: dongOnly.commits[0]!.partial }
    );
    assert.equal(hangulDasi.commits[0]?.partial.jibun, "111-1");
    assert.equal(hangulDasi.nextIndex, locationIndex + 1);
    const dasiOnlySub = parseIntakeStepChain(
      "111 다시 일",
      locationIndex,
      "property",
      { location: dongOnly.commits[0]!.partial }
    );
    assert.equal(dasiOnlySub.commits[0]?.partial.jibun, "111-1");
    const dasiNotCancel = parseIntakeStepChain(
      "다시",
      locationIndex,
      "property",
      { location: dongOnly.commits[0]!.partial }
    );
    assert.equal(dasiNotCancel.commits[0]?.partial.dong, "성내동");
    assert.equal(dasiNotCancel.commits[0]?.partial.jibun, undefined);

    const spokenSino = parseIntakeStepChain(
      "백오십일 다시 오",
      locationIndex,
      "property",
      { location: dongOnly.commits[0]!.partial }
    );
    assert.equal(spokenSino.commits[0]?.partial.jibun, "151-5");
    const spokenSpacedDigits = parseIntakeStepChain(
      "일 오 일 다시 오",
      locationIndex,
      "property",
      { location: dongOnly.commits[0]!.partial }
    );
    assert.equal(spokenSpacedDigits.commits[0]?.partial.jibun, "151-5");
    const arabicSpaced = parseIntakeStepChain(
      "111 5",
      locationIndex,
      "property",
      { location: dongOnly.commits[0]!.partial }
    );
    assert.equal(arabicSpaced.commits[0]?.partial.jibun, "111-5");

    const sinoMain = parseIntakeStepChain(
      "백오십일",
      locationIndex,
      "property",
      { location: dongOnly.commits[0]!.partial }
    );
    assert.equal(sinoMain.commits[0]?.partial.dong, "성내동");
    assert.equal(sinoMain.commits[0]?.partial.jibun, "151");

    const guDongSino = parseIntakeStepChain(
      "강동구 성내동 백오십일",
      locationIndex,
      "property",
      {}
    );
    assert.equal(guDongSino.commits[0]?.partial.jibun, "151");

    const spacedSinoMain = parseIntakeStepChain(
      "백 오십 일",
      locationIndex,
      "property",
      { location: dongOnly.commits[0]!.partial }
    );
    assert.equal(spacedSinoMain.commits[0]?.partial.jibun, "151");

    const digitsOnly = parseIntakeStepChain(
      "151",
      locationIndex,
      "property",
      { location: dongOnly.commits[0]!.partial }
    );
    assert.equal(digitsOnly.commits[0]?.partial.jibun, "151");
    assert.equal(digitsOnly.nextIndex, locationIndex);

    const nativeFollow = parseIntakeStepChain(
      "하나하나하나",
      locationIndex,
      "property",
      { location: dongOnly.commits[0]!.partial }
    );
    assert.equal(nativeFollow.commits[0]?.partial.jibun, "111");

    const restIndexForJibun = INTAKE_GUIDE_STEPS.property.findIndex(
      (line) => line.key === "restAddress"
    );
    const lateJibunKept = parseIntakeStepChain(
      "151",
      restIndexForJibun,
      "property",
      { location: dongOnly.commits[0]!.partial }
    );
    assert.equal(lateJibunKept.commits[0]?.key, "location");
    assert.equal(lateJibunKept.commits[0]?.partial.jibun, "151");
    assert.equal(lateJibunKept.nextIndex, restIndexForJibun);

    const lateHangulMonth = parseIntakeStepChain(
      "일월 십일",
      restIndexForJibun,
      "property",
      { location: dongOnly.commits[0]!.partial }
    );
    assert.equal(lateHangulMonth.commits[0]?.key, "location");
    assert.equal(lateHangulMonth.commits[0]?.partial.jibun, "111");

    const lateSttMonth = parseIntakeStepChain(
      "1월 11일",
      restIndexForJibun,
      "property",
      { location: dongOnly.commits[0]!.partial }
    );
    assert.equal(lateSttMonth.commits[0]?.key, "location");
    assert.equal(lateSttMonth.commits[0]?.partial.jibun, "111");

    const locationHangulMonth = parseIntakeStepChain(
      "일월 십일",
      locationIndex,
      "property",
      { location: dongOnly.commits[0]!.partial }
    );
    assert.equal(locationHangulMonth.commits[0]?.partial.jibun, "111");

    assert.equal(
      locationStepNeedsHold(dongOnly.commits[0]!.partial, "property"),
      true
    );
    assert.equal(
      locationStepNeedsHold(digitsOnly.commits[0]!.partial, "property"),
      true
    );
    assert.equal(
      locationStepNeedsHold(withJibun.commits[0]!.partial, "property"),
      false
    );

    const lateJibun = parseIntakeStepChain(
      "151다시5",
      restIndexForJibun,
      "property",
      { location: dongOnly.commits[0]!.partial }
    );
    assert.equal(lateJibun.commits[0]?.key, "location");
    assert.equal(lateJibun.commits[0]?.partial.jibun, "151-5");
    assert.equal(lateJibun.nextIndex, restIndexForJibun);

    const withMoney = parseIntakeStepChain(
      "강동구 성내동 111-1",
      locationIndex,
      "property",
      {}
    );
    assert.ok(withMoney.commits.some((row) => row.key === "location"));
    assert.equal(
      withMoney.commits.some((row) => row.key === "roomType"),
      false
    );
  });

  it("매물 주소지와 나머지주소는 칸을 나눠 받는다", () => {
    const locationIndex = INTAKE_GUIDE_STEPS.property.findIndex(
      (line) => line.key === "location"
    );
    const restIndex = INTAKE_GUIDE_STEPS.property.findIndex(
      (line) => line.key === "restAddress"
    );

    const full = parseIntakeStepChain(
      "강동구 성내동 111-1 힐스테이트 101동 102호",
      locationIndex,
      "property",
      {}
    );
    assert.equal(full.nextIndex, restIndex + 1);
    assert.equal(full.commits[0]?.partial.jibun, "111-1");
    assert.equal(full.commits[0]?.partial.buildingName, undefined);
    assert.equal(full.commits[0]?.partial.roomNo, undefined);
    assert.equal(full.commits[1]?.key, "restAddress");
    assert.equal(full.commits[1]?.partial.buildingName, "힐스테이트");
    assert.equal(full.commits[1]?.partial.roomNo, "101동 102호");

    const hoOnly = parseIntakeStep("302호", "restAddress", "property");
    assert.equal(hoOnly.ok, true);
    assert.equal(hoOnly.partial.roomNo, "302호");

    const spokenHo = parseIntakeStep("백일호", "restAddress", "property");
    assert.equal(spokenHo.ok, true);
    assert.equal(spokenHo.partial.roomNo, "101호");

    const nameOnly = parseIntakeStep("힐스테이트", "restAddress", "property");
    assert.equal(nameOnly.ok, true);
    assert.equal(nameOnly.partial.buildingName, "힐스테이트");
    assert.equal(nameOnly.partial.roomNo, undefined);
    assert.equal(
      restAddressStepReadyToAdvance("힐스테이트", nameOnly.partial),
      false
    );

    const spokenFiller = parseIntakeStep(
      "힐스테이트이러고 105동101호",
      "restAddress",
      "property"
    );
    assert.equal(spokenFiller.ok, true);
    assert.equal(spokenFiller.partial.buildingName, "힐스테이트");
    assert.equal(spokenFiller.partial.roomNo, "105동 101호");
    assert.equal(
      restAddressStepReadyToAdvance(
        "힐스테이트이러고 105동101호",
        spokenFiller.partial
      ),
      true
    );

    const gluedDongHo = parseIntakeStep(
      "힐스테이트 105동101호",
      "restAddress",
      "property"
    );
    assert.equal(gluedDongHo.partial.buildingName, "힐스테이트");
    assert.equal(gluedDongHo.partial.roomNo, "105동 101호");

    const nameOnlyChain = parseIntakeStepChain(
      "힐스테이트",
      restIndex,
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
    assert.equal(nameOnlyChain.nextIndex, restIndex);
    assert.equal(nameOnlyChain.commits[0]?.partial.buildingName, "힐스테이트");
    assert.equal(nameOnlyChain.commits[0]?.partial.roomNo, undefined);

    const twoWord = parseIntakeStep(
      "힐스테이트 리버파크 101동 102호",
      "restAddress",
      "property"
    );
    assert.equal(twoWord.ok, true);
    assert.equal(twoWord.partial.buildingName, "힐스테이트 리버파크");
    assert.equal(twoWord.partial.roomNo, "101동 102호");

    const afterJibun = parseIntakeStepChain(
      "힐스테이트 101동 102호",
      restIndex,
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
    assert.equal(afterJibun.nextIndex, restIndex + 1);
    assert.equal(afterJibun.commits[0]?.partial.buildingName, "힐스테이트");
    assert.equal(afterJibun.commits[0]?.partial.roomNo, "101동 102호");

    const hoAfterDong = parseIntakeStepChain(
      "302호",
      restIndex,
      "property",
      {
        location: { gu: "강동구", dong: "성내동", options: [] },
      }
    );
    assert.equal(hoAfterDong.nextIndex, restIndex + 1);
    assert.equal(hoAfterDong.commits[0]?.partial.roomNo, "302호");
  });

  it("아파트는 유형 다음 칸에서 방·화를 받는다", () => {
    const room = parseIntakeStep("아파트", "roomType", "property");
    assert.equal(room.partial.roomType, "아파트");
    assert.equal(room.partial.roomCount, undefined);
    const chain = parseIntakeStepChain("아파트 방 3 화 2", 0, "property", {});
    assert.equal(chain.commits[0]?.key, "roomType");
    assert.equal(chain.commits[1]?.key, "roomBath");
    const compact = parseIntakeStep("방3개 화1개", "roomBath", "property");
    assert.equal(compact.partial.roomCount, 3);
    assert.equal(compact.partial.bathroomCount, 1);
    const toilet = parseIntakeStep("방3 화장실1", "roomBath", "property");
    assert.equal(toilet.partial.roomCount, 3);
    assert.equal(toilet.partial.bathroomCount, 1);
    assert.equal(
      talkGuideSteps("property").find((l) => l.key === "roomType")?.example,
      "아파트 · 오피스텔 등"
    );
  });

  it("토지·건물은 지목·건물종류를 받고 매매로 둔다", () => {
    const land = parseIntakeStepChain("토지 대 80평", 0, "property", {});
    assert.equal(land.commits[0]?.partial.roomType, "토지");
    assert.equal(land.commits[0]?.partial.dealType, "매매");
    assert.equal(land.commits[1]?.key, "landCategory");
    assert.equal(land.commits[1]?.partial.landCategory, "대");
    assert.equal(land.commits[2]?.key, "landArea");
    assert.equal(land.commits[2]?.partial.landArea, 80);
    const bldg = parseIntakeStep("근생", "buildingKind", "property");
    assert.equal(bldg.partial.buildingKind, "근생건물");
  });

  it("매도인 번호는 임대인 칸에 넣는다", () => {
    const step = parseIntakeStep(
      "매도인 010-9876-5432",
      "landlordPhone",
      "property"
    );
    assert.equal(step.ok, true);
    assert.equal(step.partial.landlordPhone, "010-9876-5432");
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

  it("대화 전화 칸은 휴대폰 11자리가 아니면 확정하지 않는다", () => {
    const incomplete = parseIntakeStep("010100101", "phone", "customer");
    assert.equal(incomplete.ok, false);

    const partial = parseIntakeStep("010-1234", "phone", "customer");
    assert.equal(partial.ok, false);

    const complete = parseIntakeStep("01011111259", "phone", "customer");
    assert.equal(complete.ok, true);
    assert.equal(complete.partial.phone, "010-1111-1259");

    const tenantIndex = INTAKE_GUIDE_STEPS.property.findIndex(
      (line) => line.key === "tenantPhone"
    );
    const shortTenant = parseIntakeStepChain(
      "임차인 010-100-101",
      tenantIndex,
      "property",
      {}
    );
    assert.equal(shortTenant.commits.length, 0);
  });

  it("잘못 합쳐진 전화 조각 뒤에 올바른 11자리가 오면 뒤 번호를 쓴다", () => {
    const merged = parseIntakeStep(
      "010 0101 1010 01011111285",
      "phone",
      "customer"
    );
    assert.equal(merged.ok, true);
    assert.equal(merged.partial.phone, "010-1111-1285");
  });
});
