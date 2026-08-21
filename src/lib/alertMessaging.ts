import {
  formatOwnMatchBadgeLabel,
  formatSiteMatchBadgeLabel,
} from "@/lib/alertLabels";
import type { Customer, ListedProperty } from "@/lib/types";

export type MatchAlertKind = "match" | "newMatch";

export function matchPairKey(customerId: string, propertyId: string): string {
  return `${customerId}::${propertyId}`;
}

export function parseMatchPairKey(
  key: string
): { customerId: string; propertyId: string } | null {
  const i = key.indexOf("::");
  if (i <= 0) return null;
  const customerId = key.slice(0, i);
  const propertyId = key.slice(i + 2);
  if (!customerId || !propertyId) return null;
  return { customerId, propertyId };
}

export function formatMatchAlertTitle(
  kind: MatchAlertKind,
  count = 1
): string {
  const label =
    kind === "newMatch"
      ? formatSiteMatchBadgeLabel(count)
      : formatOwnMatchBadgeLabel(count);
  return `현장동선 · ${label}`;
}

export function formatMatchAlertBody(
  customer: Customer,
  property: ListedProperty
): string {
  const cName = customer.name?.trim() || "고객";
  const addr = property.address?.trim() || "";
  const pLabel = addr || property.roomType?.trim() || "매물";
  return `${cName} · ${pLabel}`;
}

export function deepLinkForMatchPair(
  customerId: string,
  propertyId: string,
  prefer: "customer" | "property" = "customer"
): string {
  if (prefer === "property") {
    return `/properties/${propertyId}?scrollMatch=1`;
  }
  return `/customers/${customerId}?scrollMatch=1`;
}

export function propertyBriefLine(property: ListedProperty): string {
  return property.address?.trim() || "";
}
