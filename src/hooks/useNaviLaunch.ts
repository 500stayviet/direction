"use client";

import { useCallback, useState } from "react";
import { getNaviPreference } from "@/lib/storage";
import {
  NAVI_REMEMBER_ENABLED,
  isNaviAppDisabled,
  openNavi,
  toNaviAddress,
} from "@/lib/navi";

export function useNaviLaunch() {
  const [pendingAddress, setPendingAddress] = useState<string | null>(null);

  const launch = useCallback((address: string) => {
    const query = toNaviAddress(address);
    if (!query) return;
    if (!NAVI_REMEMBER_ENABLED) {
      setPendingAddress(query);
      return;
    }
    void getNaviPreference().then((pref) => {
      if (pref?.remember && pref.app && !isNaviAppDisabled(pref.app)) {
        void openNavi(pref.app, query);
        return;
      }
      setPendingAddress(query);
    });
  }, []);

  const closeModal = useCallback(() => setPendingAddress(null), []);

  return {
    launch,
    pendingAddress,
    modalOpen: !!pendingAddress,
    closeModal,
  };
}
