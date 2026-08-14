import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  absorbCommitted,
  appendSpoken,
  collapseRepeatSpeech,
  composeTalkText,
  liveTail,
  mergeSpeech,
  readSpeechResults,
  spokenFromResults,
} from "./speechTranscript.ts";

describe("speechTranscript", () => {
  it("연달아 같은 단어·구를 한 번만 남긴다", () => {
    assert.equal(
      collapseRepeatSpeech("원룸 원룸 원룸 매매 원룸 매매"),
      "원룸 매매"
    );
    assert.equal(collapseRepeatSpeech("원룸 원룸"), "원룸");
    assert.equal(collapseRepeatSpeech("암사동 천호동"), "암사동 천호동");
  });

  it("앞 글자와 겹치는 인식은 이어 붙이지 않는다", () => {
    assert.equal(mergeSpeech("원룸", "원룸 매매"), "원룸 매매");
    assert.equal(mergeSpeech("원룸 매매", "원룸 매매"), "원룸 매매");
    assert.equal(mergeSpeech("원룸 매매", "매매"), "원룸 매매");
    assert.equal(mergeSpeech("원룸 매매", "암사동"), "원룸 매매 암사동");
  });

  it("최종 결과에 중간 인식이 겹치면 한 줄로 합친다", () => {
    const spoken = spokenFromResults([
      { isFinal: true, 0: { transcript: "원룸" } },
      { isFinal: false, 0: { transcript: "원룸 매매" } },
    ]);
    assert.equal(spoken, "원룸 매매");
  });

  it("세션이 다시 시작돼도 같은 말을 중복하지 않는다", () => {
    assert.equal(appendSpoken("원룸 매매", "원룸 매매"), "원룸 매매");
    assert.equal(
      appendSpoken("원룸", "원룸 원룸 매매 원룸 매매"),
      "원룸 매매"
    );
  });

  it("중간 인식은 이어 붙이지 않고 마지막 한 줄만 쓴다", () => {
    const { sessionFinal, live } = readSpeechResults([
      { isFinal: true, 0: { transcript: "원룸" } },
      { isFinal: false, 0: { transcript: "원룸 매" } },
      { isFinal: false, 0: { transcript: "원룸 매매" } },
    ]);
    assert.equal(sessionFinal, "원룸");
    assert.equal(live, "원룸 매매");
    assert.equal(composeTalkText("", sessionFinal, live), "원룸 매매");
  });

  it("이미 확정된 말은 빼고 지금 하는 말만 남긴다", () => {
    assert.equal(liveTail("원룸", "원룸 매매"), "매매");
    assert.equal(liveTail("원룸 매매", "원룸 매매"), "");
    assert.equal(liveTail("원룸 매매", "암사동"), "암사동");
  });

  it("세션이 다시 시작된 메아리는 확정 글에 넣지 않는다", () => {
    assert.equal(absorbCommitted("원룸 매매", "원룸 매매"), "원룸 매매");
    assert.equal(absorbCommitted("원룸 매매", "원룸"), "원룸 매매");
    assert.equal(absorbCommitted("원룸 매매", "매매"), "원룸 매매");
    assert.equal(
      absorbCommitted("원룸 매매", "원룸 매매 암사동"),
      "원룸 매매 암사동"
    );
  });
});
