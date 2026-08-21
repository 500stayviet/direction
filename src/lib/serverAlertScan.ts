import {
  buildMatchAlertSideMaps,
  computeMatchPairKeys,
  indexCustomers,
  indexProperties,
} from "@/lib/matchPools";
import type { MatchEntityKind } from "@/lib/matchPools";
import type { Customer, ListedProperty } from "@/lib/types";

export function computeWorkspaceMatchPairs(
  customers: Customer[],
  properties: ListedProperty[],
  userId: string
): {
  own: string[];
  partner: string[];
  ownSides: Map<string, MatchEntityKind>;
  siteSides: Map<string, MatchEntityKind>;
} {
  const { ownKeys, siteKeys } = computeMatchPairKeys({
    customers,
    properties,
    userId,
  });
  const sideMaps = buildMatchAlertSideMaps({
    userId,
    ownKeys,
    siteKeys,
    customersById: indexCustomers(customers),
    propertiesById: indexProperties(properties),
  });
  return {
    own: ownKeys,
    partner: siteKeys,
    ownSides: sideMaps.ownSides,
    siteSides: sideMaps.siteSides,
  };
}

export type PushCandidate = {
  pairKey: string;
  kind: "match" | "newMatch";
  customerId: string;
  propertyId: string;
  side: MatchEntityKind;
};

export function pairKeysToCandidates(input: {
  own: string[];
  partner: string[];
  ownSides: Map<string, MatchEntityKind>;
  siteSides: Map<string, MatchEntityKind>;
}): PushCandidate[] {
  const out: PushCandidate[] = [];
  for (const pairKey of input.own) {
    const side = input.ownSides.get(pairKey);
    if (!side) continue;
    const i = pairKey.indexOf("::");
    if (i <= 0) continue;
    out.push({
      pairKey,
      kind: "match",
      customerId: pairKey.slice(0, i),
      propertyId: pairKey.slice(i + 2),
      side,
    });
  }
  for (const pairKey of input.partner) {
    const side = input.siteSides.get(pairKey);
    if (!side) continue;
    const i = pairKey.indexOf("::");
    if (i <= 0) continue;
    out.push({
      pairKey,
      kind: "newMatch",
      customerId: pairKey.slice(0, i),
      propertyId: pairKey.slice(i + 2),
      side,
    });
  }
  return out;
}
