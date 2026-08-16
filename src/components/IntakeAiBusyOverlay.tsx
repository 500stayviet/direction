"use client";

export function IntakeAiBusyOverlay({ open }: { open: boolean }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 px-6"
      role="status"
      aria-live="polite"
    >
      <div className="w-full max-w-xs rounded-2xl bg-white px-6 py-5 text-center shadow-lg">
        <p className="text-[16px] font-bold text-gray-900">잠시만 기다리세요.</p>
        <p className="mt-1 text-[13px] font-medium text-gray-500">
          AI가 내용을 분석 중입니다.
        </p>
      </div>
    </div>
  );
}
