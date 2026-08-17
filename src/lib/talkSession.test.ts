import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyNotesUtterance,
  TALK_IDLE_MS,
  TALK_FIELD_HOLD_MS,
  TALK_LOCATION_HOLD_MS,
  TALK_MONEY_HOLD_MS,
  TALK_DATES_HOLD_MS,
  TALK_ENDED_MS,
  TALK_ENDED_MESSAGE,
  TALK_STOP_HINT,
  talkPrimaryKind,
  talkPrimaryLabel,
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
    assert.equal(TALK_LOCATION_HOLD_MS, TALK_FIELD_HOLD_MS);
    assert.equal(TALK_MONEY_HOLD_MS, TALK_FIELD_HOLD_MS);
    assert.equal(TALK_DATES_HOLD_MS, TALK_FIELD_HOLD_MS);
    assert.equal(TALK_ENDED_MS, 2_000);
    assert.equal(TALK_ENDED_MESSAGE, "대화가 종료되었습니다.");
    assert.match(TALK_STOP_HINT, /녹화버튼/);
    assert.match(TALK_STOP_HINT, /대화를 이어가세요/);
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
  });
});
