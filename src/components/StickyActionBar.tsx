"use client";

interface StickyActionBarProps {
  children: React.ReactNode;
  /** true면 하단 탭바(56px) 위에 올림. 탭 없는 화면은 false */
  aboveTab?: boolean;
}

/** 모바일 프레임(430px) 너비에 맞춘 하단 고정 액션바 */
export function StickyActionBar({
  children,
  aboveTab = true,
}: StickyActionBarProps) {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-[45] flex justify-center"
      style={{
        bottom: aboveTab
          ? "calc(56px + env(safe-area-inset-bottom))"
          : "env(safe-area-inset-bottom)",
      }}
    >
      <div className="pointer-events-auto w-full max-w-[430px] border-t border-gray-100 bg-white/95 px-4 py-2.5 shadow-[0_-4px_16px_rgba(0,0,0,0.04)] backdrop-blur">
        {children}
      </div>
    </div>
  );
}
