import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeSharePushCandidates } from "./serverShareAlertScan.ts";
import type { AlertState } from "./teamAlerts.ts";

function emptyAlerts(overrides: Partial<AlertState> = {}): AlertState {
  return {
    shareSeeded: { customers: false, properties: false, navi: false },
    matchSeeded: false,
    newMatchSeeded: false,
    knownShare: { customers: [], properties: [], navi: [] },
    unseenShare: { customers: [], properties: [], navi: [] },
    knownMatch: [],
    knownNewMatch: [],
    unseenMatchCustomer: [],
    unseenMatchProperty: [],
    unseenNewMatchCustomer: [],
    unseenNewMatchProperty: [],
    alertSince: {},
    preserveDemoShareAlerts: false,
    ...overrides,
  };
}

describe("serverShareAlertScan", () => {
  it("shareSeeded 탭에서 known에 없는 foreign만 후보", () => {
    const candidates = computeSharePushCandidates({
      foreign: [
        { id: "p-new", tab: "properties", label: "강동구 매물" },
        { id: "p-old", tab: "properties", label: "기존" },
      ],
      alerts: emptyAlerts({
        shareSeeded: { customers: false, properties: true, navi: false },
        knownShare: {
          customers: [],
          properties: ["p-old"],
          navi: [],
        },
      }),
      hides: { customers: [], properties: [], schedules: [] },
    });
    assert.equal(candidates.length, 1);
    assert.equal(candidates[0]?.entityId, "p-new");
    assert.equal(candidates[0]?.pairKey, "share:properties:p-new");
  });

  it("shareSeeded false 탭은 푸시 후보 없음", () => {
    const candidates = computeSharePushCandidates({
      foreign: [{ id: "p1", tab: "properties", label: "x" }],
      alerts: emptyAlerts(),
      hides: { customers: [], properties: [], schedules: [] },
    });
    assert.equal(candidates.length, 0);
  });

  it("숨김·데모 제외", () => {
    const candidates = computeSharePushCandidates({
      foreign: [
        { id: "demo_x", tab: "properties", label: "demo" },
        { id: "p-hide", tab: "properties", label: "hide" },
        { id: "p-ok", tab: "properties", label: "ok" },
      ],
      alerts: emptyAlerts({
        shareSeeded: { customers: false, properties: true, navi: false },
      }),
      hides: { customers: [], properties: ["p-hide"], schedules: [] },
    });
    assert.deepEqual(
      candidates.map((c) => c.entityId),
      ["p-ok"]
    );
  });
});
