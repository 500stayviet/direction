import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  formatAlertBannerText,
  formatDocumentTitleAlertSuffix,
  formatOwnMatchBadgeLabel,
} from "@/lib/alertLabels";
import {
  formatMatchAlertBody,
  formatMatchAlertTitle,
  matchPairKey,
  parseMatchPairKey,
} from "@/lib/alertMessaging";
import {
  pickAlertBannerHref,
  totalUnseenFromState,
  unseenMatchSummaryFromState,
} from "@/lib/alertCounts";
import {
  computeWorkspaceMatchPairs,
  pairKeysToCandidates,
} from "@/lib/serverAlertScan";
import type { Customer, ListedProperty } from "@/lib/types";

describe("alertLabels", () => {
  it("formats document title suffix", () => {
    assert.equal(formatDocumentTitleAlertSuffix(0), "");
    assert.equal(formatDocumentTitleAlertSuffix(3), "(3) ");
  });

  it("formats banner text", () => {
    assert.equal(
      formatAlertBannerText({ matchOwn: 2, matchPartner: 0, share: 0 }),
      "조건 매칭 2건 — 확인하기"
    );
  });
});

describe("alertMessaging", () => {
  it("round-trips pair keys", () => {
    const key = matchPairKey("c1", "p1");
    assert.deepEqual(parseMatchPairKey(key), {
      customerId: "c1",
      propertyId: "p1",
    });
  });

  it("formats match notification copy", () => {
    const customer = { id: "c1", name: "김고객" } as Customer;
    const property = {
      id: "p1",
      address: "강동구 천호동 123-4",
    } as ListedProperty;
    assert.match(formatMatchAlertTitle("match"), /매칭/);
    assert.match(formatMatchAlertBody(customer, property), /김고객/);
    assert.match(formatMatchAlertBody(customer, property), /천호동/);
  });
});

describe("alertCounts", () => {
  it("sums unseen totals", () => {
    const total = totalUnseenFromState({
      shareSeeded: { customers: true, properties: true, navi: true },
      matchSeeded: true,
      newMatchSeeded: true,
      knownShare: { customers: [], properties: [], navi: [] },
      unseenShare: { customers: ["a"], properties: [], navi: [] },
      knownMatch: [],
      knownNewMatch: [],
      unseenMatchCustomer: ["c::p"],
      unseenMatchProperty: [],
      unseenNewMatchCustomer: [],
      unseenNewMatchProperty: [],
      alertSince: {},
      preserveDemoMatchAlerts: false,
    });
    assert.equal(total, 2);
  });

  it("picks banner href by earliest alertSince", () => {
    const state = {
      shareSeeded: { customers: true, properties: true, navi: true },
      matchSeeded: true,
      newMatchSeeded: true,
      knownShare: { customers: [], properties: [], navi: [] },
      unseenShare: { customers: [], properties: [], navi: [] },
      knownMatch: [],
      knownNewMatch: [],
      unseenMatchCustomer: [],
      unseenMatchProperty: [],
      unseenNewMatchCustomer: ["c_old::p1", "c_new::p2"],
      unseenNewMatchProperty: [],
      alertSince: {
        "newMatch:pair:c_old::p1": 100,
        "newMatch:pair:c_new::p2": 200,
      },
      preserveDemoMatchAlerts: false,
    };
    assert.equal(
      pickAlertBannerHref(state),
      "/customers/c_old?scrollMatch=1"
    );
  });

  it("picks banner href for match vs share", () => {
    const matchState = {
      shareSeeded: { customers: true, properties: true, navi: true },
      matchSeeded: true,
      newMatchSeeded: true,
      knownShare: { customers: [], properties: [], navi: [] },
      unseenShare: { customers: [], properties: [], navi: [] },
      knownMatch: [],
      knownNewMatch: [],
      unseenMatchCustomer: ["c1::p1"],
      unseenMatchProperty: [],
      unseenNewMatchCustomer: [],
      unseenNewMatchProperty: [],
      alertSince: { "match:pair:c1::p1": 100 },
      preserveDemoMatchAlerts: false,
    };
    assert.equal(pickAlertBannerHref(matchState), "/customers/c1?scrollMatch=1");

    const shareState = {
      ...matchState,
      unseenMatchCustomer: [],
      alertSince: { "share:customers:c9": 50 },
      unseenShare: { customers: ["c9"], properties: [], navi: [] },
    };
    assert.equal(pickAlertBannerHref(shareState), "/customers?scrollShare=c9");
  });
});

describe("serverAlertScan", () => {
  it("computes pair keys", () => {
    const userId = "u1";
    const customer = {
      id: "c1",
      createdBy: userId,
      createdAt: "2026-01-02T00:00:00.000Z",
      contractCompleted: false,
      dealType: "월세",
      roomType: "투룸",
      depositFrom: 1000,
      depositTo: 1000,
      depositSingle: true,
      monthlyRentFrom: 50,
      monthlyRentTo: 50,
      preferredGus: ["강동구"],
      preferredDongs: ["강동구|천호동"],
    } as Customer;
    const property = {
      id: "p1",
      createdBy: userId,
      createdAt: "2026-01-01T00:00:00.000Z",
      contractCompleted: false,
      dealType: "월세",
      roomType: "투룸",
      deposit: 1000,
      monthlyRent: 50,
      address: "강동구 천호동",
    } as ListedProperty;
    const pairs = computeWorkspaceMatchPairs([customer], [property], userId);
    assert.ok(pairs.own.length >= 1);
    const candidates = pairKeysToCandidates(pairs);
    assert.equal(candidates[0]?.kind, "match");
    assert.equal(candidates[0]?.side, "customer");
  });
});
