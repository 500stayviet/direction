"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { formatDocumentTitleAlertSuffix } from "@/lib/alertLabels";
import {
  getTeamAlertsSnapshot,
  subscribeTeamAlerts,
} from "@/lib/teamAlerts";
import { totalUnseenFromState } from "@/lib/alertCounts";
import {
  getAuthEpoch,
  peekCurrentUser,
  subscribeAuthChange,
} from "@/lib/auth";

const BASE_TITLE = "현장동선";

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
  return Boolean(peekCurrentUser()?.id) && epoch >= 0;
}

/** 브라우저 탭 제목 — (N) 접두 + 숨김 탭 깜빡임 */
export function TabTitleSync() {
  const snap = useAlertSnap();
  const loggedIn = useLoggedIn();
  const blinkRef = useRef<number | null>(null);
  const showAlertRef = useRef(false);

  useEffect(() => {
    if (!loggedIn) {
      document.title = BASE_TITLE;
      return;
    }
    const total = totalUnseenFromState(snap);
    const prefix = formatDocumentTitleAlertSuffix(total);
    const alertTitle = `${prefix}${BASE_TITLE}`;
    const normalTitle = BASE_TITLE;

    const applyTitle = (alert: boolean) => {
      document.title = alert ? alertTitle : normalTitle;
    };

    const stopBlink = () => {
      if (blinkRef.current != null) {
        window.clearInterval(blinkRef.current);
        blinkRef.current = null;
      }
      applyTitle(false);
      showAlertRef.current = false;
    };

    if (total <= 0) {
      stopBlink();
      return;
    }

    applyTitle(true);

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        if (blinkRef.current != null) return;
        showAlertRef.current = true;
        blinkRef.current = window.setInterval(() => {
          showAlertRef.current = !showAlertRef.current;
          applyTitle(showAlertRef.current);
        }, 1200);
      } else {
        stopBlink();
        applyTitle(true);
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    onVisibility();

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      stopBlink();
      document.title = BASE_TITLE;
    };
  }, [loggedIn, snap]);

  return null;
}
