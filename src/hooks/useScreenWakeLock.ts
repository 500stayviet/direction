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
/** Android 주소창 접힘 등으로 visibility가 잠깐 바뀌는 경우 대비 */
const HIDDEN_RELEASE_DELAY_MS = 800;

/**
 * 화면이 보이는 동안 슬립(꺼짐)을 막는다.
 * maxMs: 마지막 사용(터치 등) 기준 유지 시간. null이면 제한 없음.
 * Android는 제스처 후에야 Wake Lock이 잡히는 경우가 많아 pointer 이벤트에서도 재요청한다.
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
      maxMs == null || maxMs <= 0
        ? Number.POSITIVE_INFINITY
        : Date.now() + maxMs;
    let expireTimer: ReturnType<typeof setTimeout> | null = null;
    let hiddenTimer: ReturnType<typeof setTimeout> | null = null;
    let acquiring = false;

    const clearExpireTimer = () => {
      if (expireTimer != null) {
        clearTimeout(expireTimer);
        expireTimer = null;
      }
    };

    const clearHiddenTimer = () => {
      if (hiddenTimer != null) {
        clearTimeout(hiddenTimer);
        hiddenTimer = null;
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

    const bumpDeadline = () => {
      if (maxMs != null && maxMs > 0) {
        deadline = Date.now() + maxMs;
      }
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
      if (acquiring) return;
      if (lock && !lock.released) {
        scheduleExpire();
        return;
      }
      acquiring = true;
      try {
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
      } finally {
        acquiring = false;
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        clearHiddenTimer();
        bumpDeadline();
        void acquire();
        return;
      }
      clearHiddenTimer();
      hiddenTimer = setTimeout(() => {
        hiddenTimer = null;
        if (document.visibilityState !== "visible") {
          releaseLock();
        }
      }, HIDDEN_RELEASE_DELAY_MS);
    };

    /** 터치·클릭 시 다시 잡고 10분 연장 (Android 제스처 요구 대응) */
    const onInteract = () => {
      if (cancelled || document.visibilityState !== "visible") return;
      bumpDeadline();
      void acquire();
    };

    void acquire();
    document.addEventListener("visibilitychange", onVisibility);
    document.addEventListener("pointerdown", onInteract, { passive: true });
    document.addEventListener("touchstart", onInteract, { passive: true });
    document.addEventListener("keydown", onInteract);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      document.removeEventListener("pointerdown", onInteract);
      document.removeEventListener("touchstart", onInteract);
      document.removeEventListener("keydown", onInteract);
      clearHiddenTimer();
      releaseLock();
    };
  }, [active, maxMs]);
}

/** 앱 전체: 보이는 동안·조작 후 최대 약 10분 화면 유지 */
export function useAppScreenWakeLock() {
  useScreenWakeLock(true, { maxMs: DEFAULT_APP_WAKE_MS });
}
