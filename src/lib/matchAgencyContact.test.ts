import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveMatchAgencyContact } from "./matchAgencyContact";
import type { Customer, ListedProperty } from "./types";

test("resolveMatchAgencyContact — 고객 스냅샷·선호 동", () => {
  const customer = {
    createdByShopName: "성내공인",
    createdByPhone: "01012345678",
    createdByDong: "성내동",
    preferredDongs: ["강동구|천호동"],
  } as Customer;

  assert.deepEqual(resolveMatchAgencyContact(customer), {
    shopName: "성내공인",
    dong: "성내동",
    phone: "01012345678",
  });
});

test("resolveMatchAgencyContact — 매물 주소에서 동 추출", () => {
  const property = {
    createdByName: "OO부동산",
    createdByPhone: "0212345678",
    address: "서울특별시 강동구 성내동 540",
  } as ListedProperty;

  assert.deepEqual(resolveMatchAgencyContact(property), {
    shopName: "OO부동산",
    dong: "성내동",
    phone: "0212345678",
  });
});

test("resolveMatchAgencyContact — 현장동선 상호는 기본 라벨", () => {
  const customer = {
    createdByShopName: "현장동선",
    createdByName: "홍길동",
    createdByPhone: "01099998888",
  } as Customer;

  assert.equal(resolveMatchAgencyContact(customer).shopName, "부동산");
});
