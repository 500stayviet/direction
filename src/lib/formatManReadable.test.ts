import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatManReadable } from "./format.ts";

describe("formatManReadable", () => {
  it("억·천·만원으로 읽기 쉽게 만든다", () => {
    assert.equal(formatManReadable(10000), "1억");
    assert.equal(formatManReadable(15000), "1억 5천");
    assert.equal(formatManReadable(15500), "1억 5500만원");
    assert.equal(formatManReadable(5000), "5천");
    assert.equal(formatManReadable(200), "200만원");
    assert.equal(formatManReadable(0), "");
  });
});
