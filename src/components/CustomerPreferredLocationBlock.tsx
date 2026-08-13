"use client";

import type { Customer } from "@/lib/types";
import { parsePreferredDong } from "@/components/PreferredLocationPicker";

export function preferredLocationRows(
  customer: Pick<Customer, "preferredGus" | "preferredDongs">
): { gu: string; dongsLabel: string }[] {
  const dongs = customer.preferredDongs ?? [];
  if (dongs.length === 0) return [];

  const byGu: Record<string, string[]> = {};
  for (const raw of dongs) {
    const parsed = parsePreferredDong(raw);
    if (!parsed) continue;
    if (!byGu[parsed.gu]) byGu[parsed.gu] = [];
    if (!byGu[parsed.gu].includes(parsed.dong)) {
      byGu[parsed.gu].push(parsed.dong);
    }
  }

  const gus =
    (customer.preferredGus?.length ?? 0) > 0
      ? (customer.preferredGus as string[]).filter((gu) => byGu[gu]?.length)
      : Object.keys(byGu).sort();

  return gus.map((gu) => ({
    gu,
    dongsLabel: (byGu[gu] ?? []).join(", "),
  }));
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
