"use client";

function Sparkle({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden
    >
      <path
        d="M12 1.6 13.9 8.4 20.8 10.2 13.9 12 12 18.8 10.1 12 3.2 10.2 10.1 8.4 12 1.6Z"
        fill="currentColor"
      />
    </svg>
  );
}

/** AI를 상징하는 스파클 + 궤도. 분석 중 우주 연출 */
export function IntakeAiGlobe() {
  return (
    <div className="intake-ai-mark" aria-hidden>
      <span className="intake-ai-orbit" />
      <span className="intake-ai-orbit intake-ai-orbit-slow" />
      <Sparkle className="intake-ai-sparkle intake-ai-sparkle-a" />
      <Sparkle className="intake-ai-sparkle intake-ai-sparkle-b" />
      <Sparkle className="intake-ai-sparkle intake-ai-sparkle-c" />
      <div className="intake-ai-core">
        <Sparkle className="intake-ai-sparkle-main" />
        <Sparkle className="intake-ai-sparkle-side" />
      </div>
    </div>
  );
}
