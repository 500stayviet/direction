import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isMoveInDueReached,
  shouldAutoCompleteProperty,
} from "./contractAutoComplete.ts";
import { createEmptyProperty } from "./constants.ts";
import type { ListedProperty } from "./types.ts";

function listed(partial: Partial<ListedProperty> = {}): ListedProperty {
  return {
    ...createEmptyProperty(),
    id: "p1",
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...partial,
  };
}

describe("isMoveInDueReached", () => {
  it("당일에는 아직 아니고, 다음 날부터 true", () => {
    assert.equal(
      isMoveInDueReached("2026-08-18", "2026-08-18", true, "2026-08-18"),
      false
    );
    assert.equal(
      isMoveInDueReached("2026-08-18", "2026-08-18", true, "2026-08-19"),
      true
    );
  });

  it("기간이면 끝나는 날 다음부터 true", () => {
    assert.equal(
      isMoveInDueReached("2026-08-10", "2026-08-18", false, "2026-08-18"),
      false
    );
    assert.equal(
      isMoveInDueReached("2026-08-10", "2026-08-18", false, "2026-08-19"),
      true
    );
  });
});

describe("shouldAutoCompleteProperty", () => {
  it("공실은 날짜가 있어도 자동 종료하지 않는다", () => {
    assert.equal(
      shouldAutoCompleteProperty(
        listed({
          moveInVacant: true,
          moveInFrom: "2026-08-01",
          moveInTo: "2026-08-01",
          moveInSingle: true,
        })
      ),
      false
    );
  });
});
