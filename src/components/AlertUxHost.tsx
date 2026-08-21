"use client";

import { useSyncExternalStore } from "react";
import { TabTitleSync } from "@/components/TabTitleSync";
import { FaviconBadgeSync } from "@/components/FaviconBadgeSync";
import { AlertBanner } from "@/components/AlertBanner";
import { WebNotificationSync } from "@/components/WebNotificationSync";
import { PushPermissionPrompt } from "@/components/PushPermissionPrompt";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { totalUnseenFromState } from "@/lib/alertCounts";
import {
  getTeamAlertsSnapshot,
  subscribeTeamAlerts,
} from "@/lib/teamAlerts";
import {
  getAuthEpoch,
  peekCurrentUser,
  subscribeAuthChange,
} from "@/lib/auth";

function useAlertTopInset(): boolean {
  const snap = useSyncExternalStore(
    subscribeTeamAlerts,
    getTeamAlertsSnapshot,
    getTeamAlertsSnapshot
  );
  const epoch = useSyncExternalStore(
    subscribeAuthChange,
    getAuthEpoch,
    () => 0
  );
  const loggedIn = Boolean(peekCurrentUser()?.id) && epoch >= 0;
  return loggedIn && totalUnseenFromState(snap) > 0;
}

/** 탭 제목·파비콘·배ner·브라우저 알림·SW */
export function AlertUxSync() {
  return (
    <>
      <TabTitleSync />
      <FaviconBadgeSync />
      <WebNotificationSync />
      <ServiceWorkerRegister />
      <AlertBanner />
      <PushPermissionPrompt />
    </>
  );
}

/** 상단 배ner 높이만큼 패딩 */
export function AlertTopInset({ children }: { children: React.ReactNode }) {
  const inset = useAlertTopInset();
  return <div className={inset ? "pt-[3.25rem]" : ""}>{children}</div>;
}
