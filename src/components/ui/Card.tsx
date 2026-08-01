"use client";

import { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  pressable?: boolean;
}

export function Card({
  pressable,
  className = "",
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={[
        "rounded-2xl bg-white p-4 shadow-sm border border-gray-100",
        pressable
          ? "active:scale-95 transition-all duration-150 cursor-pointer hover:border-blue-100"
          : "",
        className,
      ].join(" ")}
      {...props}
    >
      {children}
    </div>
  );
}
