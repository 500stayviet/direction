import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyCustomerDealType,
  applyCustomerRoomType,
  createCustomerFormDraft,
  customerFormHasContent,
  isCustomerLandOrBuilding,
} from "./customerFormDraft.ts";
import { applyIntakeToCustomer, parseIntakeText } from "./intakeParse.ts";
import { preprocessCustomerBlankForm } from "./blankIntakeForm.ts";

describe("customerFormDraft", () => {
  it("빈 draft는 신규 등록과 같다", () => {
    const draft = createCustomerFormDraft();
    assert.equal(draft.name, "");
    assert.equal(draft.phone, "");
    assert.equal(draft.dealType, "");
    assert.equal(draft.roomType, "");
    assert.equal(draft.loanNeeded, "");
    assert.equal(draft.parkingType, "");
    assert.equal(draft.depositSingle, true);
    assert.equal(draft.workspaceShared, false);
    assert.equal(customerFormHasContent(draft), false);
  });

  it("토지·건물은 매매·주차 무로 맞춘다", () => {
    const draft = applyCustomerRoomType(createCustomerFormDraft(), "토지");
    assert.equal(draft.roomType, "토지");
    assert.equal(draft.dealType, "매매");
    assert.equal(draft.parkingType, "무");
    assert.equal(draft.loanNeeded, "무");
    assert.equal(isCustomerLandOrBuilding(draft.roomType), true);
  });

  it("월세에서 매매로 바꾸면 월세를 비운다", () => {
    const withRent = applyCustomerDealType(
      { ...createCustomerFormDraft(), deposit: 1000, monthlyRent: 50 },
      "월세"
    );
    const asSale = applyCustomerDealType(withRent, "매매");
    assert.equal(asSale.dealType, "매매");
    assert.equal(asSale.deposit, 1000);
    assert.equal(asSale.monthlyRent, 0);
  });

  it("고객 양식 파싱을 한 번에 붙인다", () => {
    const filled = `고객등록 양식
고객명
: 김철수
고객 전화번호
: 010-9876-5432
거래종류
: 월세
매물 유형
: 원룸
거래가액
: 보증금 1000 / 월세 50
선호지역
: 강동구 성내동
대출
: 유
전세보증보험
: 무
주차
: 유
엘리베이터
: 유
추가 희망사항
: 저층`;
    const pre = preprocessCustomerBlankForm(filled);
    assert.ok(pre);
    const parsed = parseIntakeText(pre, "customer");
    const next = applyIntakeToCustomer(createCustomerFormDraft(), parsed, {
      hasTeam: true,
    });
    assert.equal(next.name, "김철수");
    assert.equal(next.phone, "010-9876-5432");
    assert.equal(next.roomType, "원룸");
    assert.equal(next.dealType, "월세");
    assert.equal(next.deposit, 1000);
    assert.equal(next.monthlyRent, 50);
    assert.equal(next.depositSingle, true);
    assert.equal(next.monthlyRentSingle, true);
    assert.equal(next.loanNeeded, "유");
    assert.equal(next.insuranceNeeded, "무");
    assert.equal(next.parkingType, "유");
    assert.equal(next.elevatorNeeded, "유");
    assert.equal(next.notes, "저층");
    assert.ok(next.preferredDongs.length > 0);
    assert.equal(customerFormHasContent(next), true);
  });

  it("월세만 있으면 거래종류를 월세로 두고 금액을 지우지 않는다", () => {
    const next = applyIntakeToCustomer(createCustomerFormDraft(), {
      monthlyRent: 50,
      options: [],
      notes: "",
    });
    assert.equal(next.dealType, "월세");
    assert.equal(next.monthlyRent, 50);
    assert.equal(next.deposit, 0);
  });

  it("메모는 기존 뒤에 붙인다", () => {
    const draft = { ...createCustomerFormDraft(), notes: "기존" };
    const next = applyIntakeToCustomer(draft, {
      notes: "추가",
      options: [],
    });
    assert.equal(next.notes, "기존\n추가");
  });

  it("팀 없으면 팀공유 파싱을 넣지 않는다", () => {
    const withTeam = applyIntakeToCustomer(
      createCustomerFormDraft(),
      { workspaceShared: "유", options: [], notes: "" },
      { hasTeam: true }
    );
    const noTeam = applyIntakeToCustomer(
      createCustomerFormDraft(),
      { workspaceShared: "유", options: [], notes: "" },
      { hasTeam: false }
    );
    assert.equal(withTeam.workspaceShared, true);
    assert.equal(noTeam.workspaceShared, false);
  });

  it("복구 초안은 입주일을 비우고, 매매 비입주는 그대로 둔다", () => {
    const dated = createCustomerFormDraft(
      {
        id: "c1",
        name: "홍",
        phone: "010-1111-2222",
        dealType: "월세",
        deposit: 1000,
        budget: "",
        moveInFrom: "2026-08-18",
        moveInTo: "2026-08-18",
        moveInSingle: true,
        moveInDate: "2026년 8월 18일",
        parkingType: "무",
        petAllowed: "무",
        createdAt: "",
        updatedAt: "",
      },
      { restore: true }
    );
    assert.equal(dated.moveInFrom, "");
    assert.equal(dated.moveInTo, "");
    assert.equal(dated.moveInSingle, false);

    const sale = createCustomerFormDraft(
      {
        id: "c2",
        name: "김",
        phone: "010-1111-2222",
        dealType: "매매",
        nonOccupancy: true,
        deposit: 50000,
        budget: "",
        moveInFrom: "",
        moveInTo: "",
        moveInDate: "비입주",
        parkingType: "무",
        petAllowed: "무",
        createdAt: "",
        updatedAt: "",
      },
      { restore: true }
    );
    assert.equal(sale.nonOccupancy, true);
    assert.equal(sale.moveInFrom, "");
  });
});
