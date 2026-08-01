"use client";

import { useCallback, useState } from "react";
import { getNaviPreference } from "@/lib/storage";
import { openNavi, toNaviAddress } from "@/lib/navi";

export function useNaviLaunch() {
  const [pendingAddress, setPendingAddress] = useState<string | null>(null);

  const launch = useCallback((address: string) => {
    const query = toNaviAddress(address);
    if (!query) return;
    const pref = getNaviPreference();
    if (pref?.remember) {
      openNavi(pref.app, query);
      return;
    }
    setPendingAddress(query);
  }, []);

  const closeModal = useCallback(() => setPendingAddress(null), []);

  return {
    launch,
    pendingAddress,
    modalOpen: !!pendingAddress,
    closeModal,
  };
}
