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

/** 탭 이동·앱 복귀에도 홈이면 다시 연다. 「일주일간 보지 않기」는 1주일 숨김. */
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
  // epoch: 업장명 보정처럼 같은 세션을 고쳐도 다시 그림. 첫 화면은 null로 SSR과 맞춤
  void epoch;
  const userId = user?.id;
  const [open, setOpen] = useState(false);
  const closedThisVisit = useRef(false);

  useEffect(() => {
    closedThisVisit.current = false;
  }, [pathname]);

  useEffect(() => {
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
