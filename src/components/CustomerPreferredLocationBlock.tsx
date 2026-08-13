"use client";

import type { Customer } from "@/lib/types";
import { preferredLocationRows } from "@/lib/preferredLocation";

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
          className="text-[15px] font-extrabold leading-snug tracking-tight text-gray-900"
        >
          <span>{row.gu}</span>
          {row.dongsLabel ? (
            <span>{`  ·  ${row.dongsLabel}`}</span>
          ) : null}
        </p>
      ))}
    </div>
  );
}
