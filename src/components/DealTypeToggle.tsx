"use client";

import type { DealType } from "@/lib/types";
import { DEAL_TYPES } from "@/lib/constants";

interface DealTypeToggleProps {
  label?: string;
  required?: boolean;
  value: DealType;
  onChange: (value: DealType) => void;
  invalid?: boolean;
}

export function DealTypeToggle({
  label = "희망 거래 유형",
  required,
  value,
  onChange,
  invalid,
}: DealTypeToggleProps) {
  return (
    <div
      className={[
        "space-y-1 rounded-xl",
        invalid ? "border border-red-500 bg-red-50 p-2" : "",
      ].join(" ")}
    >
      <p
        className={[
          "text-[13px] font-semibold",
          invalid ? "text-red-600" : "text-gray-600",
        ].join(" ")}
      >
        {label}
        {required && (
          <span className={invalid ? "ml-0.5 text-red-500" : "ml-0.5 text-[#3182F6]"}>
            *
          </span>
        )}
      </p>
      {invalid && (
        <p className="text-xs font-semibold text-red-500">미입력</p>
      )}
      <div className="grid grid-cols-3 gap-1.5">
        {DEAL_TYPES.map((type) => {
          const active = value === type;
          return (
            <button
              key={type}
              type="button"
              onClick={() => onChange(type)}
              className={[
                "min-h-[44px] rounded-xl text-[15px] font-bold",
                "active:scale-95 transition-all duration-150",
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
