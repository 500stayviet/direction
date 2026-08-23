import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import {
  ensureTeamAlertsUser,
  formatOwnMatchBadgeLabel,
  formatSiteMatchBadgeLabel,
  getListCardAlertBadges,
  getTeamAlertsSnapshot,
  injectDemoTestAlerts,
  matchPairKey,
  syncMatchPairs,
  syncShareIds,
} from "./teamAlerts.ts";
import type { MatchEntityKind } from "./matchPools.ts";

function mockLocalStorage() {
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

describe("teamAlerts match badges", () => {
  beforeEach(() => {
    mockLocalStorage();
    ensureTeamAlertsUser("user-test");
  });

  it("매칭·사이트내 뱃지 라벨에 건수를 붙인다", () => {
    assert.equal(formatOwnMatchBadgeLabel(1), "매칭");
    assert.equal(formatOwnMatchBadgeLabel(3), "매칭 3");
    assert.equal(formatSiteMatchBadgeLabel(1), "사이트내");
    assert.equal(formatSiteMatchBadgeLabel(2), "사이트내 2");
  });

  it("첫 동기화에도 기존 매칭을 미열람으로 뱃지에 반영한다", () => {
    const ownSides = new Map<string, MatchEntityKind>([
      [matchPairKey("c1", "p1"), "customer"],
      [matchPairKey("c1", "p2"), "customer"],
    ]);
    const siteSides = new Map<string, MatchEntityKind>([
      [matchPairKey("c2", "p3"), "customer"],
    ]);
    syncMatchPairs(
      [matchPairKey("c1", "p1"), matchPairKey("c1", "p2")],
      [matchPairKey("c2", "p3")],
      { ownSides, siteSides }
    );

    const customerBadges = getListCardAlertBadges({
      tab: "customers",
      id: "c1",
    });
    assert.equal(
      customerBadges.find((b) => b.kind === "match")?.label,
      "매칭 2"
    );

    const siteBadges = getListCardAlertBadges({
      tab: "customers",
      id: "c2",
    });
    assert.equal(
      siteBadges.find((b) => b.kind === "newMatch")?.label,
      "사이트내"
    );

    const propertyBadges = getListCardAlertBadges({
      tab: "properties",
      id: "p1",
    });
    assert.equal(propertyBadges.find((b) => b.kind === "match"), undefined);
  });

  it("데모 알람은 고객 매칭 + 매물 팀공유로 나뉜다", () => {
    ensureTeamAlertsUser("user-demo-alerts");
    const pair = matchPairKey("demo_cust_1", "demo_prop_1");
    injectDemoTestAlerts({
      matchPairs: [pair],
      sharePropertyIds: ["demo_prop_1"],
    });
    syncShareIds("properties", []);

    const customerBadges = getListCardAlertBadges({
      tab: "customers",
      id: "demo_cust_1",
    });
    const propertyBadges = getListCardAlertBadges({
      tab: "properties",
      id: "demo_prop_1",
    });
    assert.equal(customerBadges.find((b) => b.kind === "match")?.label, "매칭");
    assert.equal(customerBadges.find((b) => b.kind === "share"), undefined);
    assert.equal(propertyBadges.find((b) => b.kind === "share")?.label, "팀공유");
    assert.equal(propertyBadges.find((b) => b.kind === "match"), undefined);

    const snap = getTeamAlertsSnapshot();
    assert.deepEqual(snap.unseenMatchCustomer, [pair]);
    assert.equal(snap.unseenMatchProperty.includes(pair), false);
  });
});
