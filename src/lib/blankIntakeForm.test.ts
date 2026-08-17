import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildCustomerBlankFormText,
  buildPropertyBlankFormText,
  MESSAGE_INTAKE_MAX_LENGTH,
  preprocessCustomerBlankForm,
} from "./blankIntakeForm.ts";
import { buildAgentShareFooterLines } from "./shareAgentFooter.ts";
import { parseIntakeText, intakePreferredLocation } from "./intakeParse.ts";
import { intakeAiLeftover, leftoverNeedsAi } from "./intakeAi.ts";

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
    assert.match(
      text,
      /고객 전화번호[\s\S]*거래종류 \(예: 매매, 전세, 월세\)\n:\n[\s\S]*매물 유형 \(예: 아파트, 원룸, 투룸, 3룸\+\)\n:\n[\s\S]*방 수[\s\S]*화장실 수[\s\S]*거래가액/
    );
    assert.doesNotMatch(text, /건물 종류/);
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

거래종류 (예: 매매, 전세, 월세)
: 월세

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
    assert.match(pre!, /^월세$/m);
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
    assert.equal(parsed.notes, "저층");
    assert.equal(parsed.roomCount, 1);
    assert.equal(parsed.bathroomCount, 1);
  });

  it("거래가액 칸의 월세 2000/65는 보증 2000 / 월 65다", () => {
    const filled = `고객등록 양식
고객명
: 임지나
거래종류
: 월세
매물 유형
: 원룸
거래가액
: 월세 2000/65
선호지역
: 강동구 천호동
────────────
-제공-
앱 현장동선`;
    const pre = preprocessCustomerBlankForm(filled);
    assert.ok(pre);
    assert.match(pre!, /^2000\/65$/m);
    const parsed = parseIntakeText(pre!, "customer");
    assert.equal(parsed.dealType, "월세");
    assert.equal(parsed.deposit, 2000);
    assert.equal(parsed.monthlyRent, 65);
  });

  it("원룸 양식의 방·화 2~3은 버리고 메모 잔여를 남기지 않는다", () => {
    const filled = `고객등록 양식
고객명
: 김영수
거래종류
: 월세
매물 유형
: 원룸
방 수
: 3개
화장실 수
: 2개
거래가액
: 보증금 1000 / 월세 50
선호지역
: 성내동
입주희망일
: 3월 1일 ~ 4월 15일
대출
: 유
전세보증보험
: 무
주차
: 유
엘리베이터
: 유
추가 희망사항
: 저층 남향
────────────
-제공-
앱 현장동선`;
    const pre = preprocessCustomerBlankForm(filled);
    assert.ok(pre);
    assert.doesNotMatch(pre!, /방\s*3|화장실\s*2/);
    const parsed = parseIntakeText(pre!, "customer");
    assert.equal(parsed.roomType, "원룸");
    assert.equal(parsed.roomCount, 1);
    assert.equal(parsed.bathroomCount, 1);
    assert.equal(parsed.notes, "저층 남향");
  });

  it("추가 희망사항의 다음 줄도 메모에 붙인다", () => {
    const filled = `고객등록 양식
고객명
: 김영희
거래종류
: 월세
매물 유형
: 원룸
거래가액
: 보증금 1000 / 월세 50
선호지역
: 성내동
추가 희망사항 (예: 희망층)
: 저층 남향
저녁시간 방문불가 아기있음
────────────
-제공-
앱 현장동선`;
    const pre = preprocessCustomerBlankForm(filled);
    assert.ok(pre);
    assert.match(pre!, /메모:\s*저층 남향 저녁시간 방문불가 아기있음/);
    const parsed = parseIntakeText(pre!, "customer");
    assert.match(parsed.notes, /저층 남향/);
    assert.match(parsed.notes, /저녁시간 방문불가/);
    assert.match(parsed.notes, /아기있음/);
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

  it("전세 아파트 양식은 전세 2억을 보증금에 넣고 칸 잔여를 메모에 남기지 않는다", () => {
    const filled = `고객등록 양식

고객명 (예: 홍길동)
: 박철수

고객 전화번호 (예: 010-1234-5678)
: 010-3333-4444

거래종류 (예: 매매, 전세, 월세)
: 전세

매물 유형 (예: 아파트, 원룸, 투룸, 3룸+)
: 아파트

방 수 (예: 2개)
: 3개

화장실 수 (예: 1개)
: 2개

거래가액 (예: 보증금 1000 / 월세 50, 또는 매매 5억)
: 전세 2억

선호지역 (예: 강동구 성내동, 암사동 등)
: 강동구 암사동

입주희망일 (예: 3월 1일 ~ 4월 15일)
: 5월 1일 ~ 6월 15일

대출 (예: 유 / 무)
: 유

전세보증보험 (예: 유 / 무)
: 유

주차 (예: 유 / 무)
: 유

엘리베이터 (예: 유 / 무)
: 유

추가 희망사항 (예: 희망층)
: 남향 고층 고층은 엘베있어야하고 저층은 없어도됨

────────────
봄날 공인중개사사무소
담당 하지영
010-1111-1111
-제공-
앱 현장동선`;

    const pre = preprocessCustomerBlankForm(filled);
    assert.ok(pre);
    assert.match(pre!, /전세가\s*2억/);
    const parsed = parseIntakeText(pre!, "customer");
    assert.equal(parsed.name, "박철수");
    assert.equal(parsed.phone, "010-3333-4444");
    assert.equal(parsed.dealType, "전세");
    assert.equal(parsed.roomType, "아파트");
    assert.equal(parsed.roomCount, 3);
    assert.equal(parsed.bathroomCount, 2);
    assert.equal(parsed.deposit, 20000);
    assert.equal(parsed.dong, "암사동");
    assert.equal(parsed.loan, "유");
    assert.equal(parsed.insurance, "유");
    assert.equal(parsed.parking, "유");
    assert.equal(parsed.elevator, "유");
    assert.ok(parsed.moveInFrom);
    assert.ok(parsed.moveInTo);
    assert.match(parsed.notes, /남향 고층 고층은 엘베있어야하고 저층은 없어도됨/);
    assert.doesNotMatch(parsed.notes, /화장실/);
    assert.doesNotMatch(parsed.notes, /2억/);
    assert.doesNotMatch(parsed.notes, /암사동/);
    assert.doesNotMatch(parsed.notes, /대출 유|전세보증보험|주차 유|엘리베이터 유/);
  });

  it("사진처럼 줄이 붙은 양식은 원문을 비우지 않는다", () => {
    const ocr =
      "고객등록 양식 박철수 010-3333-4444 전세 아파트 방 3개 화장실 2개 전세 2억 강동구 암사동 5월 1일 ~ 6월 15일 대출 유 전세보증보험 유 주차 유 엘리베이터 유 남향 고층";
    const pre = preprocessCustomerBlankForm(ocr);
    assert.equal(pre, null);
    const parsed = parseIntakeText(ocr, "customer");
    assert.equal(parsed.dealType, "전세");
    assert.equal(parsed.deposit, 20000);
    assert.equal(parsed.dong, "암사동");
    assert.doesNotMatch(parsed.notes, /대출 유|암사동/);
  });

  it("카톡처럼 같은 줄·객등록·푸터가 붙어도 칸에 넣는다", () => {
    const kakao = `객등록 양식

고객명 (예: 홍길동) : 박철수

고객 전화번호 (예: 010-1234-5678) : 010-3333-4444

거래종류 (예: 매매, 전세, 월세) : 전세

매물 유형 (예: 아파트, 원룸, 투룸, 3룸+) : 아파트

방 수 (예: 2개) : 3개

화장실 수 (예: 1개) : 2개

거래가액 (예: 보증금 1000 / 월세 50, 또는 매매 5억) : 전세 2억

선호지역 (예: 강동구 성내동, 암사동 등) : 강동구 암사동

입주희망일 (예: 3월 1일 ~ 4월 15일) : 5월 1일 ~ 6월 15일

대출 (예: 유 / 무) : 유

전세보증보험 (예: 유 / 무) : 유

주차 (예: 유 / 무) : 유

엘리베이터 (예: 유 / 무) : 유

추가 희망사항 (예: 희망층) : 남향 고층 고층은 엘베있어야하고 저층은 없어도됨

──────────── 봄날 공인중개사사무소 담당 하지영 010-1111-1111 -제공- 앱 현장동선`;

    const pre = preprocessCustomerBlankForm(kakao);
    assert.ok(pre);
    assert.doesNotMatch(pre!, /홍길동|원룸|투룸|3룸\+|010-1111-1111|예:/);
    const parsed = parseIntakeText(pre!, "customer");
    assert.equal(parsed.name, "박철수");
    assert.equal(parsed.phone, "010-3333-4444");
    assert.equal(parsed.dealType, "전세");
    assert.equal(parsed.roomType, "아파트");
    assert.equal(parsed.roomCount, 3);
    assert.equal(parsed.bathroomCount, 2);
    assert.equal(parsed.deposit, 20000);
    assert.equal(parsed.dong, "암사동");
    assert.equal(parsed.loan, "유");
    assert.equal(parsed.insurance, "유");
    assert.equal(parsed.parking, "유");
    assert.equal(parsed.elevator, "유");
    assert.ok(parsed.moveInFrom);
    assert.match(parsed.notes, /남향 고층 고층은 엘베있어야하고 저층은 없어도됨/);
    assert.doesNotMatch(parsed.notes, /화장실|희망층|원룸|투룸|3룸\+/);
    assert.doesNotMatch(parsed.notes, /010-3333-4444|010-1111-1111/);
    assert.doesNotMatch(parsed.notes, /은 있어야하고|전세/);
  });

  it("선호지역 천호동은 구천으로 바뀌지 않고 희망사항만 메모에 남긴다", () => {
    const filled = `고객등록 양식

고객명 (예: 홍길동)
: 임지나

고객 전화번호 (예: 010-1234-5678)
: 01055555555

거래종류 (예: 매매, 전세, 월세)
: 월세

매물 유형 (예: 아파트, 원룸, 투룸, 3룸+)
: 원룸

방 수 (예: 2개)
: 1

화장실 수 (예: 1개)
:1

거래가액 (예: 보증금 1000 / 월세 50, 또는 매매 5억)
: 2000/65

선호지역 (예: 강동구 성내동, 암사동 등)
: 강동구 천호동 고덕동

입주희망일 (예: 3월 1일 ~ 4월 15일)
:8월21일 ~ 10월 22일

대출 (예: 유 / 무)
: 무

전세보증보험 (예: 유 / 무)
: 유

주차 (예: 유 / 무)
:유

엘리베이터 (예: 유 / 무)
:유 

추가 희망사항 (예: 희망층)
: 엘베는 없어도되는데 있으면 좋아요 보증보험은 허그 가입합니다.

────────────
봄날 공인중개사사무소
담당 하지영
010-1111-1111
-제공-
앱 현장동선`;

    const pre = preprocessCustomerBlankForm(filled);
    assert.ok(pre);
    assert.match(pre!, /강동구 천호동 고덕동/);
    const parsed = parseIntakeText(pre!, "customer");
    assert.equal(parsed.name, "임지나");
    assert.equal(parsed.phone, "010-5555-5555");
    assert.equal(parsed.dealType, "월세");
    assert.equal(parsed.roomType, "원룸");
    assert.equal(parsed.deposit, 2000);
    assert.equal(parsed.monthlyRent, 65);
    const loc = intakePreferredLocation(parsed);
    assert.deepEqual(loc.preferredGus, ["강동구"]);
    assert.deepEqual(loc.preferredDongs.sort(), [
      "강동구|고덕동",
      "강동구|천호동",
    ].sort());
    assert.match(parsed.notes, /엘베는 없어도되는데 있으면 좋아요/);
    assert.match(parsed.notes, /허그/);
    assert.doesNotMatch(parsed.notes, /강동9/);
    const leftover = intakeAiLeftover(pre!, parsed, "message");
    assert.doesNotMatch(leftover, /강동9|천호동|고덕동|강동구/);
    assert.equal(leftoverNeedsAi(leftover, parsed), false);
  });
});
