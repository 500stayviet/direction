"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import { formatAlertBannerText } from "@/lib/alertLabels";
import {
  ALERT_BANNER_AUTO_HIDE_MS,
  ALERT_BANNER_REMINDER_PATHS,
  pickAlertBannerHref,
  totalUnseenFromState,
  unseenMatchSummaryFromState,
} from "@/lib/alertCounts";
import {
  getTeamAlertsSnapshot,
  subscribeTeamAlerts,
} from "@/lib/teamAlerts";
import {
  getAuthEpoch,
  peekCurrentUser,
  subscribeAuthChange,
} from "@/lib/auth";

const SWIPE_DISMISS_PX = 36;
const TAP_SLOP_PX = 10;
const BANNER_EXIT_MS = 220;

function useAlertSnap() {
  return useSyncExternalStore(
    subscribeTeamAlerts,
    getTeamAlertsSnapshot,
    getTeamAlertsSnapshot
  );
}

function useLoggedIn(): boolean {
  const epoch = useSyncExternalStore(
    subscribeAuthChange,
    getAuthEpoch,
    () => 0
  );
  return Boolean(peekCurrentUser()?.id);
}

/**
 * 미확인 알람이 있을 때:
 * - 홈·고객·매물·네비 **리스트** 진입 시에만 배너 표시 (5초 후 숨김)
 * - 리스트에서 등록·상세 등으로 이동해도 **남은 카운트다운** 동안만 유지
 * - 등록·상세·설정 등 그 외 화면에서는 재표시하지 않음
 */
function useBannerSession(
  hasAlerts: boolean,
  unseenTotal: number,
  pathname: string
): { show: boolean; hideAfterMs: number; dismiss: () => void } {
  const [show, setShow] = useState(false);
  const [hideAfterMs, setHideAfterMs] = useState(ALERT_BANNER_AUTO_HIDE_MS);
  const hideAtRef = useRef<number | null>(null);

  const dismiss = useCallback(() => {
    hideAtRef.current = null;
    setShow(false);
  }, []);

  useEffect(() => {
    if (!hasAlerts || unseenTotal <= 0) {
      dismiss();
      return;
    }

    const onReminderPath = ALERT_BANNER_REMINDER_PATHS.has(pathname);

    if (onReminderPath) {
      hideAtRef.current = Date.now() + ALERT_BANNER_AUTO_HIDE_MS;
      setHideAfterMs(ALERT_BANNER_AUTO_HIDE_MS);
      setShow(true);
      return;
    }

    const hideAt = hideAtRef.current;
    if (hideAt !== null && Date.now() < hideAt) {
      setHideAfterMs(hideAt - Date.now());
      setShow(true);
      return;
    }

    dismiss();
  }, [hasAlerts, unseenTotal, pathname, dismiss]);

  return { show, hideAfterMs, dismiss };
}

type BannerMotion = "enter" | "idle" | "exit";

function AlertBannerCard({
  href,
  text,
  hideAfterMs,
  onDismiss,
}: {
  href: string;
  text: string;
  hideAfterMs: number;
  onDismiss: () => void;
}) {
  const [dragY, setDragY] = useState(0);
  const [motion, setMotion] = useState<BannerMotion>("enter");
  const startRef = useRef<{ y: number; t: number } | null>(null);
  const swipedRef = useRef(false);
  const dismissingRef = useRef(false);
  const autoHideTimerRef = useRef<number | null>(null);

  const clearAutoHideTimer = useCallback(() => {
    if (autoHideTimerRef.current !== null) {
      window.clearTimeout(autoHideTimerRef.current);
      autoHideTimerRef.current = null;
    }
  }, []);

  const finishDismiss = useCallback(() => {
    if (dismissingRef.current) return;
    dismissingRef.current = true;
    clearAutoHideTimer();
    setMotion("exit");
    window.setTimeout(onDismiss, BANNER_EXIT_MS);
  }, [clearAutoHideTimer, onDismiss]);

  useEffect(() => {
    if (motion !== "enter") return;
    const t = window.setTimeout(() => setMotion("idle"), 320);
    return () => window.clearTimeout(t);
  }, [motion]);

  useEffect(() => {
    clearAutoHideTimer();
    if (hideAfterMs <= 0) return;
    autoHideTimerRef.current = window.setTimeout(() => {
      autoHideTimerRef.current = null;
      finishDismiss();
    }, hideAfterMs);
    return clearAutoHideTimer;
  }, [hideAfterMs, finishDismiss, clearAutoHideTimer]);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (motion === "exit") return;
    startRef.current = { y: e.clientY, t: Date.now() };
    swipedRef.current = false;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!startRef.current || motion === "exit") return;
    const dy = e.clientY - startRef.current.y;
    if (Math.abs(dy) > TAP_SLOP_PX) swipedRef.current = true;
    setDragY(Math.min(0, dy));
  };

  const onPointerEnd = () => {
    if (!startRef.current || motion === "exit") return;
    const dy = dragY;
    const elapsed = Math.max(Date.now() - startRef.current.t, 1);
    const velocity = -dy / elapsed;
    startRef.current = null;

    if (dy < -SWIPE_DISMISS_PX || velocity > 0.45) {
      setDragY(0);
      finishDismiss();
      return;
    }

    setDragY(0);
  };

  const motionClass =
    motion === "enter"
      ? "animate-alert-banner-in"
      : motion === "exit"
        ? "animate-alert-banner-out"
        : "";

  const dragStyle =
    motion === "idle" && dragY !== 0
      ? { transform: `translateY(${dragY}px)` }
      : undefined;

  return (
    <div
      className={[
        "pointer-events-auto w-full max-w-[430px] touch-none select-none",
        motionClass,
      ].join(" ")}
      style={dragStyle}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
    >
      <Link
        href={href}
        className="flex w-full items-center gap-2 rounded-2xl border border-[#3182F6]/30 bg-[#3182F6] px-3.5 py-2.5 text-[13px] font-bold leading-snug text-white shadow-[0_12px_32px_rgba(15,23,42,0.28)] ring-1 ring-black/5 active:scale-[0.99] transition-transform"
        onClick={(e) => {
          if (swipedRef.current) e.preventDefault();
        }}
      >
        <span className="shrink-0 text-[15px]" aria-hidden>
          🔔
        </span>
        <span className="min-w-0 flex-1">{text}</span>
        <span className="shrink-0 text-[12px] font-semibold text-white/90">
          →
        </span>
      </Link>
    </div>
  );
}

/** 상단 알람 — 위에서 내려오며, 5초·스와이프 시 위로 올라가며 닫힘 */
export function AlertBanner() {
  const pathname = usePathname();
  const snap = useAlertSnap();
  const loggedIn = useLoggedIn();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const summary = unseenMatchSummaryFromState(snap);
  const text = formatAlertBannerText(summary);
  const unseenTotal = totalUnseenFromState(snap);
  const { show, hideAfterMs, dismiss } = useBannerSession(
    Boolean(text),
    unseenTotal,
    pathname
  );

  if (!mounted || !loggedIn || !text || !show) return null;

  const href = pickAlertBannerHref(snap);

  return createPortal(
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[80] flex justify-center px-4 pt-[max(0.5rem,env(safe-area-inset-top))]"
      role="status"
      aria-live="polite"
    >
      <AlertBannerCard
        href={href}
        text={text}
        hideAfterMs={hideAfterMs}
        onDismiss={dismiss}
      />
    </div>,
    document.body
  );
}
