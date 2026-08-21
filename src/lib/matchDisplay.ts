import {
  findMatchingCustomersGrouped,
  findMatchingPropertiesGrouped,
} from "@/lib/matchCustomerProperty";
import {
  splitCustomersForMatching,
  splitPropertiesForMatching,
} from "@/lib/matchPools";
import type { Customer, ListedProperty } from "@/lib/types";

/** 상세·모달용 — own/site 풀 분리 후 grouped 매칭 */
export function groupedMatchesForCustomer(
  customer: Customer,
  properties: ListedProperty[],
  userId: string | null | undefined
): { own: ListedProperty[]; partner: ListedProperty[] } {
  const { ownPool, sitePool } = splitPropertiesForMatching(properties, userId);
  return findMatchingPropertiesGrouped(customer, ownPool, sitePool);
}

export function groupedMatchesForProperty(
  property: ListedProperty,
  customers: Customer[],
  userId: string | null | undefined
): { own: Customer[]; partner: Customer[] } {
  const { ownPool, sitePool } = splitCustomersForMatching(customers, userId);
  return findMatchingCustomersGrouped(property, ownPool, sitePool);
}
