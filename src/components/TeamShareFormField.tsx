"use client";

import { useHasTeam } from "@/hooks/useHasTeam";
import { controlStatusClass } from "@/lib/uiInvalid";

export function TeamShareFormField({
  value,
  onChange,
  hasTeam: hasTeamProp,
}: {
  value: boolean | undefined;
  onChange: (next: boolean) => void;
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
        "flex min-h-[44px] w-full items-center justify-center rounded-xl text-[15px] transition-all duration-150 active:scale-95",
        controlStatusClass({ filled: shared }),
      ].join(" ")}
    >
      {shared ? "팀 공유 중" : "팀 공유하기"}
    </button>
  );
}
