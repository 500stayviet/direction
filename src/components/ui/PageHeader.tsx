"use client";

import Link from "next/link";
import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  backHref?: string;
  /** backHref 대신 클릭 시 동작 (수정 모드 취소 등) */
  onBack?: () => void;
  right?: ReactNode;
  /** 제목을 뒤로가기 오른쪽(좌측 정렬). 기본은 가운데 */
  titleAlign?: "center" | "left";
  /** 제목 옆 보조 표시(팀공유 상태 등) */
  titleExtra?: ReactNode;
}

export function PageHeader({
  title,
  subtitle,
  backHref,
  onBack,
  right,
  titleAlign = "center",
  titleExtra,
}: PageHeaderProps) {
  const backClass =
    "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-lg text-gray-700 shadow-sm active:scale-95 transition-all duration-150";
  const leftTitle = titleAlign === "left";

  return (
    <header className="sticky top-0 z-20 -mx-4 mb-3 border-b border-gray-100 bg-[#F9FAFB]/95 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-[#F9FAFB]/85">
      <div
        className="flex items-center gap-2"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className={backClass}
            aria-label="뒤로"
          >
            ←
          </button>
        ) : backHref ? (
          <Link href={backHref} className={backClass} aria-label="뒤로">
            ←
          </Link>
        ) : (
          <div className="w-11 shrink-0" />
        )}
        <div
          className={[
            "min-w-0 flex-1",
            leftTitle ? "text-left" : "text-center",
          ].join(" ")}
        >
          <div
            className={[
              "flex min-w-0 items-center gap-1.5",
              leftTitle ? "justify-start" : "justify-center",
            ].join(" ")}
          >
            <h1 className="truncate text-[17px] font-bold text-gray-900">
              {title}
            </h1>
            {titleExtra}
          </div>
          {subtitle && (
            <p className="truncate text-[12px] text-gray-500">{subtitle}</p>
          )}
        </div>
        <div className="flex min-w-11 shrink-0 justify-end">{right}</div>
      </div>
    </header>
  );
}
