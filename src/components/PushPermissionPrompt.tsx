"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { InstallAppGuide } from "@/components/InstallAppGuide";
import { FEATURE_INTRO_CLOSED_EVENT, shouldOpenFeatureIntroOnHome } from "@/lib/featureIntro";
import {
  getAuthEpoch,
  peekCurrentUser,
  subscribeAuthChange,
} from "@/lib/auth";
import {
  isIosSafari,
  isStandalonePwa,
  pushEnvReady,
} from "@/lib/pwaDetect";
import {
  markWebNotificationPromptSeen,
  requestWebNotificationPermission,
  shouldShowWebNotificationPrompt,
} from "@/lib/webNotifications";
import { subscribeWebPush } from "@/lib/pushClient";
import { clearNotifiedPairs } from "@/lib/notifiedPairsLocal";

function useAuthUserId(): string | null {
  const epoch = useSyncExternalStore(
    subscribeAuthChange,
    getAuthEpoch,
    () => 0
  );
  return peekCurrentUser()?.id ?? null;
}

/** 알림 허용 안내 — 가입·로그인 후. PWA·웹 분기 */
export function PushPermissionPrompt() {
  const pathname = usePathname();
  const userId = useAuthUserId();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (pathname.startsWith("/admin")) {
      setOpen(false);
      return;
    }
    if (!userId) {
      setOpen(false);
      return;
    }

    const tryOpen = () => {
      if (!shouldShowWebNotificationPrompt(userId)) {
        setOpen(false);
        return;
      }
      setOpen(true);
    };

    if (pathname === "/" && shouldOpenFeatureIntroOnHome(pathname, userId)) {
      setOpen(false);
      const onFeatureIntroClosed = () => tryOpen();
      window.addEventListener(FEATURE_INTRO_CLOSED_EVENT, onFeatureIntroClosed);
      return () =>
        window.removeEventListener(
          FEATURE_INTRO_CLOSED_EVENT,
          onFeatureIntroClosed
        );
    }

    tryOpen();
  }, [pathname, userId]);

  if (!userId || pathname.startsWith("/admin")) return null;

  const needsPwaFirst = isIosSafari() && !isStandalonePwa();

  const onLater = () => {
    markWebNotificationPromptSeen(userId);
    setOpen(false);
  };

  const onAllow = async () => {
    setBusy(true);
    try {
      const perm = await requestWebNotificationPermission();
      if (perm === "granted") {
        clearNotifiedPairs(userId);
        if (pushEnvReady() && (isStandalonePwa() || !isIosSafari())) {
          await subscribeWebPush(userId);
        }
      } else {
        markWebNotificationPromptSeen(userId);
      }
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      title="매칭되면 알려 드릴까요?"
      onClose={onLater}
      position="center"
      dense
      showClose
    >
      <div className="space-y-3 text-[13px] leading-relaxed text-gray-600">
        {needsPwaFirst ? (
          <>
            <p>
              아이폰은 <strong className="text-gray-900">홈 화면에 추가</strong>한 뒤
              알림에서 <strong className="text-gray-900">허용</strong>을 눌러 주세요.
              차단하면 매칭 알림이 오지 않습니다.
            </p>
            <InstallAppGuide />
          </>
        ) : (
          <p>
            고객·매물이 맞으면 앱을 안 봐도 알려 드립니다. 다음 창에서는{" "}
            <strong className="text-gray-900">허용만</strong> 누르세요.{" "}
            <strong className="text-gray-900">차단하면 매칭 알림이 오지 않습니다.</strong>
          </p>
        )}
        {!pushEnvReady() ? (
          <p className="text-[12px] text-gray-400">
            앱 안 배지·탭 제목 알림은 지금 바로 사용됩니다. 밖에서 오는 푸시는
            서버 VAPID 설정 후 활성화됩니다.
          </p>
        ) : null}
        <div className="flex gap-2 pt-1">
          <Button fullWidth variant="secondary" disabled={busy} onClick={onLater}>
            나중에
          </Button>
          <Button
            fullWidth
            disabled={busy || needsPwaFirst}
            onClick={() => void onAllow()}
          >
            {busy ? "설정 중…" : "알림 허용"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
