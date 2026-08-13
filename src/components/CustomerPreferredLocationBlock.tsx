"use client";

import type { Customer } from "@/lib/types";
import { parsePreferredDong } from "@/components/PreferredLocationPicker";

export function preferredLocationRows(
  customer: Pick<Customer, "preferredGus" | "preferredDongs">
): { gu: string; dongsLabel: string }[] {
  const raw = customer.preferredDongs;
  const dongs = Array.isArray(raw)
    ? raw.map((x) => String(x ?? "").trim()).filter(Boolean)
    : typeof raw === "string" && raw.trim()
      ? [raw.trim()]
      : [];
  if (dongs.length === 0) return [];

  const byGu: Record<string, string[]> = {};
  for (const item of dongs) {
    const parsed = parsePreferredDong(item);
    if (!parsed) continue;
    if (!byGu[parsed.gu]) byGu[parsed.gu] = [];
    if (!byGu[parsed.gu].includes(parsed.dong)) {
      byGu[parsed.gu].push(parsed.dong);
    }
  }

  const gusFromData = Object.keys(byGu);
  if (gusFromData.length === 0) return [];

  const preferredGus = Array.isArray(customer.preferredGus)
    ? customer.preferredGus
    : [];
  const gus =
    preferredGus.length > 0
      ? preferredGus.filter((gu) => byGu[gu]?.length)
      : gusFromData.sort();

  // preferredGus 필터로 전부 빠지면 동 기준으로라도 표시
  const finalGus = gus.length > 0 ? gus : gusFromData.sort();

  return finalGus.map((gu) => ({
    gu,
    dongsLabel: (byGu[gu] ?? []).join(", "),
  }));
}

export function formatPreferredLocationLabel(
  customer: Pick<Customer, "preferredGus" | "preferredDongs">
): string {
  return preferredLocationRows(customer)
    .map((row) =>
      row.dongsLabel ? `${row.gu} ${row.dongsLabel}` : row.gu
    )
    .join(" · ");
}

/** 고객 상세·네비 카드용 — 금액/입주 메타와 같은 톤 */
export function CustomerPreferredLocationBlock({
  customer,
}: {
  customer: Pick<Customer, "preferredGus" | "preferredDongs">;
}) {
  const rows = preferredLocationRows(customer);
  if (rows.length === 0) return null;

  return (
    <div className="min-w-0 space-y-1">
      <p className="text-[11px] font-bold leading-none text-gray-400">
        선호위치
      </p>
      {rows.map((row) => (
        <p
          key={row.gu}
          className="text-[14px] font-extrabold leading-snug tracking-tight text-gray-900"
        >
          <span>{row.gu}</span>
          {row.dongsLabel ? (
            <span className="font-bold text-gray-800">{` · ${row.dongsLabel}`}</span>
          ) : null}
        </p>
      ))}
    </div>
  );
}
