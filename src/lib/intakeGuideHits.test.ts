import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { intakeGuideHitsFromText } from "./intakeGuideHits.ts";

describe("intakeGuideHitsFromText", () => {
  it("원룸이 오면 매물유형만 초록 값으로 남긴다", () => {
    const hits = intakeGuideHitsFromText("원룸", "customer");
    assert.equal(hits.roomType, "원룸");
    assert.equal(hits.dealType, undefined);
    assert.equal(hits.notes, undefined);
  });

  it("고객 대화에서 유형·거래·위치·금액을 가이드에 넣는다", () => {
    const hits = intakeGuideHitsFromText(
      "원룸 전세 2억 암사동",
      "customer"
    );
    assert.equal(hits.roomType, "원룸");
    assert.equal(hits.dealType, "전세");
    assert.equal(hits.location, "강동구 암사동");
    assert.equal(hits.money, "보증금 2억");
  });

  it("고객 메시지에서 이름·라벨 없이도 고객명 칸에 넣는다", () => {
    const unlabeled = intakeGuideHitsFromText(
      "홍길동 010-1234-5678 원룸",
      "customer"
    );
    assert.equal(unlabeled.name, "홍길동");
    assert.equal(unlabeled.phone, "010-1234-5678");
    assert.equal(unlabeled.roomType, "원룸");

    const alone = intakeGuideHitsFromText("홍길동", "customer");
    assert.equal(alone.name, "홍길동");

    const labeled = intakeGuideHitsFromText(
      "고객명 홍길동 010-1234-5678 원룸",
      "customer"
    );
    assert.equal(labeled.name, "홍길동");
  });

  it("매물 주소와 전화를 가이드에 넣는다", () => {
    const hits = intakeGuideHitsFromText(
      "원룸 전세 암사동 101동 102호 임차인 010-1111-1111",
      "property"
    );
    assert.equal(hits.roomType, "원룸");
    assert.match(hits.location ?? "", /암사동/);
    assert.match(hits.location ?? "", /101동 102호/);
    assert.match(hits.contacts ?? "", /010-1111-1111/);
  });
});
