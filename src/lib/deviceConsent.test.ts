import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEVICE_CONSENT_MS,
  grantDeviceConsent,
  hasValidDeviceConsent,
} from "./deviceConsent.ts";

describe("deviceConsent", () => {
  it("허용 후 한 달 안이면 다시 묻지 않는다", () => {
    const mem = new Map<string, string>();
    const store = {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => {
        mem.set(k, v);
      },
    };
    (globalThis as { window?: { localStorage: typeof store } }).window = {
      localStorage: store,
    };
    try {
      const t0 = 1_700_000_000_000;
      grantDeviceConsent("microphone", t0);
      assert.equal(hasValidDeviceConsent("microphone", t0 + 1000), true);
      assert.equal(
        hasValidDeviceConsent("microphone", t0 + DEVICE_CONSENT_MS - 1),
        true
      );
      assert.equal(
        hasValidDeviceConsent("microphone", t0 + DEVICE_CONSENT_MS),
        false
      );
      assert.equal(hasValidDeviceConsent("photos", t0), false);
    } finally {
      delete (globalThis as { window?: unknown }).window;
    }
  });
});
