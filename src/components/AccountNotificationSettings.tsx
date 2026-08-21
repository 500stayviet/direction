"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { InstallAppGuide } from "@/components/InstallAppGuide";
import {
  getWebNotificationPermission,
  requestWebNotificationPermission,
} from "@/lib/webNotifications";
import {
  isIosSafari,
  isStandalonePwa,
  pushEnvReady,
} from "@/lib/pwaDetect";
import { subscribeWebPush, unsubscribeWebPush } from "@/lib/pushClient";
import {
  getAuthEpoch,
  peekCurrentUser,
  subscribeAuthChange,
} from "@/lib/auth";

function useUserId(): string | null {
  const epoch = useSyncExternalStore(
    subscribeAuthChange,
    getAuthEpoch,
    () => 0
  );
  return peekCurrentUser()?.id ?? null;
}

/** 계정 화면 — 알림·푸시 설정 */
export function AccountNotificationSettings() {
  const userId = useUserId();
  const [busy, setBusy] = useState(false);
  const [perm, setPerm] = useState(() => getWebNotificationPermission());

  const refreshPerm = useCallback(() => {
    setPerm(getWebNotificationPermission());
  }, []);

  if (!userId) return null;

  const needsPwa = isIosSafari() && !isStandalonePwa();
  const pushReady = pushEnvReady();

  const onAllow = async () => {
    setBusy(true);
    try {
      const next = await requestWebNotificationPermission();
      setPerm(next);
      if (next === "granted" && pushReady && !needsPwa) {
        await subscribeWebPush(userId);
      }
    } finally {
      setBusy(false);
    }
  };

  const onDisable = async () => {
    setBusy(true);
    try {
      await unsubscribeWebPush();
      refreshPerm();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="space-y-3 !p-4">
      <div>
        <p className="text-[13px] font-bold text-gray-900">알림</p>
        <p className="mt-1 text-[12px] leading-relaxed text-gray-500">
          앱 안 배지·탭 제목·배ner는 로그인만으로 표시됩니다. 확인(×) 전까지
          알람은 꺼지지 않습니다.
        </p>
      </div>

      {needsPwa ? (
        <InstallAppGuide />
      ) : null}

      <div className="rounded-xl bg-gray-50 px-3 py-2.5 text-[12px] text-gray-600">
        <p>
          브라우저 알림:{" "}
          <strong className="text-gray-900">
            {perm === "granted"
              ? "허용됨"
              : perm === "denied"
                ? "거부됨"
                : perm === "unsupported"
                  ? "미지원"
                  : "미설정"}
          </strong>
        </p>
        {pushReady ? (
          <p className="mt-1">
            밖에서 푸시:{" "}
            <strong className="text-gray-900">
              {perm === "granted" && !needsPwa ? "설정 가능" : "추가 설정 필요"}
            </strong>
          </p>
        ) : (
          <p className="mt-1 text-gray-400">
            서버 VAPID 설정 후 앱 꺼진 상태 푸시가 활성화됩니다.
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {perm !== "granted" && perm !== "unsupported" ? (
          <Button disabled={busy || needsPwa} onClick={() => void onAllow()}>
            알림 허용
          </Button>
        ) : null}
        {perm === "granted" ? (
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => void onDisable()}
          >
            푸시 구독 해제
          </Button>
        ) : null}
        {perm === "denied" ? (
          <p className="text-[11px] leading-relaxed text-gray-400">
            거부된 경우 기기 설정 → 알림에서 「현장동선」을 켜 주세요.
          </p>
        ) : null}
      </div>
    </Card>
  );
}
