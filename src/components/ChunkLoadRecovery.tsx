"use client";

import { useEffect } from "react";

const RELOAD_KEY = "realty_chunk_reload_once";

function isChunkLoadError(err: unknown): boolean {
  if (!err) return false;
  if (err instanceof Error) {
    const name = err.name || "";
    const msg = err.message || "";
    return (
      name === "ChunkLoadError" ||
      /Loading chunk [\w-]+ failed/i.test(msg) ||
      /Failed to load chunk/i.test(msg) ||
      /ChunkLoadError/i.test(msg)
    );
  }
  if (typeof err === "string") {
    return /Failed to load chunk|ChunkLoadError/i.test(err);
  }
  return false;
}

/**
 * Turbopack/HMR 후 오래된 청크 URL을 받을 때 1회 새로고침으로 복구.
 * 복구 직후 수 초간은 재시도하지 않아 무한 리로드를 막음.
 */
export function ChunkLoadRecovery() {
  useEffect(() => {
    const clearTimer = window.setTimeout(() => {
      try {
        sessionStorage.removeItem(RELOAD_KEY);
      } catch {
        /* ignore */
      }
    }, 4000);

    const reloadOnce = () => {
      try {
        if (sessionStorage.getItem(RELOAD_KEY) === "1") return;
        sessionStorage.setItem(RELOAD_KEY, "1");
      } catch {
        /* private mode */
      }
      window.location.reload();
    };

    const onError = (event: ErrorEvent) => {
      if (isChunkLoadError(event.error) || isChunkLoadError(event.message)) {
        reloadOnce();
      }
    };

    const onRejection = (event: PromiseRejectionEvent) => {
      if (isChunkLoadError(event.reason)) {
        reloadOnce();
      }
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.clearTimeout(clearTimer);
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
