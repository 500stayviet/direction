import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import {
  hideFeatureIntroForever,
  shouldOpenFeatureIntroOnHome,
  shouldShowFeatureIntro,
} from "./featureIntro.ts";

function mockStorage() {
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
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: storage,
  });
}

describe("featureIntro", () => {
  beforeEach(() => {
    mockStorage();
  });

  it("다시 보지 않기를 누르기 전에는 홈에서 연다", () => {
    assert.equal(shouldShowFeatureIntro("u1"), true);
    assert.equal(shouldOpenFeatureIntroOnHome("/", "u1"), true);
    assert.equal(shouldOpenFeatureIntroOnHome("/customers", "u1"), false);
    assert.equal(shouldOpenFeatureIntroOnHome("/", undefined), false);
  });

  it("다시 보지 않기를 누르면 홈에서도 열지 않는다", () => {
    hideFeatureIntroForever("u1");
    assert.equal(shouldShowFeatureIntro("u1"), false);
    assert.equal(shouldOpenFeatureIntroOnHome("/", "u1"), false);
    assert.equal(shouldShowFeatureIntro("u2"), true);
  });
});
