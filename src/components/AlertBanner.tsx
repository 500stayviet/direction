"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import {
  formatAlertBannerText,
} from "@/lib/alertLabels";
import {
  pickAlertBannerHref,
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

/** 상단 알람 배ner — 확인 전까지 유지 */
export function AlertBanner() {
  const snap = useAlertSnap();
  const loggedIn = useLoggedIn();
  if (!loggedIn) return null;

  const summary = unseenMatchSummaryFromState(snap);
  const text = formatAlertBannerText(summary);
  if (!text) return null;

  const href = pickAlertBannerHref(snap);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex justify-center px-4 pt-[max(0.35rem,env(safe-area-inset-top))]">
      <Link
        href={href}
        className="pointer-events-auto flex max-w-[430px] flex-1 items-center gap-2 rounded-2xl border border-[#3182F6]/25 bg-[#3182F6] px-3.5 py-2.5 text-[13px] font-bold leading-snug text-white shadow-[0_8px_24px_rgba(49,130,246,0.35)] active:scale-[0.99] transition-transform"
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
