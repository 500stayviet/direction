import type { Customer, ListedProperty } from "@/lib/types";
import { parsePreferredDong } from "@/lib/preferredLocation";
import { findDongInText, parseSeoulAddress } from "@/lib/seoulRegions";

export interface MatchAgencyContact {
  shopName: string;
  dong: string;
  phone: string;
}

const DEFAULT_SHOP = "부동산";

function normalizeShopName(raw?: string | null): string {
  const shop = raw?.trim() || "";
  if (!shop || shop === "현장동선") return DEFAULT_SHOP;
  return shop;
}

function firstPreferredDong(customer: Customer): string {
  const dongs = customer.preferredDongs;
  if (!Array.isArray(dongs)) return "";
  for (const raw of dongs) {
    const parsed = parsePreferredDong(String(raw ?? ""));
    if (parsed?.dong?.trim()) return parsed.dong.trim();
  }
  return "";
}

function dongFromProperty(property: ListedProperty): string {
  return parseSeoulAddress(property.address ?? "").dong?.trim() || "";
}

function resolveDong(
  entity: Customer | ListedProperty,
  shopName: string
): string {
  const snap = entity.createdByDong?.trim();
  if (snap) return snap;
  if ("preferredDongs" in entity) {
    const preferred = firstPreferredDong(entity);
    if (preferred) return preferred;
  }
  if ("address" in entity) {
    const fromAddress = dongFromProperty(entity);
    if (fromAddress) return fromAddress;
  }
  return findDongInText(shopName)?.dong?.trim() || "";
}

/** 사이트내 공유 매칭 — 등록 부동산 연락처 (상호·동·전화) */
export function resolveMatchAgencyContact(
  entity: Customer | ListedProperty
): MatchAgencyContact {
  const shopName = normalizeShopName(
    entity.createdByShopName?.trim() || entity.createdByName
  );
  const phone = entity.createdByPhone?.trim() || "";
  const dong = resolveDong(entity, shopName);
  return { shopName, dong, phone };
}
