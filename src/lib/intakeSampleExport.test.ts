import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildIntakeSampleExportBundle,
  type IntakeSampleRow,
} from "./intakeSampleExport.ts";

describe("intakeSampleExport", () => {
  it("export JSON·요약·Cursor 프롬프트를 만든다", () => {
    const rows: IntakeSampleRow[] = [
      {
        id: "a",
        kind: "property",
        source: "message",
        rawText: "성내동 1억/110/관5",
        parsed: { options: [], notes: "", dong: "성내동" },
        missingFields: ["deposit", "monthlyRent"],
        status: "new",
        createdAt: "2026-08-15T10:00:00.000Z",
      },
      {
        id: "b",
        kind: "property",
        source: "photo",
        rawText: "성내동 1억/110/관5",
        parsed: { options: [], notes: "", dong: "성내동" },
        missingFields: ["deposit"],
        status: "new",
        createdAt: "2026-08-15T11:00:00.000Z",
      },
    ];

    const bundle = buildIntakeSampleExportBundle(rows, "2026-08-10 ~ 2026-08-16");
    const parsed = JSON.parse(bundle.json) as { sampleCount: number };
    assert.equal(parsed.sampleCount, 1);
    assert.match(bundle.summary, /deposit/);
    assert.match(bundle.cursorPrompt, /코드 수정·커밋·푸시는 하지 말 것/);
  });
});
