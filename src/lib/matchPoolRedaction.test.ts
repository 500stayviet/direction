import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  applyMatchPoolRedaction,
  assertSitePoolPayloadClean,
  isSitePoolEntity,
  redactCustomerForSiteMatch,
  redactPropertyForSiteMatch,
} from "@/lib/matchPoolRedaction";
import type { Customer, ListedProperty } from "@/lib/types";

describe("matchPoolRedaction", () => {
  it("identifies site pool entities", () => {
    assert.equal(
      isSitePoolEntity(
        { createdBy: "u2", workspaceShared: false },
        "u1"
      ),
      true
    );
    assert.equal(
      isSitePoolEntity(
        { createdBy: "u2", workspaceShared: true },
        "u1"
      ),
      false
    );
    assert.equal(
      isSitePoolEntity({ createdBy: "u1", workspaceShared: false }, "u1"),
      false
    );
  });

  it("strips customer PII for site match", () => {
    const redacted = redactCustomerForSiteMatch({
      id: "c1",
      name: "비공개",
      phone: "010-1111-2222",
      notes: "메모",
      createdByName: "개인",
      createdByShopName: "테스트부동산",
      createdByPhone: "010-9999-8888",
      dealType: "월세",
      deposit: 1000,
      budget: "",
      moveInFrom: "",
      moveInTo: "",
      moveInDate: "",
      parkingType: "무",
      petAllowed: "무",
      createdAt: "",
      updatedAt: "",
    } as Customer);
    assert.equal(redacted.name, "");
    assert.equal(redacted.phone, "");
    assert.equal(redacted.notes, "");
    assert.equal(redacted.createdByName, undefined);
    assert.equal(redacted.createdByShopName, "테스트부동산");
    assert.deepEqual(assertSitePoolPayloadClean(redacted, "customer"), []);
  });

  it("strips property PII for site match", () => {
    const redacted = redactPropertyForSiteMatch({
      id: "p1",
      address: "강동구 천호동",
      roomNo: "101",
      tenantPhone: "010-3333-4444",
      landlordPhone: "010-5555-6666",
      hasPartnerAgency: true,
      partnerAgency: { name: "협력", phone: "010-7777-8888", dong: "암사" },
      notes: "비밀메모",
      floorPassword: "1234",
      roomPassword: "5678",
      createdByName: "개인",
      createdByShopName: "매물부동산",
      dealType: "월세",
      deposit: 1000,
      petAllowed: "무",
      parkingType: "무",
      loanAvailable: "무",
      insuranceType: "무",
      elevator: false,
      moveInFrom: "",
      moveInTo: "",
      createdAt: "",
      updatedAt: "",
    } as ListedProperty);
    assert.equal(redacted.tenantPhone, undefined);
    assert.equal(redacted.hasPartnerAgency, false);
    assert.equal(redacted.partnerAgency.name, "");
    assert.deepEqual(assertSitePoolPayloadClean(redacted, "property"), []);
  });

  it("redacts only foreign non-shared items in pool", () => {
    const own = {
      id: "c-own",
      createdBy: "u1",
      workspaceShared: false,
      name: "내고객",
      phone: "010-0000-1111",
    } as Customer;
    const site = {
      id: "c-site",
      createdBy: "u2",
      workspaceShared: false,
      name: "타고객",
      phone: "010-0000-2222",
      createdByShopName: "상대부동산",
    } as Customer;
    const { customers } = applyMatchPoolRedaction({
      customers: [own, site],
      properties: [],
      viewerUserId: "u1",
    });
    assert.equal(customers[0]?.name, "내고객");
    assert.equal(customers[1]?.name, "");
  });
});
