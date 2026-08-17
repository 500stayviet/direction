import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { WORKSPACE_NAME_MAX, normalizeWorkspaceName } from "./workspaceName.ts";

describe("workspaceName", () => {
  it("앞뒤 공백을 지우고 길이를 자른다", () => {
    assert.equal(normalizeWorkspaceName("  성내팀  "), "성내팀");
    assert.equal(WORKSPACE_NAME_MAX, 20);
    assert.equal(normalizeWorkspaceName("가".repeat(25)).length, 20);
  });
});
