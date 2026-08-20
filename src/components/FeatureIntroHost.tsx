"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { FeatureIntroModal } from "@/components/FeatureIntroModal";
import {
  getAuthEpoch,
  peekCurrentUser,
  subscribeAuthChange,
} from "@/lib/auth";
import {
  shouldOpenFeatureIntroOnHome,
  snoozeFeatureIntro,
} from "@/lib/featureIntro";

/** 홈: 기능 안내. 「일주일간 보지 않기」는 1주일 숨김. */
export function FeatureIntroHost() {
  const pathname = usePathname();
  const epoch = useSyncExternalStore(
    subscribeAuthChange,
    getAuthEpoch,
    () => 0
  );
  const user = useSyncExternalStore(
    subscribeAuthChange,
    peekCurrentUser,
    () => null
  );
  void epoch;
  const userId = user?.id;
  const [open, setOpen] = useState(false);
  const closedThisVisit = useRef(false);

  useEffect(() => {
    closedThisVisit.current = false;
  }, [pathname]);

  useEffect(() => {
    if (pathname !== "/" || !userId) {
      setOpen(false);
      return;
    }

    const shouldOpen =
      shouldOpenFeatureIntroOnHome(pathname, userId) && !closedThisVisit.current;
    setOpen(shouldOpen);
    if (!shouldOpenFeatureIntroOnHome(pathname, userId)) return;
    const resume = () => {
      if (document.visibilityState !== "visible") return;
      if (closedThisVisit.current) return;
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
      onClose={() => {
        closedThisVisit.current = true;
        setOpen(false);
      }}
      onSnooze={() => {
        snoozeFeatureIntro(userId);
        closedThisVisit.current = true;
        setOpen(false);
      }}
    />
  );
}
