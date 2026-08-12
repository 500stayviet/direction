"use client";

import Link from "next/link";
import type { ReactNode } from "react";

export type PageHeaderTitleTone = "customer" | "property" | "schedule";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  backHref?: string;
  /** backHref 대신 클릭 시 동작 (수정 모드 취소 등) */
  onBack?: () => void;
  right?: ReactNode;
  /** 제목을 뒤로가기 오른쪽(좌측 정렬). 기본은 가운데 */
  titleAlign?: "center" | "left";
  /** 제목 옆 보조 표시 */
  titleExtra?: ReactNode;
  /**
   * inline: 뒤로·제목·버튼을 한 줄 (기본, 전체 sticky)
   * below: 탑바만 고정 따라다님, 제목은 본문과 함께 스크롤 + 하단 구분선
   */
  titlePlacement?: "inline" | "below";
  /** 상세 페이지 구분 — 제목 글자색만 */
  titleTone?: PageHeaderTitleTone;
}

const titleToneText: Record<PageHeaderTitleTone, string> = {
  customer: "text-[#3182F6]",
  property: "text-violet-600",
  schedule: "text-orange-600",
};

export function PageHeader({
  title,
  subtitle,
  backHref,
  onBack,
  right,
  titleAlign = "center",
  titleExtra,
  titlePlacement = "inline",
  titleTone,
}: PageHeaderProps) {
  const backClass =
    "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-lg text-gray-700 shadow-sm active:scale-95 transition-all duration-150";
  const leftTitle = titleAlign === "left";
  const titleBelow = titlePlacement === "below";

  const backControl = onBack ? (
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
  );

  const titleBlock = (
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
        <h1
          className={[
            "truncate text-[17px] font-bold",
            titleTone ? titleToneText[titleTone] : "text-gray-900",
          ].join(" ")}
        >
          {title}
        </h1>
        {titleExtra}
      </div>
      {subtitle && (
        <p className="truncate text-[12px] text-gray-500">{subtitle}</p>
      )}
    </div>
  );

  const actions = titleBelow ? (
    <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-1.5">
      {right}
    </div>
  ) : (
    <>
      {titleBlock}
      <div className="flex min-w-11 shrink-0 justify-end gap-1.5">{right}</div>
    </>
  );

  if (titleBelow) {
    return (
      <>
        {/* 하단 탭바와 같이 fixed — 스크롤해도 탑바 버튼 유지 */}
        <div className="pointer-events-none fixed inset-x-0 top-0 z-[35] flex justify-center">
          <div
            className="pointer-events-auto w-full max-w-[430px] border-b border-gray-200 bg-[#F9FAFB]/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-[#F9FAFB]/85"
            style={{ paddingTop: "env(safe-area-inset-top)" }}
          >
            <div className="flex items-center gap-2 py-2">
              {backControl}
              {actions}
            </div>
          </div>
        </div>
        {/* fixed 탑바 높이만큼 본문 여백 (AppShell 상단 safe-area 패딩 상쇄) */}
        <div
          className="-mx-4 shrink-0"
          style={{
            marginTop: "calc(-1 * max(0.5rem, env(safe-area-inset-top)))",
            height: "calc(env(safe-area-inset-top) + 3.25rem)",
          }}
          aria-hidden
        />
        {/* 명칭은 스크롤과 함께 + 하단 줄 */}
        <div className="-mx-4 mb-3 border-b border-gray-200 px-4 py-2.5">
          {titleBlock}
        </div>
      </>
    );
  }

  return (
    <header className="sticky top-0 z-20 -mx-4 mb-3 bg-[#F9FAFB]/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-[#F9FAFB]/85">
      <div
        className="flex items-center gap-2 border-b border-gray-200 py-2"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        {backControl}
        {actions}
      </div>
    </header>
  );
}
