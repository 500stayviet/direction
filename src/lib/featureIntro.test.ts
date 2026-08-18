import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import {
  FEATURE_INTRO_SNOOZE_MS,
  isFeatureIntroHidden,
  shouldOpenFeatureIntroOnHome,
  shouldShowFeatureIntro,
  snoozeFeatureIntro,
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

  it("숨기기 전에는 홈에서 연다", () => {
    assert.equal(shouldShowFeatureIntro("u1"), true);
    assert.equal(shouldOpenFeatureIntroOnHome("/", "u1"), true);
    assert.equal(shouldOpenFeatureIntroOnHome("/customers", "u1"), false);
    assert.equal(shouldOpenFeatureIntroOnHome("/", undefined), false);
  });

  it("다시 보지 않기는 1주일만 숨기고 지나면 다시 연다", () => {
    const t0 = 1_700_000_000_000;
    snoozeFeatureIntro("u1", t0);
    assert.equal(isFeatureIntroHidden("u1", t0 + 1), true);
    assert.equal(shouldShowFeatureIntro("u1", t0 + 1), false);
    assert.equal(shouldOpenFeatureIntroOnHome("/", "u1", t0 + 1), false);
    assert.equal(shouldShowFeatureIntro("u2", t0 + 1), true);

    const afterWeek = t0 + FEATURE_INTRO_SNOOZE_MS + 1;
    assert.equal(isFeatureIntroHidden("u1", afterWeek), false);
    assert.equal(shouldShowFeatureIntro("u1", afterWeek), true);
    assert.equal(shouldOpenFeatureIntroOnHome("/", "u1", afterWeek), true);
  });

  it("예전 영구 숨김 값은 무시하고 다시 보여 준다", () => {
    localStorage.setItem("realty_feature_intro_hide_u1", "1");
    assert.equal(shouldShowFeatureIntro("u1"), true);
    assert.equal(localStorage.getItem("realty_feature_intro_hide_u1"), null);
  });
});
