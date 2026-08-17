"use client";

import { IntakeAiGlobe } from "@/components/IntakeAiGlobe";

export function IntakeAiBusyOverlay({ open }: { open: boolean }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/35 px-6 backdrop-blur-[1.5px]"
      role="status"
      aria-live="polite"
      aria-label="AI가 분석 중입니다"
    >
      <div className="relative flex w-full max-w-[280px] flex-col items-center rounded-[28px] bg-white px-7 py-9 shadow-[0_20px_50px_rgba(15,23,42,0.18)] ring-1 ring-slate-200/80">
        <IntakeAiGlobe />
        <p className="relative mt-6 text-[16px] font-bold tracking-tight text-slate-900">
          AI가 분석 중입니다
        </p>
        <p className="relative mt-1 text-[12px] font-medium text-slate-500">
          글에서 칸을 찾아 넣는 중…
        </p>
      </div>
    </div>
  );
}
