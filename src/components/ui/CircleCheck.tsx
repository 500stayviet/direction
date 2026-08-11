"use client";

import type { InputHTMLAttributes } from "react";

type Accent = "blue" | "emerald";

type Props = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "className"
> & {
  accent?: Accent;
  className?: string;
};

const checkedBox: Record<Accent, string> = {
  blue: "border-[#3182F6] bg-[#3182F6]",
  emerald: "border-emerald-600 bg-emerald-600",
};

/** 앱 공통 — 동그라미(원형) 체크박스 */
export function CircleCheck({
  accent = "blue",
  className = "",
  checked,
  disabled,
  ...props
}: Props) {
  const on = Boolean(checked);

  return (
    <span
      className={[
        "relative inline-flex h-5 w-5 shrink-0",
        disabled ? "opacity-50" : "",
        className,
      ].join(" ")}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        className="absolute inset-0 z-[1] h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
        {...props}
      />
      <span
        aria-hidden
        className={[
          "pointer-events-none flex h-5 w-5 items-center justify-center rounded-full border-2 transition-all duration-150",
          on ? checkedBox[accent] : "border-gray-300 bg-white",
        ].join(" ")}
      >
        {on ? (
          <span className="h-2 w-2 rounded-full bg-white" />
        ) : null}
      </span>
    </span>
  );
}
