"use client";

import {
  invalidHintClass,
  invalidLabelClass,
  invalidStarClass,
  spaceClass,
} from "@/lib/uiInvalid";

interface OptionToggleProps<T extends string> {
  label: string;
  /** 라벨 옆 짧은 안내 */
  hint?: string;
  required?: boolean;
  value?: T;
  options: readonly T[] | T[];
  onChange: (value: T) => void;
  columns?: 1 | 2 | 3 | 4;
  /** 한 행에 두고 글자 길이에 맞게 칸 폭·글자 크기 조절 */
  fit?: boolean;
  invalid?: boolean;
  /** 고른 칸은 그대로, 나머지는 아주 흐리게. 흐린 칸을 눌러도 바로 수정 */
  compact?: boolean;
  /** 반영되어 값이 있는 구역 */
  filled?: boolean;
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
  fit = false,
  invalid,
  compact = false,
  filled,
  disabled = false,
}: OptionToggleProps<T>) {
  const dimOthers = compact && Boolean(value);

  return (
    <div
      className={["space-y-1 rounded-xl", spaceClass({ invalid, filled })].join(
        " "
      )}
    >
      <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
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
        {hint ? (
          <p className="text-[11px] font-medium leading-snug text-gray-400">
            {hint}
          </p>
        ) : null}
      </div>
      {invalid && <p className={`text-xs ${invalidHintClass}`}>미입력</p>}
      <div
        className={
          fit
            ? "flex gap-1.5"
            : columns === 1
              ? "grid grid-cols-1 gap-1.5"
              : columns === 2
                ? "grid grid-cols-2 gap-1.5"
                : columns === 4
                  ? "grid grid-cols-4 gap-1.5"
                  : "grid grid-cols-3 gap-1.5"
        }
      >
        {options.map((option) => {
          const active = value != null && value === option;
          const faint = dimOthers && !active;
          return (
            <button
              key={option}
              type="button"
              disabled={disabled}
              onClick={() => {
                if (disabled) return;
                onChange(option);
              }}
              className={[
                "relative z-[1] min-h-[36px] rounded-xl font-bold pointer-events-auto transition-all duration-150",
                disabled
                  ? "cursor-not-allowed opacity-50"
                  : "active:scale-95",
                faint ? "opacity-[0.22]" : "",
                fit
                  ? "min-w-0 flex-1 px-1.5 text-[12px] leading-snug tracking-tight"
                  : "text-[15px]",
                active
                  ? "bg-[#3182F6] text-white shadow-sm"
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
