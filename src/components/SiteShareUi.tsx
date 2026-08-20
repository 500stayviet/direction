"use client";

import { useState } from "react";
import {
  SITE_SHARE_CARD_BADGE_ENABLED,
  SITE_SHARE_DEV_LABEL,
  SITE_SHARE_UI_ENABLED,
} from "@/lib/siteShare";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { DetailHeaderButton } from "@/components/DetailHeaderButton";

function ForeignShareHintModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      position="center"
      dense
      title="공유 중단"
      description="공유한 분만 끌 수 있습니다. 목록에서 빼려면 삭제해 주세요."
    >
      <Button type="button" fullWidth onClick={onClose}>
        확인
      </Button>
    </Modal>
  );
}

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

/** 등록 폼용 — 기능 꺼져 있으면 칸 자체를 숨김 */
export function SiteShareFormField({
  value,
  onChange,
  siteShareBlocked = false,
}: {
  value: boolean;
  onChange: (next: boolean) => void;
  /** 협력부동산 매물 등 — 사이트내 공유 불가 */
  siteShareBlocked?: boolean;
}) {
  if (siteShareBlocked) {
    return (
      <p className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-center text-[13px] font-semibold leading-snug text-amber-900">
        협력부동산 소유의 매물은 사이트내 공유가 불가합니다.
      </p>
    );
  }

  if (!SITE_SHARE_UI_ENABLED) return null;

  const shared = value === true;
  return (
    <button
      type="button"
      onClick={() => onChange(!shared)}
      className={[
        "flex min-h-[44px] w-full items-center justify-center rounded-xl text-[15px] font-bold transition-all duration-150 active:scale-95",
        shared
          ? "bg-emerald-500 text-white shadow-sm"
          : "bg-gray-100 text-gray-700",
      ].join(" ")}
    >
      {shared ? "사이트내 공유 중" : "사이트내 공유하기"}
    </button>
  );
}

/** 리스트 카드용 — 본인만 켜고 끔. 팀원 건은 누르면 안내 */
export function TeamShareChip({
  shared,
  done,
  disabled,
  locked,
  onToggle,
  tone = "default",
}: {
  shared: boolean;
  done?: boolean;
  disabled?: boolean;
  locked?: boolean;
  onToggle: () => void;
  /** quiet: 고객리스트 — 흰 카드 위 알약 버튼 */
  tone?: "default" | "quiet";
}) {
  const [hintOpen, setHintOpen] = useState(false);
  const quiet = tone === "quiet";
  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (disabled) return;
          if (locked) {
            setHintOpen(true);
            return;
          }
          onToggle();
        }}
        className={[
          "inline-flex shrink-0 cursor-pointer items-center justify-center font-semibold transition-opacity hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60",
          quiet
            ? "min-h-[28px] rounded-full px-2.5 text-[12px]"
            : "rounded-lg px-1.5 py-0.5 text-[11px] font-extrabold text-white shadow-sm",
          quiet
            ? done
              ? "border border-gray-200 bg-gray-50 text-gray-400"
              : shared
                ? "bg-emerald-500 text-white"
                : "border border-gray-300 bg-white text-gray-700"
            : done
              ? "bg-gray-400"
              : shared
                ? "bg-emerald-500"
                : "bg-gray-500",
        ].join(" ")}
      >
        {shared ? "팀 공유 중" : "팀 공유하기"}
      </button>
      <ForeignShareHintModal
        open={hintOpen}
        onClose={() => setHintOpen(false)}
      />
    </>
  );
}

/** 상세 헤더용 — 수정/삭제와 같은 아웃라인 버튼 스타일 */
export function TeamShareButton({
  active,
  done,
  disabled,
  locked,
  onToggle,
  className = "",
}: {
  active: boolean;
  done?: boolean;
  disabled?: boolean;
  locked?: boolean;
  onToggle: () => void;
  className?: string;
}) {
  const [hintOpen, setHintOpen] = useState(false);
  return (
    <>
      <DetailHeaderButton
        tone={done ? "cancel" : active ? "teamOn" : "team"}
        disabled={done || disabled}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (locked) {
            setHintOpen(true);
            return;
          }
          onToggle();
        }}
        className={done ? `!border-gray-300 !text-gray-400 ${className}` : className}
      >
        {active ? "공유중" : "팀공유"}
      </DetailHeaderButton>
      <ForeignShareHintModal
        open={hintOpen}
        onClose={() => setHintOpen(false)}
      />
    </>
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
