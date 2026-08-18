import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { consumeListSwipeNudge } from "./customerSwipeHint.ts";

function mockSessionStorage() {
  const store = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index) {
      return [...store.keys()][index] ?? null;
    },
    removeItem(key) {
      store.delete(key);
    },
    setItem(key, value) {
      store.set(key, value);
    },
  };
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: storage,
  });
}

describe("consumeListSwipeNudge", () => {
  beforeEach(() => {
    mockSessionStorage();
  });

  it("고객을 보여 줘도 매물·네비는 따로 한 번씩 보여 준다", () => {
    assert.equal(consumeListSwipeNudge("customers"), true);
    assert.equal(consumeListSwipeNudge("customers"), false);
    assert.equal(consumeListSwipeNudge("properties"), true);
    assert.equal(consumeListSwipeNudge("navi"), true);
    assert.equal(consumeListSwipeNudge("properties"), false);
    assert.equal(consumeListSwipeNudge("navi"), false);
  });
});
