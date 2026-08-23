"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { Card } from "@/components/ui/Card";
import {
  getWebNotificationPermission,
  requestWebNotificationPermission,
} from "@/lib/webNotifications";
import { isIosSafari, isStandalonePwa, pushEnvReady } from "@/lib/pwaDetect";
import { subscribeWebPush, unsubscribeWebPush } from "@/lib/pushClient";
import {
  getAuthEpoch,
  peekCurrentUser,
  subscribeAuthChange,
} from "@/lib/auth";

function useUserId(): string | null {
  const epoch = useSyncExternalStore(
    subscribeAuthChange,
    getAuthEpoch,
    () => 0
  );
  return peekCurrentUser()?.id ?? null;
}

function prefKey(userId: string) {
  return `realty_account_notif:${userId}`;
}

function readPrefOn(userId: string, perm: NotificationPermission | "unsupported") {
  try {
    const raw = localStorage.getItem(prefKey(userId));
    if (raw === "0") return false;
    if (raw === "1") return perm === "granted";
  } catch {
    /* ignore */
  }
  return perm === "granted";
}

function writePref(userId: string, on: boolean) {
  try {
    localStorage.setItem(prefKey(userId), on ? "1" : "0");
  } catch {
    /* ignore */
  }
}

/** 계정 화면 — 알림 켜기/끄기 (팀 공유 아래 한 줄) */
export function AccountNotificationSettings() {
  const userId = useUserId();
  const [busy, setBusy] = useState(false);
  const [perm, setPerm] = useState(() => getWebNotificationPermission());
  const [, setPrefTick] = useState(0);

  const refresh = useCallback(() => {
    setPerm(getWebNotificationPermission());
    setPrefTick((n) => n + 1);
  }, []);

  if (!userId) return null;

  const needsPwa = isIosSafari() && !isStandalonePwa();
  const on = readPrefOn(userId, perm);

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (on) {
        await unsubscribeWebPush();
        writePref(userId, false);
        refresh();
        return;
      }
      if (needsPwa) {
        writePref(userId, false);
        refresh();
        return;
      }
      const next = await requestWebNotificationPermission();
      setPerm(next);
      if (next === "granted") {
        if (pushEnvReady()) await subscribeWebPush(userId);
        writePref(userId, true);
      } else {
        writePref(userId, false);
      }
      refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="!p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[14px] font-bold text-gray-900">알림</p>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="알림"
          disabled={busy}
          onClick={() => void toggle()}
          className={[
            "relative h-7 w-12 shrink-0 rounded-full transition-colors duration-150 disabled:opacity-50",
            on ? "bg-[#03B26C]" : "bg-red-500",
          ].join(" ")}
        >
          <span
            className={[
              "absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition-transform duration-150",
              on ? "left-0.5 translate-x-5" : "left-0.5 translate-x-0",
            ].join(" ")}
          />
        </button>
      </div>
    </Card>
  );
}
