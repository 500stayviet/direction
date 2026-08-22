"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
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
): boolean {
  const [visible, setVisible] = useState(false);
  /** 리스트에서 배너를 띄운 뒤 자동 숨김 시각 — 비리스트는 이 시각까지만 표시 */
  const hideAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (!hasAlerts || unseenTotal <= 0) {
      setVisible(false);
      hideAtRef.current = null;
      return;
    }
    const onReminderPath = ALERT_BANNER_REMINDER_PATHS.has(pathname);

    const armHide = (ms: number) => {
      hideAtRef.current = Date.now() + ms;
      setVisible(true);
      const t = window.setTimeout(() => {
        hideAtRef.current = null;
        setVisible(false);
      }, ms);
      return () => window.clearTimeout(t);
    };

    if (onReminderPath) {
      return armHide(ALERT_BANNER_AUTO_HIDE_MS);
    }

    const hideAt = hideAtRef.current;
    if (hideAt !== null && Date.now() < hideAt) {
      const remaining = hideAt - Date.now();
      setVisible(true);
      const t = window.setTimeout(() => {
        hideAtRef.current = null;
        setVisible(false);
      }, remaining);
      return () => window.clearTimeout(t);
    }

    setVisible(false);
    hideAtRef.current = null;
  }, [hasAlerts, unseenTotal, pathname]);

  return visible;
}

/** 상단 알람 — 페이지 레이아웃과 분리, 창 위에 떠 있는 배너(포털) */
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
  const visible = useBannerVisible(Boolean(text), unseenTotal, pathname);

  if (!mounted || !loggedIn || !text || !visible) return null;

  const href = pickAlertBannerHref(snap);

  return createPortal(
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[80] flex justify-center px-4 pt-[max(0.5rem,env(safe-area-inset-top))]"
      role="status"
      aria-live="polite"
    >
      <Link
        href={href}
        className="pointer-events-auto flex w-full max-w-[430px] items-center gap-2 rounded-2xl border border-[#3182F6]/30 bg-[#3182F6] px-3.5 py-2.5 text-[13px] font-bold leading-snug text-white shadow-[0_12px_32px_rgba(15,23,42,0.28)] ring-1 ring-black/5 active:scale-[0.99] transition-transform"
      >
        <span className="shrink-0 text-[15px]" aria-hidden>
          🔔
        </span>
        <span className="min-w-0 flex-1">{text}</span>
        <span className="shrink-0 text-[12px] font-semibold text-white/90">
          →
        </span>
      </Link>
    </div>,
    document.body
  );
}
