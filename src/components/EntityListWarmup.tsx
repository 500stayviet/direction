"use client";

import { useEffect, useRef } from "react";
import {
  getAuthEpoch,
  peekCurrentUser,
  subscribeAuthChange,
} from "@/lib/auth";
import { refreshAllEntityLists } from "@/lib/storage";

/** auth 준비 후 리스트 1회 워밍 — 빠른 탭 진입 시 fetch 실패 줄임 */
export function EntityListWarmup() {
  const lastEpoch = useRef(
    typeof window === "undefined" ? 0 : getAuthEpoch()
  );

  useEffect(() => {
    const warm = () => {
      if (!peekCurrentUser()?.id) return;
      void refreshAllEntityLists();
    };

    warm();

    return subscribeAuthChange(() => {
      const epoch = getAuthEpoch();
      if (epoch === lastEpoch.current) return;
      lastEpoch.current = epoch;
      warm();
    });
  }, []);

  return null;
}
