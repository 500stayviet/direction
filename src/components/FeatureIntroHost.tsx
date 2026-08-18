"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { FeatureIntroModal } from "@/components/FeatureIntroModal";
import {
  getAuthEpoch,
  peekCurrentUser,
  subscribeAuthChange,
} from "@/lib/auth";
import {
  hideFeatureIntroForever,
  shouldOpenFeatureIntroOnHome,
} from "@/lib/featureIntro";

/** 탭 이동·앱 복귀에도 홈이면 다시 연다. 다시 보지 않기만 영구 숨김. */
export function FeatureIntroHost() {
  const pathname = usePathname();
  const epoch = useSyncExternalStore(
    subscribeAuthChange,
    getAuthEpoch,
    () => 0
  );
  void epoch;
  const user = peekCurrentUser();
  const userId = user?.id;
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(shouldOpenFeatureIntroOnHome(pathname, userId));
  }, [pathname, userId]);

  useEffect(() => {
    if (!shouldOpenFeatureIntroOnHome(pathname, userId)) return;
    const resume = () => {
      if (document.visibilityState !== "visible") return;
      if (shouldOpenFeatureIntroOnHome(pathname, userId)) setOpen(true);
    };
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("pageshow", resume);
    return () => {
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("pageshow", resume);
    };
  }, [pathname, userId]);

  if (!userId) return null;

  return (
    <FeatureIntroModal
      open={open}
      onClose={() => setOpen(false)}
      onHideForever={() => {
        hideFeatureIntroForever(userId);
        setOpen(false);
      }}
    />
  );
}
