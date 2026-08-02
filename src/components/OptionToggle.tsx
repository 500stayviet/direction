"use client";

interface OptionToggleProps<T extends string> {
  label: string;
  required?: boolean;
  value: T;
  options: readonly T[] | T[];
  onChange: (value: T) => void;
  columns?: 2 | 3 | 4;
  invalid?: boolean;
}

export function OptionToggle<T extends string>({
  label,
  required,
  value,
  options,
  onChange,
  columns = 3,
  invalid,
}: OptionToggleProps<T>) {
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
      <div
        className={
          columns === 2
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
                "min-h-[44px] rounded-xl text-[15px] font-bold",
                "active:scale-95 transition-all duration-150",
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
