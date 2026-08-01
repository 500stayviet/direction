"use client";

import { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  fullWidth?: boolean;
  size?: "md" | "lg";
}

const variants: Record<Variant, string> = {
  primary: "bg-[#3182F6] text-white shadow-sm hover:bg-[#1b6ef3]",
  secondary: "bg-gray-100 text-gray-900 hover:bg-gray-200",
  ghost: "bg-transparent text-gray-700 hover:bg-gray-100",
  danger: "bg-red-50 text-red-600 hover:bg-red-100",
  outline: "bg-white text-gray-900 border border-gray-200 hover:bg-gray-50",
};

export function Button({
  variant = "primary",
  fullWidth,
  size = "md",
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={[
        "inline-flex items-center justify-center gap-2 rounded-2xl font-semibold",
        "active:scale-95 transition-all duration-150 disabled:opacity-50 disabled:active:scale-100",
        size === "lg"
          ? "min-h-[56px] px-5 py-4 text-[17px]"
          : "min-h-[48px] px-4 py-3 text-[15px]",
        fullWidth ? "w-full" : "",
        variants[variant],
        className,
      ].join(" ")}
      {...props}
    >
      {children}
    </button>
  );
}
