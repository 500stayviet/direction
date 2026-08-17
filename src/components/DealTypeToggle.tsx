"use client";

import type { DealType } from "@/lib/types";
import { DEAL_TYPES } from "@/lib/constants";
import { reselectHint, reselectHintClass } from "@/lib/choiceHint";
import {
  invalidHintClass,
  invalidLabelClass,
  requiredStarClass,
  spaceClass,
} from "@/lib/uiInvalid";

interface DealTypeToggleProps {
  label?: string;
  required?: boolean;
  value?: DealType | "";
  onChange: (value: DealType | "") => void;
  invalid?: boolean;
  /** 표시할 거래 유형. 기본 매매·전세·월세 */
  /** 라벨 옆 예) 안내 */
  hint?: string;
  types?: readonly DealType[];
  filled?: boolean;
}

export function DealTypeToggle({
  label = "거래종류",
  required,
  value,
  onChange,
  invalid,
  types = DEAL_TYPES,
  filled,
  hint,
}: DealTypeToggleProps) {
  const allowed: DealType[] = types.filter((type) =>
    DEAL_TYPES.includes(type)
  );
  const selected: DealType | "" =
    value && allowed.includes(value) ? value : "";
  const canToggleOff = allowed.length > 1;
  const collapsed = Boolean(selected) && canToggleOff;
  const shown: DealType[] =
    collapsed && selected ? [selected] : allowed;

  return (
    <div
      className={["space-y-1 rounded-xl", spaceClass({ invalid, filled })].join(
        " "
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <p
          className={[
            "shrink-0 text-[13px] font-semibold",
            invalid ? invalidLabelClass : "text-gray-600",
          ].join(" ")}
        >
          {label}
          {required && (
            <span className={requiredStarClass}>
              *
            </span>
          )}
        </p>
          {hint && !collapsed ? (
          <p className="min-w-0 text-right text-[11px] font-medium leading-snug text-gray-400">
            {hint}
          </p>
        ) : collapsed ? (
          <p className={reselectHintClass}>{reselectHint(label, selected)}</p>
        ) : null}
      </div>
      {invalid && <p className={`text-xs ${invalidHintClass}`}>미입력</p>}
      <div
        className={
          collapsed || shown.length === 1
            ? "flex"
            : "grid grid-cols-3 gap-1.5"
        }
      >
        {shown.map((type: DealType) => {
          const active = selected === type;
          return (
            <button
              key={type}
              type="button"
              onClick={() => {
                if (active && canToggleOff) onChange("");
                else onChange(type);
              }}
              className={[
                "relative z-[1] flex min-h-[36px] items-center justify-center rounded-xl text-[15px] font-bold",
                "pointer-events-auto active:scale-95 transition-all duration-150",
                collapsed || shown.length === 1 ? "w-full" : "",
                active
                  ? "bg-[#3182F6] text-white shadow-sm"
                  : "bg-gray-100 text-gray-600",
              ].join(" ")}
            >
              {type}
            </button>
          );
        })}
      </div>
    </div>
  );
}
