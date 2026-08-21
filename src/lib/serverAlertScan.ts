import { findMatchingPropertiesGrouped } from "@/lib/matchCustomerProperty";
import { matchPairKey } from "@/lib/alertMessaging";
import type { Customer, ListedProperty } from "@/lib/types";

export function computeWorkspaceMatchPairs(
  customers: Customer[],
  properties: ListedProperty[]
): { own: string[]; partner: string[] } {
  const own = new Set<string>();
  const partner = new Set<string>();
  for (const c of customers) {
    if (c.contractCompleted) continue;
    const grouped = findMatchingPropertiesGrouped(c, properties);
    for (const p of grouped.own) {
      if (p.contractCompleted) continue;
      own.add(matchPairKey(c.id, p.id));
    }
    for (const p of grouped.partner) {
      if (p.contractCompleted) continue;
      partner.add(matchPairKey(c.id, p.id));
    }
  }
  return {
    own: [...own],
    partner: [...partner],
  };
}

export type PushCandidate = {
  pairKey: string;
  kind: "match" | "newMatch";
  customerId: string;
  propertyId: string;
};

export function pairKeysToCandidates(
  own: string[],
  partner: string[]
): PushCandidate[] {
  const out: PushCandidate[] = [];
  for (const pairKey of own) {
    const i = pairKey.indexOf("::");
    if (i <= 0) continue;
    out.push({
      pairKey,
      kind: "match",
      customerId: pairKey.slice(0, i),
      propertyId: pairKey.slice(i + 2),
    });
  }
  for (const pairKey of partner) {
    const i = pairKey.indexOf("::");
    if (i <= 0) continue;
    out.push({
      pairKey,
      kind: "newMatch",
      customerId: pairKey.slice(0, i),
      propertyId: pairKey.slice(i + 2),
    });
  }
  return out;
}
