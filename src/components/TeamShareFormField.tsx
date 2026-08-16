"use client";

import { OptionToggle } from "@/components/OptionToggle";
import { useHasTeam } from "@/hooks/useHasTeam";

export function TeamShareFormField({
  value,
  onChange,
  required,
  invalid,
  compact,
  hasTeam: hasTeamProp,
}: {
  value: boolean | undefined;
  onChange: (next: boolean) => void;
  required?: boolean;
  invalid?: boolean;
  compact?: boolean;
  hasTeam?: boolean;
}) {
  const detected = useHasTeam(hasTeamProp === undefined);
  const hasTeam = hasTeamProp ?? detected;
  const selected =
    value === true ? "유" : value === false || !hasTeam ? "무" : undefined;

  return (
    <OptionToggle
      label="팀공유 유무"
      hint={
        hasTeam
          ? "팀에 공유가 필요할 때 사용하세요"
          : "팀이 있으면 공유 유무를 선택할 수 있습니다"
      }
      required={hasTeam && required}
      compact={compact}
      invalid={hasTeam && invalid}
      disabled={!hasTeam}
      columns={2}
      value={selected}
      options={["유", "무"] as const}
      onChange={(v) => {
        if (!hasTeam) return;
        onChange(v === "유");
      }}
    />
  );
}
