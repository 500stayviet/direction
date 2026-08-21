import {
  matchPairKey,
  parseMatchPairKey,
} from "@/lib/alertMessaging";
import { findMatchingPropertiesGrouped } from "@/lib/matchCustomerProperty";
import { isForeignTeamItem } from "@/lib/teamActionGuard";
import type { Customer, ListedProperty } from "@/lib/types";

export { matchPairKey };

export type MatchEntityKind = "customer" | "property";

/** ① own pool: 내 등록 + 팀원이 workspaceShared 켠 항목 */
export function splitCustomersForMatching(
  customers: Customer[],
  userId: string | null | undefined
): { ownPool: Customer[]; sitePool: Customer[] } {
  const ownPool: Customer[] = [];
  const sitePool: Customer[] = [];
  if (!userId) return { ownPool: customers, sitePool: [] };
  for (const c of customers) {
    if (c.contractCompleted) continue;
    if (!isForeignTeamItem(c.createdBy, userId)) {
      ownPool.push(c);
      continue;
    }
    if (c.workspaceShared) ownPool.push(c);
    else sitePool.push(c);
  }
  return { ownPool, sitePool };
}

export function splitPropertiesForMatching(
  properties: ListedProperty[],
  userId: string | null | undefined
): { ownPool: ListedProperty[]; sitePool: ListedProperty[] } {
  const ownPool: ListedProperty[] = [];
  const sitePool: ListedProperty[] = [];
  if (!userId) return { ownPool: properties, sitePool: [] };
  for (const p of properties) {
    if (p.contractCompleted) continue;
    if (!isForeignTeamItem(p.createdBy, userId)) {
      ownPool.push(p);
      continue;
    }
    if (p.workspaceShared) ownPool.push(p);
    else sitePool.push(p);
  }
  return { ownPool, sitePool };
}

function entityTime(iso?: string): number {
  const t = Date.parse(iso ?? "");
  return Number.isFinite(t) ? t : 0;
}

/** ① 내 매칭 — 나중에 등록한 쪽에만 알람 */
export function pickOwnMatchAlertSide(input: {
  customer: Customer;
  property: ListedProperty;
}): MatchEntityKind {
  const cAt = entityTime(input.customer.createdAt);
  const pAt = entityTime(input.property.createdAt);
  if (cAt > pAt) return "customer";
  if (pAt > cAt) return "property";
  return "customer";
}

/** ② 사이트내 — 현재 로그인 사용자 소유 쪽에만 알람 */
export function pickSiteMatchAlertSide(input: {
  userId: string;
  customer: Customer;
  property: ListedProperty;
}): MatchEntityKind | null {
  const ownsCustomer = !isForeignTeamItem(input.customer.createdBy, input.userId);
  const ownsProperty = !isForeignTeamItem(
    input.property.createdBy,
    input.userId
  );
  if (ownsCustomer && !ownsProperty) return "customer";
  if (ownsProperty && !ownsCustomer) return "property";
  if (ownsCustomer && ownsProperty) return null;
  return null;
}

export type MatchAlertSideMaps = {
  ownSides: Map<string, MatchEntityKind>;
  siteSides: Map<string, MatchEntityKind>;
};

export function buildMatchAlertSideMaps(input: {
  userId: string;
  ownKeys: string[];
  siteKeys: string[];
  customersById: Map<string, Customer>;
  propertiesById: Map<string, ListedProperty>;
}): MatchAlertSideMaps {
  const ownSides = new Map<string, MatchEntityKind>();
  const siteSides = new Map<string, MatchEntityKind>();

  for (const key of input.ownKeys) {
    const parsed = parseMatchPairKey(key);
    if (!parsed) continue;
    const customer = input.customersById.get(parsed.customerId);
    const property = input.propertiesById.get(parsed.propertyId);
    if (!customer || !property) continue;
    ownSides.set(key, pickOwnMatchAlertSide({ customer, property }));
  }

  for (const key of input.siteKeys) {
    const parsed = parseMatchPairKey(key);
    if (!parsed) continue;
    const customer = input.customersById.get(parsed.customerId);
    const property = input.propertiesById.get(parsed.propertyId);
    if (!customer || !property) continue;
    const side = pickSiteMatchAlertSide({
      userId: input.userId,
      customer,
      property,
    });
    if (side) siteSides.set(key, side);
  }

  return { ownSides, siteSides };
}

export function indexCustomers(customers: Customer[]): Map<string, Customer> {
  return new Map(customers.map((c) => [c.id, c]));
}

export function indexProperties(
  properties: ListedProperty[]
): Map<string, ListedProperty> {
  return new Map(properties.map((p) => [p.id, p]));
}

/** 매칭 알람용 쌍 — ① own×own, ② own×site / site×own */
export function computeMatchPairKeys(input: {
  customers: Customer[];
  properties: ListedProperty[];
  userId: string;
}): { ownKeys: string[]; siteKeys: string[] } {
  const { ownPool: ownCustomers, sitePool: siteCustomers } =
    splitCustomersForMatching(input.customers, input.userId);
  const { ownPool: ownProperties, sitePool: siteProperties } =
    splitPropertiesForMatching(input.properties, input.userId);

  const ownKeys = new Set<string>();
  const siteKeys = new Set<string>();

  for (const c of ownCustomers) {
    if (c.contractCompleted) continue;
    const { own } = findMatchingPropertiesGrouped(c, ownProperties);
    for (const p of own) {
      if (p.contractCompleted) continue;
      ownKeys.add(matchPairKey(c.id, p.id));
    }
  }

  for (const c of ownCustomers) {
    if (c.contractCompleted) continue;
    const { partner } = findMatchingPropertiesGrouped(c, [], siteProperties);
    for (const p of partner) {
      if (p.contractCompleted) continue;
      siteKeys.add(matchPairKey(c.id, p.id));
    }
  }

  for (const c of siteCustomers) {
    if (c.contractCompleted) continue;
    const { own } = findMatchingPropertiesGrouped(c, ownProperties);
    for (const p of own) {
      if (p.contractCompleted) continue;
      siteKeys.add(matchPairKey(c.id, p.id));
    }
  }

  return {
    ownKeys: [...ownKeys],
    siteKeys: [...siteKeys],
  };
}
