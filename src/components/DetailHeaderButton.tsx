"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

export type DetailHeaderTone =
  | "team"
  | "teamOn"
  | "share"
  | "edit"
  | "cancel"
  | "delete";

const toneClass: Record<DetailHeaderTone, string> = {
  team: "border-gray-400 text-gray-600 hover:bg-gray-50",
  teamOn: "border-violet-500 text-violet-600 hover:bg-violet-50",
  share: "border-sky-400 text-sky-600 hover:bg-sky-50",
  edit: "border-emerald-500 text-emerald-600 hover:bg-emerald-50",
  cancel: "border-gray-300 text-gray-600 hover:bg-gray-50",
  delete: "border-red-500 text-red-600 hover:bg-red-50",
};

const baseClass =
  "inline-flex shrink-0 items-center justify-center min-h-[36px] rounded-xl border-2 bg-white px-2.5 text-[13px] font-bold transition-colors active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60";

/** 상세 헤더 액션 — 동일 아웃라인, 색만 구분 */
export function DetailHeaderButton({
  tone,
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  tone: DetailHeaderTone;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={[baseClass, toneClass[tone], className].join(" ")}
      {...props}
    >
      {children}
    </button>
  );
}
