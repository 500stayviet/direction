"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { PlanDisplay } from "@/lib/planDisplay";

function badgeClass(plan: PlanDisplay): string {
  const lifetime = plan.tone === "lifetime";
  return [
    "inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-[11px] font-bold",
    lifetime
      ? "bg-emerald-50 text-emerald-700"
      : plan.tone === "pro"
        ? "bg-[#3182F6]/10 text-[#3182F6]"
        : "bg-gray-100 text-gray-600",
  ].join(" ");
}

/** 평생 무료 등 요금 배지 — tip=true 일 때만 탭으로 말풍선 */
export function PlanBadge({
  plan,
  tip = true,
}: {
  plan: PlanDisplay;
  /** false면 표시만 (클릭·말풍선 없음) */
  tip?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);
  const tipId = useId();

  const updatePos = () => {
    const btn = btnRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    setPos({
      top: r.bottom + 8,
      left: r.left + r.width / 2,
    });
  };

  useLayoutEffect(() => {
    if (!open || !tip) {
      setPos(null);
      return;
    }
    updatePos();
  }, [open, tip]);

  useEffect(() => {
    if (!open || !tip) return;
    const onPointer = (e: PointerEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || tipRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onReposition = () => updatePos();
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onReposition, true);
    window.addEventListener("resize", onReposition);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onReposition, true);
      window.removeEventListener("resize", onReposition);
    };
  }, [open, tip]);

  if (!tip) {
    return <span className={badgeClass(plan)}>{plan.label}</span>;
  }

  const bubble =
    open && pos && typeof document !== "undefined"
      ? createPortal(
          <span
            ref={tipRef}
            id={tipId}
            role="tooltip"
            style={{ top: pos.top, left: pos.left }}
            className="pointer-events-auto fixed z-[80] w-max max-w-[min(240px,calc(100vw-24px))] -translate-x-1/2 rounded-xl bg-gray-900 px-3 py-2 text-left text-[12px] font-medium leading-snug text-white shadow-lg"
          >
            <span
              aria-hidden
              className="absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 bg-gray-900"
            />
            <span className="relative block">{plan.detail}</span>
            {plan.reason ? (
              <span className="relative mt-1 block text-[11px] font-normal text-gray-300">
                {plan.reason}
              </span>
            ) : null}
          </span>,
          document.body
        )
      : null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-expanded={open}
        aria-describedby={open ? tipId : undefined}
        onClick={() => setOpen((v) => !v)}
        className={[badgeClass(plan), "active:opacity-80"].join(" ")}
      >
        {plan.label}
      </button>
      {bubble}
    </>
  );
}
