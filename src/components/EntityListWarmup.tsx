"use client";

import { useEffect, useRef } from "react";
import {
  getAccessToken,
  getAuthEpoch,
  peekCurrentUser,
  subscribeAuthChange,
} from "@/lib/auth";
import { refreshAllEntityLists } from "@/lib/storage";

/** auth·토큰 준비 후 리스트 워밍 — 빠른 탭 진입 시 fetch 실패 줄임 */
export function EntityListWarmup() {
  const lastEpoch = useRef(
    typeof window === "undefined" ? 0 : getAuthEpoch()
  );

  useEffect(() => {
    const warm = async () => {
      const user = peekCurrentUser();
      if (!user?.id) return;
      const token = await getAccessToken();
      if (!token) return;
      await refreshAllEntityLists();
    };

    void warm();

    return subscribeAuthChange(() => {
      const epoch = getAuthEpoch();
      if (epoch === lastEpoch.current) return;
      lastEpoch.current = epoch;
      void warm();
    });
  }, []);

  return null;
}
