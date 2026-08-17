"use client";

import { useEffect } from "react";

type WakeLockSentinel = {
  released: boolean;
  release: () => Promise<void>;
};

type WakeLockNavigator = Navigator & {
  wakeLock?: {
    request: (type: "screen") => Promise<WakeLockSentinel>;
  };
};

/** 녹음 중에는 폰 화면이 꺼지지 않게 한다. 미지원·거절은 그냥 넘어간다. */
export function useScreenWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || typeof navigator === "undefined") return;
    const wakeLock = (navigator as WakeLockNavigator).wakeLock;
    if (!wakeLock?.request) return;

    let lock: WakeLockSentinel | null = null;
    let cancelled = false;

    const acquire = async () => {
      if (cancelled || document.visibilityState !== "visible") return;
      try {
        if (lock && !lock.released) return;
        lock = await wakeLock.request("screen");
      } catch {
        lock = null;
      }
    };

    void acquire();
    document.addEventListener("visibilitychange", acquire);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", acquire);
      const current = lock;
      lock = null;
      if (current && !current.released) void current.release();
    };
  }, [active]);
}
