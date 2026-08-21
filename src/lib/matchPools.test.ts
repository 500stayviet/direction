import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildMatchAlertSideMaps,
  computeMatchPairKeys,
  pickOwnMatchAlertSide,
  pickSiteMatchAlertSide,
  splitCustomersForMatching,
  splitPropertiesForMatching,
} from "./matchPools.ts";
import type { Customer, ListedProperty } from "./types.ts";

function customer(
  id: string,
  createdBy: string,
  createdAt: string,
  extra: Partial<Customer> = {}
): Customer {
  return {
    id,
    name: `고객${id}`,
    phone: "01012345678",
    dealType: "전세",
    depositFrom: 10000,
    depositTo: 10000,
    depositSingle: true,
    roomType: "원룸",
    createdBy,
    createdByName: "테스트",
    createdAt,
    updatedAt: createdAt,
    workspaceShared: extra.workspaceShared,
    ...extra,
  };
}

function property(
  id: string,
  createdBy: string,
  createdAt: string,
  extra: Partial<ListedProperty> = {}
): ListedProperty {
  return {
    id,
    address: `서울시 테스트로 ${id}`,
    dealType: "전세",
    deposit: 10000,
    roomType: "원룸",
    createdBy,
    createdByName: "테스트",
    createdAt,
    updatedAt: createdAt,
    workspaceShared: extra.workspaceShared,
    ...extra,
  };
}

describe("matchPools", () => {
  it("팀원 비공유 항목은 sitePool로 분리", () => {
    const userId = "u1";
    const customers = [
      customer("c-own", userId, "2026-01-01T00:00:00.000Z"),
      customer("c-site", "u2", "2026-01-02T00:00:00.000Z", {
        workspaceShared: false,
      }),
      customer("c-team", "u2", "2026-01-03T00:00:00.000Z", {
        workspaceShared: true,
      }),
    ];
    const split = splitCustomersForMatching(customers, userId);
    assert.deepEqual(
      split.ownPool.map((c) => c.id),
      ["c-own", "c-team"]
    );
    assert.deepEqual(split.sitePool.map((c) => c.id), ["c-site"]);
  });

  it("① own 매칭은 나중 등록 쪽에만 알람", () => {
    assert.equal(
      pickOwnMatchAlertSide({
        customer: customer("c1", "u1", "2026-01-02T00:00:00.000Z"),
        property: property("p1", "u1", "2026-01-01T00:00:00.000Z"),
      }),
      "customer"
    );
    assert.equal(
      pickOwnMatchAlertSide({
        customer: customer("c1", "u1", "2026-01-01T00:00:00.000Z"),
        property: property("p1", "u1", "2026-01-02T00:00:00.000Z"),
      }),
      "property"
    );
  });

  it("② site 매칭은 현재 사용자 소유 쪽에만 알람", () => {
    assert.equal(
      pickSiteMatchAlertSide({
        userId: "u1",
        customer: customer("c1", "u1", "2026-01-01T00:00:00.000Z"),
        property: property("p1", "u2", "2026-01-02T00:00:00.000Z"),
      }),
      "customer"
    );
    assert.equal(
      pickSiteMatchAlertSide({
        userId: "u1",
        customer: customer("c1", "u2", "2026-01-01T00:00:00.000Z"),
        property: property("p1", "u1", "2026-01-02T00:00:00.000Z"),
      }),
      "property"
    );
    assert.equal(
      pickSiteMatchAlertSide({
        userId: "u1",
        customer: customer("c1", "u2", "2026-01-01T00:00:00.000Z"),
        property: property("p1", "u3", "2026-01-02T00:00:00.000Z"),
      }),
      null
    );
  });

  it("own×own과 site cross 매칭 키를 분리", () => {
    const userId = "u1";
    const customers = [
      customer("c-own", userId, "2026-01-01T00:00:00.000Z"),
      customer("c-site", "u2", "2026-01-02T00:00:00.000Z"),
    ];
    const properties = [
      property("p-own", userId, "2026-01-01T00:00:00.000Z"),
      property("p-site", "u2", "2026-01-02T00:00:00.000Z"),
    ];
    const { ownKeys, siteKeys } = computeMatchPairKeys({
      customers,
      properties,
      userId,
    });
    assert.ok(ownKeys.includes("c-own::p-own"));
    assert.ok(siteKeys.includes("c-own::p-site"));
    assert.ok(siteKeys.includes("c-site::p-own"));
    assert.equal(ownKeys.includes("c-site::p-site"), false);

    const sideMaps = buildMatchAlertSideMaps({
      userId,
      ownKeys,
      siteKeys,
      customersById: new Map(customers.map((c) => [c.id, c])),
      propertiesById: new Map(properties.map((p) => [p.id, p])),
    });
    assert.equal(sideMaps.ownSides.get("c-own::p-own"), "customer");
    assert.equal(sideMaps.siteSides.get("c-own::p-site"), "customer");
    assert.equal(sideMaps.siteSides.get("c-site::p-own"), "property");
  });
});
