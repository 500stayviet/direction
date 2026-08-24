"use client";

import { useEffect, useRef } from "react";
import {
  getAccessToken,
  getAuthEpoch,
  peekCurrentUser,
  subscribeAuthChange,
} from "@/lib/auth";
import {
  peekCustomers,
  peekProperties,
  peekSchedules,
} from "@/lib/entityCache";
import { refreshAllEntityLists } from "@/lib/storage";

function entityCacheReady(): boolean {
  return (
    peekCustomers() !== null &&
    peekProperties() !== null &&
    peekSchedules() !== null
  );
}

/** auth·토큰 준비 후 리스트 워밍 — 캐시 없을 때만 fetch */
export function EntityListWarmup() {
  const lastEpoch = useRef(
    typeof window === "undefined" ? 0 : getAuthEpoch()
  );

  useEffect(() => {
    const warm = async () => {
      const user = peekCurrentUser();
      if (!user?.id) return;
      if (entityCacheReady()) return;
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
