import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildCustomerBlankFormText,
  buildPropertyBlankFormText,
  MESSAGE_INTAKE_MAX_LENGTH,
  preprocessCustomerBlankForm,
} from "./blankIntakeForm.ts";
import { buildAgentShareFooterLines } from "./shareAgentFooter.ts";
import { parseIntakeText } from "./intakeParse.ts";

describe("blankIntakeForm", () => {
  it("고객 양식은 예시를 넣고 : 를 다음 줄에 둔다", () => {
    const text = buildCustomerBlankFormText({
      shopName: "성내",
      name: "김중개",
      phone: "01012345678",
    });
    assert.match(text, /^고객등록 양식/);
    assert.match(text, /고객명 \(예: 홍길동\)\n:\n/);
    assert.doesNotMatch(text, /또는 명칭/);
    assert.match(text, /매물 유형 \(예: 아파트, 원룸, 투룸, 3룸\+\)\n:\n/);
    assert.doesNotMatch(text, /건물 종류/);
    assert.doesNotMatch(text, /거래종류/);
    assert.doesNotMatch(text, /오피스텔|건물, 토지/);
    assert.match(text, /선호지역 \(예: 강동구 성내동, 암사동 등\)\n:\n/);
    assert.match(text, /\n추가 희망사항 \(예: 희망층\)\n:\n/);
    assert.equal(MESSAGE_INTAKE_MAX_LENGTH, 600);
    assert.ok([...text].length < MESSAGE_INTAKE_MAX_LENGTH);
  });

  it("가입자 정보가 비면 라벨만 남긴다", () => {
    const lines = buildAgentShareFooterLines({
      shopName: "",
      name: "",
      phone: "",
    });
    assert.deepEqual(lines.slice(1), [
      "부동산",
      "담당",
      "전화번호",
      "-제공-",
      "앱 현장동선",
    ]);
    const text = buildPropertyBlankFormText(null);
    assert.match(text, /^매물등록 양식/);
    assert.match(text, /매물 주소 \(구·동\)\n:\n/);
    assert.match(text, /\n부동산\n담당\n전화번호\n-제공-\n앱 현장동선$/);
  });

  it("빈 양식은 예시·푸터를 버리고 빈 메시지로 만든다", () => {
    const blank = buildCustomerBlankFormText({
      shopName: "봄날",
      name: "하지영",
      phone: "01011111111",
    });
    const pre = preprocessCustomerBlankForm(blank);
    assert.equal(pre, "");
    const parsed = parseIntakeText(pre ?? "", "customer");
    assert.equal(parsed.phone, undefined);
    assert.equal(parsed.name, undefined);
    assert.equal(parsed.deposit, undefined);
  });

  it("채운 양식은 기존 파서가 읽는 메시지로 바뀐다", () => {
    const filled = `고객등록 양식

고객명 (예: 홍길동)
: 김철수

고객 전화번호 (예: 010-1234-5678)
: 010-9876-5432

매물 유형 (예: 아파트, 원룸, 투룸, 3룸+)
: 원룸

방 수 (예: 2개)
: 1개

화장실 수 (예: 1개)
: 1개

거래가액 (예: 보증금 1000 / 월세 50, 또는 매매 5억)
: 보증금 1000 / 월세 50

선호지역 (예: 강동구 성내동, 암사동 등)
: 강동구 성내동

입주희망일 (예: 3월 1일 ~ 4월 15일)
: 3월 1일 ~ 4월 15일

대출 (예: 유 / 무)
: 유

전세보증보험 (예: 유 / 무)
: 무

주차 (예: 유 / 무)
: 유

엘리베이터 (예: 유 / 무)
: 유

추가 희망사항 (예: 희망층)
: 저층

────────────
봄날 공인중개사사무소
담당 하지영
010-1111-1111
-제공-
앱 현장동선`;

    const pre = preprocessCustomerBlankForm(filled);
    assert.ok(pre);
    assert.doesNotMatch(pre!, /홍길동|010-1234-5678|010-1111-1111|예:/);
    assert.match(pre!, /김철수/);
    assert.match(pre!, /010-9876-5432/);
    assert.match(pre!, /메모:\s*저층/);

    const parsed = parseIntakeText(pre!, "customer");
    assert.equal(parsed.name, "김철수");
    assert.equal(parsed.phone, "010-9876-5432");
    assert.equal(parsed.roomType, "원룸");
    assert.equal(parsed.deposit, 1000);
    assert.equal(parsed.monthlyRent, 50);
    assert.equal(parsed.dealType, "월세");
    assert.equal(parsed.dong, "성내동");
    assert.equal(parsed.loan, "유");
    assert.equal(parsed.insurance, "무");
    assert.equal(parsed.parking, "유");
    assert.equal(parsed.elevator, "유");
    assert.match(parsed.notes, /저층/);
  });

  it("띄어쓰기가 줄어도 라벨을 읽는다", () => {
    const tight = `고객등록 양식
고객명
:박영희
고객전화번호
:01022223333
매물유형
:투룸
거래가액
:보증금2000
선호지역
:강동구성내동`;
    const pre = preprocessCustomerBlankForm(tight);
    assert.ok(pre);
    const parsed = parseIntakeText(pre!, "customer");
    assert.equal(parsed.name, "박영희");
    assert.equal(parsed.phone, "010-2222-3333");
    assert.equal(parsed.roomType, "투룸");
    assert.equal(parsed.deposit, 2000);
  });
});
