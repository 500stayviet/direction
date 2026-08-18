import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyNotesUtterance,
  TALK_IDLE_MS,
  TALK_FIELD_HOLD_MS,
  TALK_LOCATION_DONG_HOLD_MS,
  TALK_LISTEN_RESTART_MS,
  talkLocationHoldMs,
  TALK_ENDED_TITLE,
  TALK_ENDED_MESSAGE,
  TALK_STOP_HINT,
  TALK_RECOGNITION_FAIL,
  TALK_MIC_FAIL,
  TALK_SILENCE_STOP_MESSAGE,
  TALK_SILENCE_STOP_MS,
  isTalkMicError,
  talkPrimaryKind,
  talkPrimaryLabel,
  talkStepUsesFieldHold,
} from "./talkSession.ts";

describe("talkSession", () => {
  it("시작 전에는 대화 시작이다", () => {
    assert.equal(
      talkPrimaryKind({
        talkStarted: false,
        listening: false,
        currentKey: "roomType",
        allComplete: false,
      }),
      "start"
    );
    assert.equal(talkPrimaryLabel("start"), "대화 시작");
  });

  it("앞 칸에서는 정지이고 계속은 없다", () => {
    assert.equal(
      talkPrimaryKind({
        talkStarted: true,
        listening: true,
        currentKey: "roomType",
        allComplete: false,
      }),
      "stop"
    );
    assert.equal(talkPrimaryLabel("stop"), "정지");
  });

  it("메모를 듣는 중이거나 모두 초록이면 입력완료다", () => {
    assert.equal(
      talkPrimaryKind({
        talkStarted: true,
        listening: true,
        currentKey: "notes",
        allComplete: false,
      }),
      "finish"
    );
    assert.equal(
      talkPrimaryKind({
        talkStarted: true,
        listening: false,
        currentKey: "roomType",
        allComplete: true,
      }),
      "finish"
    );
    assert.equal(talkPrimaryLabel("finish"), "입력완료");
  });

  it("침묵·숨김으로 꺼진 메모는 정지라서 다시 녹음한다", () => {
    assert.equal(
      talkPrimaryKind({
        talkStarted: true,
        listening: false,
        currentKey: "notes",
        allComplete: false,
      }),
      "stop"
    );
    assert.equal(TALK_IDLE_MS, 10_000);
    assert.equal(TALK_FIELD_HOLD_MS, 2_000);
    assert.equal(TALK_LOCATION_DONG_HOLD_MS, 4_000);
    assert.equal(
      talkLocationHoldMs("property", { dong: "성내동" }),
      TALK_LOCATION_DONG_HOLD_MS
    );
    assert.equal(
      talkLocationHoldMs("property", { dong: "성내동", jibun: "151" }),
      TALK_FIELD_HOLD_MS
    );
    assert.equal(
      talkLocationHoldMs("customer", { dong: "성내동" }),
      TALK_FIELD_HOLD_MS
    );
    assert.equal(TALK_LISTEN_RESTART_MS, 120);
    assert.equal(talkStepUsesFieldHold("location"), true);
    assert.equal(talkStepUsesFieldHold("restAddress"), true);
    assert.equal(talkStepUsesFieldHold("tenantPhone"), true);
    assert.equal(talkStepUsesFieldHold("landlordPhone"), true);
    assert.equal(talkStepUsesFieldHold("notes"), true);
    assert.equal(talkStepUsesFieldHold("roomType"), false);
    assert.equal(TALK_ENDED_TITLE, "입력완료!");
    assert.equal(
      TALK_ENDED_MESSAGE,
      "입력한 내용을 확인한 뒤 반영하기를 눌러 주세요."
    );
    assert.match(TALK_STOP_HINT, /녹화버튼/);
    assert.match(TALK_STOP_HINT, /대화를 이어가세요/);
    assert.equal(
      TALK_SILENCE_STOP_MESSAGE,
      "대화가 없어 마이크 정지 되었습니다."
    );
    assert.equal(TALK_SILENCE_STOP_MS, 1_500);
    assert.match(TALK_RECOGNITION_FAIL, /대화를 인식하지 못했습니다/);
    assert.equal(TALK_MIC_FAIL, "마이크를 연결할 수 없습니다.");
    assert.equal(isTalkMicError("not-allowed"), true);
    assert.equal(isTalkMicError("audio-capture"), true);
    assert.equal(isTalkMicError("network"), false);
  });

  it("메모는 말을 쌓고 삭제는 비운다", () => {
    const first = applyNotesUtterance("", "메모: 남향");
    assert.equal(first.clear, false);
    assert.equal(first.draft, "남향");

    const second = applyNotesUtterance(first.draft, "저층");
    assert.equal(second.draft, "남향 저층");

    const cleared = applyNotesUtterance(second.draft, "삭제");
    assert.equal(cleared.clear, true);
    assert.equal(cleared.draft, "");

    const dasiClear = applyNotesUtterance("남향", "다시");
    assert.equal(dasiClear.clear, true);
  });
});
