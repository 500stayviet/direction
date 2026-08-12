"use client";

import { useEffect } from "react";
import { getSessionUserId } from "@/lib/auth";
import {
  startEntityRealtime,
  stopEntityRealtime,
} from "@/lib/entityRealtime";
import { subscribeWorkspaceIdCache } from "@/lib/storage";

/** 로그인 후, 앱이 앞에 있을 때만 고객·매물·네비 캐시를 실시간으로 맞춤 */
export function EntityRealtimeSync() {
  useEffect(() => {
    let cancelled = false;
    let userId: string | null = null;

    const sync = () => {
      if (cancelled || !userId) return;
      if (document.visibilityState === "visible") {
        void startEntityRealtime(userId);
      } else {
        void stopEntityRealtime();
      }
    };

    const unsubWorkspace = subscribeWorkspaceIdCache(() => {
      if (!cancelled && userId && document.visibilityState === "visible") {
        void startEntityRealtime(userId);
      }
    });

    document.addEventListener("visibilitychange", sync);
    window.addEventListener("pageshow", sync);

    void getSessionUserId().then((id) => {
      if (cancelled) return;
      userId = id;
      sync();
    });

    return () => {
      cancelled = true;
      unsubWorkspace();
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("pageshow", sync);
      void stopEntityRealtime();
    };
  }, []);

  return null;
}
