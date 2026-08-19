"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { FeatureIntroModal } from "@/components/FeatureIntroModal";
import { Modal } from "@/components/ui/Modal";
import {
  getAuthEpoch,
  peekCurrentUser,
  subscribeAuthChange,
} from "@/lib/auth";
import {
  shouldOpenFeatureIntroOnHome,
  snoozeFeatureIntro,
} from "@/lib/featureIntro";
import {
  clearSignupWelcomePending,
  isSignupWelcomePending,
} from "@/lib/signupWelcome";

function SignupWelcomeModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      position="center"
      dense
      className="!max-h-[min(100dvh-32px,fit-content)] !w-[min(100%,336px)] !max-w-[336px] overflow-hidden !px-3.5 !pb-3 !pt-3.5"
    >
      <p className="text-center text-[13px] font-bold tracking-tight text-[#3182F6]">
        현장동선
      </p>
      <h2 className="mt-1 text-center text-[18px] font-bold leading-snug tracking-tight text-gray-900">
        회원가입이 완료되었습니다
      </h2>
      <p className="mt-2 text-center text-[13px] font-medium leading-relaxed text-gray-500">
        홈에서 고객·매물을 바로 등록해 보세요.
      </p>
      <button
        type="button"
        onClick={onClose}
        className="mt-4 flex h-10 w-full items-center justify-center rounded-full bg-[#3182F6] text-[14px] font-bold text-white shadow-sm active:scale-[0.98] transition-all duration-150"
      >
        확인
      </button>
    </Modal>
  );
}

/** 홈: 가입 완료 → 기능 안내. 「일주일간 보지 않기」는 1주일 숨김. */
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
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const closedThisVisit = useRef(false);
  const welcomeClosedThisVisit = useRef(false);

  useEffect(() => {
    closedThisVisit.current = false;
    welcomeClosedThisVisit.current = false;
  }, [pathname]);

  useEffect(() => {
    if (pathname !== "/" || !userId) {
      setWelcomeOpen(false);
      setOpen(false);
      return;
    }

    const showWelcome =
      isSignupWelcomePending() && !welcomeClosedThisVisit.current;
    if (showWelcome) {
      setWelcomeOpen(true);
      setOpen(false);
      return;
    }

    const shouldOpen =
      shouldOpenFeatureIntroOnHome(pathname, userId) && !closedThisVisit.current;
    setWelcomeOpen(false);
    setOpen(shouldOpen);
    if (!shouldOpenFeatureIntroOnHome(pathname, userId)) return;
    const resume = () => {
      if (document.visibilityState !== "visible") return;
      if (closedThisVisit.current) return;
      if (isSignupWelcomePending() && !welcomeClosedThisVisit.current) return;
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
    <>
      <SignupWelcomeModal
        open={welcomeOpen}
        onClose={() => {
          clearSignupWelcomePending();
          welcomeClosedThisVisit.current = true;
          setWelcomeOpen(false);
          if (
            shouldOpenFeatureIntroOnHome(pathname, userId) &&
            !closedThisVisit.current
          ) {
            setOpen(true);
          }
        }}
      />
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
    </>
  );
}
