"use client";

import { useEffect } from "react";

type WakeLockSentinel = {
  released: boolean;
  release: () => Promise<void>;
  addEventListener: (
    type: "release",
    listener: () => void
  ) => void;
  removeEventListener: (
    type: "release",
    listener: () => void
  ) => void;
};

type WakeLockNavigator = Navigator & {
  wakeLock?: {
    request: (type: "screen") => Promise<WakeLockSentinel>;
  };
};

const DEFAULT_APP_WAKE_MS = 10 * 60 * 1000;

/**
 * 화면이 보이는 동안 슬립(꺼짐)을 막는다.
 * maxMs가 있으면 그 시간 후 해제(기본 앱 전체 10분). 미지원·거절은 무시.
 */
export function useScreenWakeLock(
  active: boolean,
  opts?: { maxMs?: number | null }
) {
  const maxMs = opts?.maxMs;
  useEffect(() => {
    if (!active || typeof navigator === "undefined") return;
    const wakeLockApi = (navigator as WakeLockNavigator).wakeLock;
    if (!wakeLockApi?.request) return;

    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    let deadline =
      maxMs == null || maxMs <= 0 ? Number.POSITIVE_INFINITY : Date.now() + maxMs;
    let expireTimer: ReturnType<typeof setTimeout> | null = null;

    const clearExpireTimer = () => {
      if (expireTimer != null) {
        clearTimeout(expireTimer);
        expireTimer = null;
      }
    };

    const releaseLock = () => {
      clearExpireTimer();
      const current = lock;
      lock = null;
      if (current) {
        current.removeEventListener("release", onRelease);
        if (!current.released) void current.release();
      }
    };

    const scheduleExpire = () => {
      clearExpireTimer();
      if (!Number.isFinite(deadline)) return;
      const wait = deadline - Date.now();
      if (wait <= 0) {
        releaseLock();
        return;
      }
      expireTimer = setTimeout(() => {
        expireTimer = null;
        releaseLock();
      }, wait);
    };

    const onRelease = () => {
      lock = null;
      if (
        !cancelled &&
        document.visibilityState === "visible" &&
        Date.now() < deadline
      ) {
        void acquire();
      }
    };

    const acquire = async () => {
      if (cancelled || document.visibilityState !== "visible") return;
      if (Date.now() >= deadline) return;
      try {
        if (lock && !lock.released) {
          scheduleExpire();
          return;
        }
        const next = await wakeLockApi.request("screen");
        if (cancelled || Date.now() >= deadline) {
          void next.release();
          return;
        }
        lock = next;
        lock.addEventListener("release", onRelease);
        scheduleExpire();
      } catch {
        lock = null;
      }
    };

    const onVisibility = () => {
      if (document.visibilityState !== "visible") {
        releaseLock();
        return;
      }
      // 다시 앱으로 돌아오면 제한 시간 갱신
      if (maxMs != null && maxMs > 0) {
        deadline = Date.now() + maxMs;
      }
      void acquire();
    };

    void acquire();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      releaseLock();
    };
  }, [active, maxMs]);
}

/** 앱 전체: 보이는 동안 최대 약 10분만 화면 유지 */
export function useAppScreenWakeLock() {
  useScreenWakeLock(true, { maxMs: DEFAULT_APP_WAKE_MS });
}
