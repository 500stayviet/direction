"use client";

import { useHasTeam } from "@/hooks/useHasTeam";

export function TeamShareFormField({
  value,
  onChange,
  hasTeam: hasTeamProp,
}: {
  value: boolean | undefined;
  onChange: (next: boolean) => void;
  compact?: boolean;
  required?: boolean;
  invalid?: boolean;
  hasTeam?: boolean;
}) {
  const detected = useHasTeam(hasTeamProp === undefined);
  const hasTeam = hasTeamProp ?? detected;
  if (!hasTeam) return null;

  const shared = value === true;

  return (
    <button
      type="button"
      onClick={() => onChange(!shared)}
      className={[
        "flex min-h-[44px] w-full items-center justify-center rounded-xl text-[15px] font-bold transition-all duration-150 active:scale-95",
        shared
          ? "bg-emerald-500 text-white shadow-sm"
          : "bg-gray-100 text-gray-700",
      ].join(" ")}
    >
      {shared ? "팀 공유 중" : "팀 공유하기"}
    </button>
  );
}
