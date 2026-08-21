"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { formatAlertBannerText } from "@/lib/alertLabels";
import {
  ALERT_BANNER_AUTO_HIDE_MS,
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
 * 미확인 알람이 늘 때만 배너 표시 → 15초 후 자동 숨김.
 * 뱃지·탭 제목 등 알람 상태는 확인할 때까지 유지.
 */
function useBannerVisible(hasAlerts: boolean, unseenTotal: number): boolean {
  const [visible, setVisible] = useState(false);
  const peakUnseenRef = useRef(0);

  useEffect(() => {
    if (!hasAlerts || unseenTotal <= 0) {
      setVisible(false);
      peakUnseenRef.current = 0;
      return;
    }

    if (unseenTotal <= peakUnseenRef.current) return;

    peakUnseenRef.current = unseenTotal;
    setVisible(true);
    const t = window.setTimeout(
      () => setVisible(false),
      ALERT_BANNER_AUTO_HIDE_MS
    );
    return () => window.clearTimeout(t);
  }, [hasAlerts, unseenTotal]);

  return visible;
}

/** 상단 알람 — 페이지 레이아웃과 분리, 창 위에 떠 있는 배너(포털) */
export function AlertBanner() {
  const snap = useAlertSnap();
  const loggedIn = useLoggedIn();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const summary = unseenMatchSummaryFromState(snap);
  const text = formatAlertBannerText(summary);
  const unseenTotal = totalUnseenFromState(snap);
  const visible = useBannerVisible(Boolean(text), unseenTotal);

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
