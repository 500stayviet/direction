"use client";

import Link from "next/link";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  backHref?: string;
  right?: React.ReactNode;
}

export function PageHeader({
  title,
  subtitle,
  backHref,
  right,
}: PageHeaderProps) {
  return (
    <header className="sticky top-0 z-20 -mx-4 mb-3 border-b border-gray-100 bg-[#F9FAFB]/95 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-[#F9FAFB]/85">
      <div
        className="flex items-center gap-2"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        {backHref ? (
          <Link
            href={backHref}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-lg text-gray-700 shadow-sm active:scale-95 transition-all duration-150"
            aria-label="뒤로"
          >
            ←
          </Link>
        ) : (
          <div className="w-11 shrink-0" />
        )}
        <div className="min-w-0 flex-1 text-center">
          <h1 className="truncate text-[17px] font-bold text-gray-900">
            {title}
          </h1>
          {subtitle && (
            <p className="truncate text-[12px] text-gray-500">{subtitle}</p>
          )}
        </div>
        <div className="flex min-w-11 shrink-0 justify-end">{right}</div>
      </div>
    </header>
  );
}
