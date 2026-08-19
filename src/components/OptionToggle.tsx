"use client";

import { reselectHint, reselectHintClass } from "@/lib/choiceHint";
import {
  invalidControlClass,
  invalidHintClass,
  invalidLabelClass,
  requiredStarClass,
} from "@/lib/uiInvalid";

interface OptionToggleProps<T extends string> {
  label: string;
  /** 라벨 옆 짧은 안내 */
  hint?: string;
  required?: boolean;
  value?: T | "";
  options: readonly T[] | T[];
  onChange: (value: T | "") => void;
  columns?: 1 | 2 | 3 | 4;
  invalid?: boolean;
  disabled?: boolean;
}

export function OptionToggle<T extends string>({
  label,
  hint,
  required,
  value,
  options,
  onChange,
  columns = 3,
  invalid,
  disabled = false,
}: OptionToggleProps<T>) {
  const selected = (value || "") as T | "";
  const canToggleOff = options.length > 1;
  const collapsed = Boolean(selected) && canToggleOff;
  const shown: T[] =
    collapsed && selected ? [selected] : [...options];

  const gridClass =
    collapsed || shown.length === 1
      ? "flex"
      : columns === 1
        ? "grid grid-cols-1 gap-1.5"
        : columns === 2
          ? "grid grid-cols-2 gap-1.5"
          : columns === 4
            ? "grid grid-cols-4 gap-1.5"
            : "grid grid-cols-3 gap-1.5";

  return (
    <div className="space-y-1" data-testid={`option-${label.replace(/\s+/g, "")}`}>
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
        {collapsed && selected ? (
          <p className={reselectHintClass}>{reselectHint(label, selected)}</p>
        ) : hint ? (
          <p className="text-[11px] font-medium leading-snug text-gray-400">
            {hint}
          </p>
        ) : null}
      </div>
      {invalid && <p className={`text-xs ${invalidHintClass}`}>미입력</p>}
      <div className={gridClass}>
        {shown.map((option) => {
          const active = selected === option;
          return (
            <button
              key={option}
              type="button"
              disabled={disabled}
              onClick={() => {
                if (disabled) return;
                if (active && canToggleOff) onChange("");
                else onChange(option);
              }}
              className={[
                "relative z-[1] flex min-h-[36px] items-center justify-center rounded-xl text-[15px] font-bold",
                "pointer-events-auto transition-all duration-150",
                disabled
                  ? "cursor-not-allowed opacity-50"
                  : "active:scale-95",
                collapsed || shown.length === 1 ? "w-full" : "",
                active
                  ? "bg-[#3182F6] text-white shadow-sm"
                  : invalid
                    ? invalidControlClass
                    : "bg-gray-100 text-gray-600",
              ].join(" ")}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}
