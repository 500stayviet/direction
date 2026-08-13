"use client";

import type { Customer } from "@/lib/types";
import { parsePreferredDong } from "@/components/PreferredLocationPicker";

export function preferredLocationRows(
  customer: Pick<Customer, "preferredGus" | "preferredDongs">
): { gu: string; dongsLabel: string }[] {
  const gus = customer.preferredGus ?? [];
  if (gus.length === 0) return [];
  return gus
    .map((gu) => {
      const dongs = (customer.preferredDongs ?? [])
        .map(parsePreferredDong)
        .filter(
          (p): p is { gu: string; dong: string } => Boolean(p && p.gu === gu)
        )
        .map((p) => p.dong);
      return {
        gu,
        dongsLabel: dongs.length > 0 ? dongs.join(", ") : "",
      };
    })
    .filter((row) => row.dongsLabel.length > 0);
}

/** 고객 상세·네비 카드용 — 기존 메타/메모 톤 */
export function CustomerPreferredLocationBlock({
  customer,
}: {
  customer: Pick<Customer, "preferredGus" | "preferredDongs">;
}) {
  const rows = preferredLocationRows(customer);
  if (rows.length === 0) return null;

  return (
    <div className="min-w-0 space-y-1.5">
      <p className="text-[11px] font-semibold leading-none text-gray-400">
        선호위치
      </p>
      {rows.map((row) => (
        <p
          key={row.gu}
          className="text-[13px] font-medium leading-snug text-gray-800"
        >
          <span className="font-bold text-gray-900">{row.gu}</span>
          {row.dongsLabel ? (
            <span className="text-gray-700">{` · ${row.dongsLabel}`}</span>
          ) : null}
        </p>
      ))}
    </div>
  );
}
