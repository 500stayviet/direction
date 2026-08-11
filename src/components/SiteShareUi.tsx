"use client";

import {
  SITE_SHARE_CARD_BADGE_ENABLED,
  SITE_SHARE_DEV_LABEL,
  SITE_SHARE_FORM_LABEL,
  SITE_SHARE_UI_ENABLED,
} from "@/lib/siteShare";

/** 개발중 표시 — 글자 중앙 취소선 */
function DevStrikeLabel({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
  return (
    <span
      className={[
        "relative inline-flex items-center justify-center font-bold text-gray-400",
        className,
      ].join(" ")}
    >
      <span className="relative z-[1]">{text}</span>
      <span
        aria-hidden
        className="pointer-events-none absolute left-0 right-0 top-1/2 z-[2] h-[1.5px] -translate-y-1/2 bg-gray-400"
      />
    </span>
  );
}

/** 등록 폼용 — 개발중일 때 비활성 표시 */
export function SiteShareFormField({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  if (!SITE_SHARE_UI_ENABLED) {
    return (
      <div className="space-y-1">
        <p className="text-[13px] font-semibold text-gray-600">
          {SITE_SHARE_FORM_LABEL}
        </p>
        <div className="flex min-h-[44px] items-center justify-center rounded-xl bg-gray-100 px-3 text-[15px]">
          <DevStrikeLabel text="개발중" className="text-[15px]" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <p className="text-[13px] font-semibold text-gray-600">
        {SITE_SHARE_FORM_LABEL}
      </p>
      <div className="grid grid-cols-2 gap-1.5">
        {(["유", "무"] as const).map((option) => {
          const active = (value ? "유" : "무") === option;
          return (
            <button
              key={option}
              type="button"
              onClick={() => onChange(option === "유")}
              className={[
                "min-h-[44px] rounded-xl text-[15px] font-bold transition-all duration-150 active:scale-95",
                active
                  ? "bg-[#3182F6] text-white shadow-sm"
                  : "bg-gray-100 text-gray-600",
              ].join(" ")}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** 상세 헤더용 — 수정/삭제와 같은 아웃라인 버튼 스타일 */
export function TeamShareButton({
  active,
  done,
  disabled,
  onToggle,
  className = "",
}: {
  active: boolean;
  done?: boolean;
  disabled?: boolean;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      disabled={done || disabled}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }}
      className={[
        "inline-flex shrink-0 items-center justify-center rounded-xl border-2 bg-white px-2.5 text-[13px] font-bold transition-colors active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60",
        done
          ? "border-gray-300 text-gray-400"
          : active
            ? "border-violet-500 text-violet-600 hover:bg-violet-50"
            : "border-gray-400 text-gray-600 hover:bg-gray-50",
        className || "!min-h-[36px]",
      ].join(" ")}
    >
      {active ? "팀 공유 중" : "팀 공유하기"}
    </button>
  );
}

/** 섹션 제목 옆 등 — 개발중(취소선) 표시 */
export function SiteShareDevMark({ className = "" }: { className?: string }) {
  if (SITE_SHARE_UI_ENABLED) return null;
  return (
    <span
      className={[
        "inline-flex shrink-0 rounded-lg bg-gray-100 px-1.5 py-0.5",
        className,
      ].join(" ")}
    >
      <DevStrikeLabel text={SITE_SHARE_DEV_LABEL} className="text-[11px]" />
    </span>
  );
}

/** 조건 매칭 하단 — 사이트내 공유 자동매칭 준비 중 강조 */
export function SiteShareMatchingEmpty({
  kind,
}: {
  kind: "customer" | "property";
}) {
  const label = kind === "customer" ? "고객" : "매물";
  return (
    <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
      <span className="inline-flex items-center rounded-md bg-amber-100 px-2 py-0.5 text-[13px] font-extrabold tracking-tight text-amber-700 ring-1 ring-inset ring-amber-300/80">
        준비 중
      </span>
      <span className="text-[13px] font-semibold text-gray-600">
        사이트내 공유 {label} 자동 매칭은 아직 이용할 수 없습니다.
      </span>
    </p>
  );
}

/** 리스트·상세 사이트내공유 뱃지/버튼 */
export function SiteShareBadge({
  active,
  done,
  onToggle,
}: {
  active: boolean;
  done?: boolean;
  onToggle?: () => void;
}) {
  if (!SITE_SHARE_UI_ENABLED) {
    // 카드 위 뱃지는 당분간 숨김
    if (!SITE_SHARE_CARD_BADGE_ENABLED) return null;
    return (
      <span className="inline-flex shrink-0 rounded-lg bg-gray-100 px-1.5 py-0.5">
        <DevStrikeLabel text={SITE_SHARE_DEV_LABEL} className="text-[11px]" />
      </span>
    );
  }

  if (!onToggle) {
    return (
      <span
        className={[
          "inline-flex shrink-0 rounded-lg px-1.5 py-0.5 text-[11px] font-extrabold text-white shadow-sm",
          active ? "bg-cyan-600" : "bg-gray-500",
        ].join(" ")}
      >
        {active ? "사이트내공유중" : "사이트내공유 중단 중"}
      </span>
    );
  }

  return (
    <button
      type="button"
      disabled={done}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }}
      className={[
        "inline-flex shrink-0 cursor-pointer rounded-lg px-1.5 py-0.5 text-[11px] font-extrabold text-white shadow-sm transition-opacity hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60",
        done ? "bg-gray-400" : active ? "bg-cyan-600" : "bg-gray-500",
      ].join(" ")}
    >
      {active ? "사이트내공유중" : "사이트내공유 중단 중"}
    </button>
  );
}
