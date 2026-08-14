"use client";

import type { DealType } from "@/lib/types";
import { DEAL_TYPES } from "@/lib/constants";
import {
  invalidHintClass,
  invalidLabelClass,
  invalidStarClass,
  spaceClass,
} from "@/lib/uiInvalid";

interface DealTypeToggleProps {
  label?: string;
  required?: boolean;
  value?: DealType | "";
  onChange: (value: DealType) => void;
  invalid?: boolean;
  /** 표시할 거래 유형. 기본 매매·전세·월세 */
  types?: readonly DealType[];
  compact?: boolean;
}

export function DealTypeToggle({
  label = "거래종류",
  required,
  value,
  onChange,
  invalid,
  types = DEAL_TYPES,
  compact = false,
}: DealTypeToggleProps) {
  const allowed = new Set(types);
  const dimOthers = compact && Boolean(value);

  return (
    <div
      className={["space-y-1 rounded-xl", spaceClass({ invalid })].join(
        " "
      )}
    >
      <p
        className={[
          "text-[13px] font-semibold",
          invalid ? invalidLabelClass : "text-gray-600",
        ].join(" ")}
      >
        {label}
        {required && (
          <span className={invalid ? invalidStarClass : "ml-0.5 text-[#3182F6]"}>
            *
          </span>
        )}
      </p>
      {invalid && <p className={`text-xs ${invalidHintClass}`}>미입력</p>}
      <div className="grid grid-cols-3 gap-1.5">
        {DEAL_TYPES.filter((type) => allowed.has(type)).map((type) => {
          const active = value === type;
          const faint = dimOthers && !active;
          return (
            <button
              key={type}
              type="button"
              onClick={() => onChange(type)}
              className={[
                "relative z-[1] min-h-[36px] rounded-xl text-[15px] font-bold pointer-events-auto active:scale-95 transition-all duration-150",
                faint ? "opacity-[0.22]" : "",
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
