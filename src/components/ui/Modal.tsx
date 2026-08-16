"use client";

import { useEffect, type ReactNode } from "react";

interface ModalProps {
  open: boolean;
  title?: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
  /** bottom: 하단 시트(기본) / center: 화면 중앙 */
  position?: "bottom" | "center";
  /** 여백·타이틀을 조금 더 촘촘하게 */
  dense?: boolean;
  /** 패널 추가 클래스 (너비·패딩 등) */
  className?: string;
  /** 우측 상단 X 닫기 버튼 */
  showClose?: boolean;
  /** 타이틀 행 우측 액션 (작은 버튼 등) */
  headerRight?: React.ReactNode;
  /** 본문과 겹치지 않게 하단에 고정 */
  footer?: ReactNode;
  /** 오버레이 z-index (기본 z-50) */
  overlayClassName?: string;
  /** 패널 전체를 덮는 중앙 오버레이 (분석 중 등) */
  cover?: ReactNode;
  /** 설명 글자 크기 등 */
  descriptionClassName?: string;
}

export function Modal({
  open,
  title,
  description,
  onClose,
  children,
  position = "bottom",
  dense = false,
  className = "",
  showClose = false,
  headerRight,
  footer,
  overlayClassName = "z-50",
  cover,
  descriptionClassName,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  const centered = position === "center";

  return (
    <div
      className={[
        "fixed inset-0 flex justify-center px-4",
        overlayClassName,
        centered ? "items-center" : "items-end",
      ].join(" ")}
    >
      <button
        type="button"
        aria-label="닫기"
        className="absolute inset-0 bg-black/45"
        onClick={onClose}
      />
      <div
        className={[
          "relative flex w-full max-w-[430px] flex-col overflow-x-hidden bg-white shadow-xl animate-in",
          dense ? "px-4 pt-4" : "px-5 pt-5",
          footer ? (dense ? "pb-3" : "pb-4") : dense ? "pb-4" : "pb-5",
          centered ? "rounded-3xl" : "rounded-t-3xl",
          footer || centered ? "max-h-[min(90vh,720px)]" : "",
          className,
        ].join(" ")}
        style={
          centered
            ? undefined
            : {
                paddingBottom: footer
                  ? "calc(0.75rem + env(safe-area-inset-bottom))"
                  : "calc(1.25rem + env(safe-area-inset-bottom))",
              }
        }
      >
        {showClose ? (
          <button
            type="button"
            aria-label="닫기"
            onClick={onClose}
            className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-[18px] font-bold leading-none text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-800"
          >
            ×
          </button>
        ) : null}
        {!centered && (
          <div className="mx-auto mb-3 h-1 w-10 shrink-0 rounded-full bg-gray-200" />
        )}
        {title || headerRight ? (
          <div
            className={[
              "flex shrink-0 items-start gap-2",
              showClose ? "pr-10" : "",
            ].join(" ")}
          >
            {title ? (
              <h2
                className={[
                  "min-w-0 flex-1 font-bold text-gray-900",
                  dense ? "text-lg leading-snug" : "text-xl",
                ].join(" ")}
              >
                {title}
              </h2>
            ) : (
              <div className="flex-1" />
            )}
            {headerRight ? (
              <div className="shrink-0 pt-0.5">{headerRight}</div>
            ) : null}
          </div>
        ) : null}
        {description && (
          <p
            className={[
              "mt-1 shrink-0 text-gray-500",
              descriptionClassName || "text-sm",
            ].join(" ")}
          >
            {description}
          </p>
        )}
        <div
          className={[
            title || description ? (dense ? "mt-3" : "mt-5") : "",
            footer ? "flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto" : "",
          ].join(" ")}
        >
          {children}
        </div>
        {footer ? (
          <div className="shrink-0 border-t border-gray-100 pt-3">
            {footer}
          </div>
        ) : null}
        {cover ? (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-[inherit] bg-white/90">
            {cover}
          </div>
        ) : null}
      </div>
    </div>
  );
}
