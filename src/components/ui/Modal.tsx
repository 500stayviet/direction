"use client";

import { useEffect } from "react";

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
        "fixed inset-0 z-50 flex justify-center px-4",
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
          "relative w-full max-w-[430px] bg-white shadow-xl animate-in",
          dense ? "p-4" : "p-5",
          centered ? "rounded-3xl" : "rounded-t-3xl",
          className,
        ].join(" ")}
        style={
          centered
            ? undefined
            : { paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }
        }
      >
        {!centered && (
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-gray-200" />
        )}
        {title ? (
          <h2
            className={[
              "font-bold text-gray-900",
              dense ? "text-lg leading-snug" : "text-xl",
            ].join(" ")}
          >
            {title}
          </h2>
        ) : null}
        {description && (
          <p className="mt-1 text-sm text-gray-500">{description}</p>
        )}
        <div className={title || description ? (dense ? "mt-3" : "mt-5") : ""}>
          {children}
        </div>
      </div>
    </div>
  );
}
