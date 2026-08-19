import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  doorPasswordMemoText,
  foldDoorPasswordsIntoNotes,
  notesWithDoorPasswords,
} from "./propertyPasswords.ts";

describe("propertyPasswords", () => {
  it("현관·호실 비밀번호를 메모 한 줄로 만든다", () => {
    assert.equal(
      doorPasswordMemoText({
        floorPassword: "1234*",
        roomPassword: "5678*",
      }),
      "현관 1234* · 호실 5678*"
    );
  });

  it("기존 메모에 비밀번호를 붙인다", () => {
    assert.equal(
      notesWithDoorPasswords({
        notes: "남향",
        floorPassword: "1234*",
      }),
      "남향\n현관 1234*"
    );
  });

  it("저장 시 전용 칸을 비우고 메모로 옮긴다", () => {
    const folded = foldDoorPasswordsIntoNotes({
      notes: "남향",
      floorPassword: "1234*",
      roomPassword: "5678*",
    });
    assert.equal(folded.notes, "남향\n현관 1234* · 호실 5678*");
    assert.equal(folded.floorPassword, "");
    assert.equal(folded.roomPassword, "");
  });

  it("메모에 이미 있으면 중복하지 않는다", () => {
    const notes = "남향\n현관 1234* · 호실 5678*";
    assert.equal(
      notesWithDoorPasswords({
        notes,
        floorPassword: "1234*",
        roomPassword: "5678*",
      }),
      notes
    );
  });
});
