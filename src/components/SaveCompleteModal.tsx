"use client";

import { useEffect } from "react";

export function SaveCompleteModal({
  open,
  onClose,
  message = "변경사항이 저장되었습니다",
}: {
  open: boolean;
  onClose: () => void;
  message?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(onClose, 1600);
    return () => window.clearTimeout(t);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-10">
      <button
        type="button"
        aria-label="닫기"
        className="absolute inset-0 bg-black/25"
        onClick={onClose}
      />
      <div className="relative w-full max-w-[240px] rounded-[22px] bg-white px-5 py-6 text-center shadow-[0_12px_40px_rgba(15,23,42,0.16)] animate-in">
        <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[#E8F3FF]">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="h-5 w-5 text-[#3182F6]"
            aria-hidden
          >
            <path
              d="M5.5 12.5 10 17l8.5-9"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <p className="mt-3 text-[14px] font-semibold leading-snug tracking-tight text-gray-800">
          {message}
        </p>
      </div>
    </div>
  );
}
