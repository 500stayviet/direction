"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

const SWIPE_THRESHOLD = 56;
const MAX_DRAG = 112;
const NUDGE = 34;
const LOCK_PX = 8;
const TAP_PX = 8;

type Props = {
  children: ReactNode;
  disabled?: boolean;
  /** true면 좌·우로 살짝 밀어 스와이프 가능을 알려줌 */
  hintNudge?: boolean;
  /** 짧은 탭(드래그 없음) — 상세 이동 등 */
  onTap?: () => void;
  /** 우→좌 스와이프 (카드가 왼쪽으로 밀림) → 종료 */
  onSwipeLeft: () => void;
  /** 좌→우 스와이프 (카드가 오른쪽으로 밀림) → 삭제 */
  onSwipeRight: () => void;
};

function isInteractiveTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest("a, button, input, textarea, select, label"));
}

export function SwipeRevealRow({
  children,
  disabled,
  hintNudge = false,
  onTap,
  onSwipeLeft,
  onSwipeRight,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const startX = useRef(0);
  const startY = useRef(0);
  const offsetRef = useRef(0);
  const locking = useRef<"h" | "v" | null>(null);
  const active = useRef(false);
  const pointerId = useRef<number | null>(null);
  const skipGesture = useRef(false);
  const nudgeCancel = useRef(false);
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);

  const setDragOffset = (value: number) => {
    offsetRef.current = value;
    setOffset(value);
  };

  const reset = () => {
    active.current = false;
    locking.current = null;
    pointerId.current = null;
    skipGesture.current = false;
    setDragOffset(0);
    setDragging(false);
  };

  const onTapRef = useRef(onTap);
  const onSwipeLeftRef = useRef(onSwipeLeft);
  const onSwipeRightRef = useRef(onSwipeRight);
  onTapRef.current = onTap;
  onSwipeLeftRef.current = onSwipeLeft;
  onSwipeRightRef.current = onSwipeRight;

  useEffect(() => {
    if (!hintNudge || disabled) return;
    nudgeCancel.current = false;
    const timers: number[] = [];

    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        timers.push(window.setTimeout(resolve, ms));
      });

    void (async () => {
      await wait(700);
      if (nudgeCancel.current || active.current) return;
      setDragging(false);
      setDragOffset(-NUDGE);
      await wait(480);
      if (nudgeCancel.current || active.current) {
        setDragOffset(0);
        return;
      }
      setDragOffset(0);
      await wait(320);
      if (nudgeCancel.current || active.current) {
        setDragOffset(0);
        return;
      }
      setDragOffset(NUDGE);
      await wait(480);
      setDragOffset(0);
    })();

    return () => {
      nudgeCancel.current = true;
      for (const id of timers) window.clearTimeout(id);
      setDragOffset(0);
    };
  }, [hintNudge, disabled]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || disabled) return;
    let ending = false;

    const finish = (e: PointerEvent) => {
      if (pointerId.current != null && e.pointerId !== pointerId.current) {
        return;
      }
      if (ending) return;
      ending = true;

      const dx = offsetRef.current;
      const totalX = e.clientX - startX.current;
      const totalY = e.clientY - startY.current;
      const moved =
        Math.abs(totalX) > TAP_PX || Math.abs(totalY) > TAP_PX;
      const wasActive = active.current && !skipGesture.current;
      const lock = locking.current;

      try {
        if (el.hasPointerCapture(e.pointerId)) {
          el.releasePointerCapture(e.pointerId);
        }
      } catch {
        /* ignore */
      }

      if (wasActive) {
        if (lock === "h") {
          if (dx <= -SWIPE_THRESHOLD) onSwipeLeftRef.current();
          else if (dx >= SWIPE_THRESHOLD) onSwipeRightRef.current();
        } else if (!moved && lock !== "v") {
          onTapRef.current?.();
        }
      }

      reset();
      ending = false;
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if (isInteractiveTarget(e.target)) {
        skipGesture.current = true;
        active.current = false;
        return;
      }

      nudgeCancel.current = true;
      skipGesture.current = false;
      active.current = true;
      locking.current = null;
      pointerId.current = e.pointerId;
      startX.current = e.clientX;
      startY.current = e.clientY;
      setDragOffset(0);

      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!active.current || skipGesture.current) return;
      if (pointerId.current != null && e.pointerId !== pointerId.current) return;

      const dx = e.clientX - startX.current;
      const dy = e.clientY - startY.current;

      if (!locking.current) {
        if (Math.abs(dx) < LOCK_PX && Math.abs(dy) < LOCK_PX) return;
        locking.current = Math.abs(dx) > Math.abs(dy) * 1.05 ? "h" : "v";
        if (locking.current === "v") {
          try {
            if (el.hasPointerCapture(e.pointerId)) {
              el.releasePointerCapture(e.pointerId);
            }
          } catch {
            /* ignore */
          }
          active.current = false;
          setDragging(false);
          setDragOffset(0);
          return;
        }
        setDragging(true);
      }

      if (locking.current !== "h") return;

      e.preventDefault();
      const clamped = Math.max(-MAX_DRAG, Math.min(MAX_DRAG, dx));
      setDragOffset(clamped);
    };

    const onDragStart = (e: DragEvent) => {
      e.preventDefault();
    };

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove, { passive: false });
    el.addEventListener("pointerup", finish);
    el.addEventListener("pointercancel", finish);
    el.addEventListener("dragstart", onDragStart, true);

    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", finish);
      el.removeEventListener("pointercancel", finish);
      el.removeEventListener("dragstart", onDragStart, true);
    };
  }, [disabled]);

  return (
    <div className="relative overflow-hidden rounded-2xl">
      <div
        className="pointer-events-none absolute inset-y-0 left-0 flex w-24 items-center justify-center bg-red-500 text-[13px] font-extrabold text-white"
        aria-hidden
      >
        삭제
      </div>
      <div
        className="pointer-events-none absolute inset-y-0 right-0 flex w-24 items-center justify-center bg-emerald-500 text-[13px] font-extrabold text-white"
        aria-hidden
      >
        종료
      </div>
      <div
        ref={rootRef}
        className={[
          "relative touch-pan-y select-none [-webkit-user-drag:none]",
          dragging ? "cursor-grabbing" : onTap ? "cursor-pointer" : "cursor-grab",
          dragging ? "" : "transition-transform duration-200 ease-out",
        ].join(" ")}
        style={{ transform: `translateX(${offset}px)` }}
      >
        {children}
      </div>
    </div>
  );
}
