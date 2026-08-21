"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  getAuthEpoch,
  peekCurrentUser,
  subscribeAuthChange,
} from "@/lib/auth";
import { pushEnvReady } from "@/lib/pwaDetect";
import {
  registerAppServiceWorker,
  syncWebPushSubscription,
} from "@/lib/pushClient";

function useAuthUserId(): string | null {
  const epoch = useSyncExternalStore(
    subscribeAuthChange,
    getAuthEpoch,
    () => 0
  );
  return peekCurrentUser()?.id ?? null;
}

/** Service Worker 등록 + 허용된 push 구독 동기화 */
export function ServiceWorkerRegister() {
  const userId = useAuthUserId();

  useEffect(() => {
    if (!pushEnvReady()) return;
    void registerAppServiceWorker();
  }, []);

  useEffect(() => {
    if (!userId || !pushEnvReady()) return;
    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "granted") return;
    void syncWebPushSubscription(userId);
  }, [userId]);

  return null;
}
