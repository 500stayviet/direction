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
function useBannerVisible(
  hasAlerts: boolean,
  unseenTotal: number,
  pathname: string
): { visible: boolean; dismiss: () => void } {
  const [visible, setVisible] = useState(false);
  const hideAtRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const dismiss = useCallback(() => {
    clearTimer();
    hideAtRef.current = null;
    setVisible(false);
  }, [clearTimer]);

  useEffect(() => {
    if (!hasAlerts || unseenTotal <= 0) {
      dismiss();
      return;
    }

    const onReminderPath = ALERT_BANNER_REMINDER_PATHS.has(pathname);

    const armHide = (ms: number) => {
      hideAtRef.current = Date.now() + ms;
      setVisible(true);
      clearTimer();
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        hideAtRef.current = null;
        setVisible(false);
      }, ms);
      return clearTimer;
    };

    if (onReminderPath) {
      return armHide(ALERT_BANNER_AUTO_HIDE_MS);
    }

    const hideAt = hideAtRef.current;
    if (hideAt !== null && Date.now() < hideAt) {
      const remaining = hideAt - Date.now();
      setVisible(true);
      clearTimer();
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        hideAtRef.current = null;
        setVisible(false);
      }, remaining);
      return clearTimer;
    }

    setVisible(false);
    hideAtRef.current = null;
    clearTimer();
  }, [hasAlerts, unseenTotal, pathname, dismiss, clearTimer]);

  return { visible, dismiss };
}

type BannerMotion = "enter" | "idle" | "exit";

function AlertBannerCard({
  href,
  text,
  onDismiss,
}: {
  href: string;
  text: string;
  onDismiss: () => void;
}) {
  const [dragY, setDragY] = useState(0);
  const [motion, setMotion] = useState<BannerMotion>("enter");
  const startRef = useRef<{ y: number; t: number } | null>(null);
  const swipedRef = useRef(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (motion !== "enter") return;
    const t = window.setTimeout(() => setMotion("idle"), 320);
    return () => window.clearTimeout(t);
  }, [motion]);

  const finishDismiss = useCallback(() => {
    setMotion("exit");
    window.setTimeout(onDismiss, 220);
  }, [onDismiss]);

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
      ref={cardRef}
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

/** 상단 알람 — 위에서 내려오며, 스와이프 올려 닫기 */
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
  const { visible, dismiss } = useBannerVisible(
    Boolean(text),
    unseenTotal,
    pathname
  );

  if (!mounted || !loggedIn || !text || !visible) return null;

  const href = pickAlertBannerHref(snap);

  return createPortal(
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[80] flex justify-center px-4 pt-[max(0.5rem,env(safe-area-inset-top))]"
      role="status"
      aria-live="polite"
    >
      <AlertBannerCard href={href} text={text} onDismiss={dismiss} />
    </div>,
    document.body
  );
}
