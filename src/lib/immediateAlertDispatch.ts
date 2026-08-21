"use client";

import { getAccessToken } from "@/lib/auth";

export type ImmediateAlertDispatchInput = {
  entityKind: "customer" | "property" | "schedule";
  entityId: string;
  label: string;
  workspaceId?: string | null;
  workspaceShared: boolean;
};

/** 저장 직후 즉시 Web Push — 응답을 기다리지 않음 */
export function postImmediateAlertDispatch(
  input: ImmediateAlertDispatchInput
): void {
  if (typeof window === "undefined") return;
  void (async () => {
    try {
      const token = await getAccessToken();
      if (!token) return;
      await fetch("/api/alerts/dispatch", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
        keepalive: true,
      });
    } catch {
      /* ignore — cron 백업 */
    }
  })();
}
