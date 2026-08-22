import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  mergeAlerts,
  mergeHides,
  sameUiPrefs,
  type UiPrefs,
} from "./userUiPrefs.ts";
import type { AlertState } from "./teamAlerts.ts";

function emptyAlerts(): AlertState {
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
    preserveDemoMatchAlerts: false,
  };
}

describe("userUiPrefs merge", () => {
  it("한쪽에서 확인(share)하면 다른 쪽 unseen도 제거", () => {
    const local = emptyAlerts();
    local.knownShare.customers = ["c1"];
    local.unseenShare.customers = ["c1"];

    const remote = emptyAlerts();
    remote.knownShare.customers = ["c1"];
    remote.unseenShare.customers = [];

    const merged = mergeAlerts(local, remote);
    assert.deepEqual(merged.unseenShare.customers, []);
  });

  it("한쪽만 unseen이면 union 유지", () => {
    const local = emptyAlerts();
    local.knownShare.properties = ["p1"];
    local.unseenShare.properties = ["p1"];

    const remote = emptyAlerts();
    remote.knownShare.properties = ["p1"];
    remote.unseenShare.properties = ["p1"];

    const merged = mergeAlerts(local, remote);
    assert.deepEqual(merged.unseenShare.properties, ["p1"]);
  });

  it("숨김 리스트는 합집합", () => {
    const merged = mergeHides(
      { customers: ["a"], properties: [], schedules: [] },
      { customers: [], properties: ["p1"], schedules: [] }
    );
    assert.deepEqual(merged.customers, ["a"]);
    assert.deepEqual(merged.properties, ["p1"]);
  });

  it("sameUiPrefs compares full snapshot", () => {
    const a: UiPrefs = {
      hides: { customers: [], properties: [], schedules: [] },
      alerts: emptyAlerts(),
    };
    const b: UiPrefs = {
      hides: { customers: [], properties: [], schedules: [] },
      alerts: emptyAlerts(),
    };
    assert.equal(sameUiPrefs(a, b), true);
  });
});
