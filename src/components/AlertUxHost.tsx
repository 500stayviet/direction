"use client";

import { TabTitleSync } from "@/components/TabTitleSync";
import { FaviconBadgeSync } from "@/components/FaviconBadgeSync";
import { AlertBanner } from "@/components/AlertBanner";
import { WebNotificationSync } from "@/components/WebNotificationSync";
import { PushPermissionPrompt } from "@/components/PushPermissionPrompt";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";

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
