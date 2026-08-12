"use client";

interface OptionToggleProps<T extends string> {
  label: string;
  /** 라벨 옆 짧은 안내 */
  hint?: string;
  required?: boolean;
  value: T;
  options: readonly T[] | T[];
  onChange: (value: T) => void;
  columns?: 1 | 2 | 3 | 4;
  /** 한 행에 두고 글자 길이에 맞게 칸 폭·글자 크기 조절 */
  fit?: boolean;
  invalid?: boolean;
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
}: OptionToggleProps<T>) {
  return (
    <div
      className={[
        "space-y-1 rounded-xl",
        invalid ? "border border-red-500 bg-red-50 p-2" : "",
      ].join(" ")}
    >
      <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
        <p
          className={[
            "text-[13px] font-semibold",
            invalid ? "text-red-600" : "text-gray-600",
          ].join(" ")}
        >
          {label}
          {required && (
            <span
              className={
                invalid ? "ml-0.5 text-red-500" : "ml-0.5 text-[#3182F6]"
              }
            >
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
      {invalid && (
        <p className="text-xs font-semibold text-red-500">미입력</p>
      )}
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
          const active = value === option;
          return (
            <button
              key={option}
              type="button"
              onClick={() => onChange(option)}
              className={[
                "min-h-[44px] rounded-xl font-bold active:scale-95 transition-all duration-150",
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
