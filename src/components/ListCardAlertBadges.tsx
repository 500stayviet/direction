"use client";

import type { ListCardBadge, ListCardBadgeKind } from "@/lib/teamAlerts";

const BADGE_CLASS: Record<ListCardBadgeKind, string> = {
  share:
    "border-emerald-500 bg-emerald-50 text-emerald-800",
  match: "border-[#3182F6] bg-[#E8F3FF] text-[#1B64DA]",
  newMatch: "border-yellow-500 bg-yellow-50 text-yellow-900",
  deadline: "border-amber-400 bg-amber-50 text-amber-700",
};

export function ListCardAlertBadges({
  badges,
  className = "",
  floating = true,
}: {
  badges: ListCardBadge[];
  className?: string;
  floating?: boolean;
}) {
  if (badges.length === 0) return null;

  return (
    <div
      className={[
        "flex max-w-full flex-wrap items-center gap-1",
        floating
          ? "absolute left-3 top-2 z-10 max-w-[calc(100%-1.5rem)] -translate-y-1/2"
          : "",
        className,
      ].join(" ")}
    >
      {badges.map((badge) => (
        <span
          key={`${badge.kind}-${badge.label}`}
          className={[
            "shrink-0 rounded-md border px-1.5 py-0.5 text-[11px] font-extrabold leading-none shadow-sm ring-2 ring-[#F9FAFB]",
            BADGE_CLASS[badge.kind],
          ].join(" ")}
        >
          {badge.label}
        </span>
      ))}
    </div>
  );
}
