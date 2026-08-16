"use client";

import { IntakeAiGlobe } from "@/components/IntakeAiGlobe";

export function IntakeAiBusyOverlay({ open }: { open: boolean }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 px-6"
      role="status"
      aria-live="polite"
    >
      <div className="flex w-full max-w-xs flex-col items-center rounded-2xl bg-white px-6 py-6 text-center shadow-lg">
        <IntakeAiGlobe />
        <p className="mt-4 text-[16px] font-bold text-gray-900">
          AI가 분석 중입니다
        </p>
        <p className="mt-1 text-[13px] font-medium text-gray-500">
          각 칸에 넣는 중…
        </p>
      </div>
    </div>
  );
}

export function IntakeAiBusyCover() {
  return (
    <div className="flex flex-col items-center px-6 text-center" role="status">
      <IntakeAiGlobe />
      <p className="mt-4 text-[16px] font-bold text-gray-900">
        AI가 분석 중입니다
      </p>
      <p className="mt-1 text-[13px] font-medium text-gray-500">
        각 칸에 넣는 중…
      </p>
    </div>
  );
}
