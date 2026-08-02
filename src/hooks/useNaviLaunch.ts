"use client";

import { useCallback, useState } from "react";
import { getNaviPreference } from "@/lib/storage";
import { openNavi, openSystemNavi, toNaviAddress } from "@/lib/navi";

export function useNaviLaunch() {
  const [pendingAddress, setPendingAddress] = useState<string | null>(null);

  /** 기본: 폰 설정(geo:). 특정 앱을 '항상' 저장한 경우만 그 앱으로 */
  const launch = useCallback((address: string) => {
    const query = toNaviAddress(address);
    if (!query) return;
    void getNaviPreference().then((pref) => {
      if (pref?.remember && pref.app && pref.app !== "system") {
        void openNavi(pref.app, query);
        return;
      }
      void openSystemNavi(query);
    });
  }, []);

  /** 앱을 직접 고르고 싶을 때 모달 열기 */
  const launchWithPicker = useCallback((address: string) => {
    const query = toNaviAddress(address);
    if (!query) return;
    setPendingAddress(query);
  }, []);

  const closeModal = useCallback(() => setPendingAddress(null), []);

  return {
    launch,
    launchWithPicker,
    pendingAddress,
    modalOpen: !!pendingAddress,
    closeModal,
  };
}
