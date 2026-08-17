"use client";

import { IntakeAiGlobe } from "@/components/IntakeAiGlobe";

function Starfield() {
  return (
    <div className="intake-ai-stars" aria-hidden>
      <span />
      <span />
      <span />
      <span />
      <span />
      <span />
      <span />
      <span />
      <span />
      <span />
    </div>
  );
}

function IntakeAiBusyPanel({ fill }: { fill?: boolean }) {
  return (
    <div
      className={[
        "relative overflow-hidden text-center",
        fill
          ? "flex h-full min-h-[12rem] w-full flex-col items-center justify-center rounded-[inherit] px-6 py-8"
          : "flex w-full max-w-xs flex-col items-center rounded-3xl px-7 py-8",
        "bg-[radial-gradient(circle_at_50%_18%,#1d4ed8_0%,transparent_42%),linear-gradient(180deg,#07101f_0%,#0b1730_52%,#060b16_100%)]",
        fill ? "" : "shadow-[0_24px_60px_rgba(3,8,23,0.55)] ring-1 ring-white/15",
      ].join(" ")}
      role="status"
      aria-live="polite"
    >
      <Starfield />
      <IntakeAiGlobe />
      <p className="relative mt-5 text-[17px] font-extrabold tracking-tight text-white">
        AI가 분석 중입니다
      </p>
      <p className="relative mt-1.5 text-[13px] font-medium text-sky-200/80">
        글에서 칸을 찾아 넣는 중…
      </p>
    </div>
  );
}

export function IntakeAiBusyOverlay({ open }: { open: boolean }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-[#020617]/70 px-6 backdrop-blur-[2px]"
      role="status"
      aria-live="polite"
    >
      <IntakeAiBusyPanel />
    </div>
  );
}

export function IntakeAiBusyCover() {
  return <IntakeAiBusyPanel fill />;
}
