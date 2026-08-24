"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import {
  ACCOUNT_STATUS_SYNC_MIN_MS,
  getCachedUser,
  peekAccessTokenIfFresh,
  peekCurrentUser,
  refreshSuspendedFromServer,
  subscribeAuthChange,
} from "@/lib/auth";

/** 정지 계정에서도 허용하는 경로 */
const ALLOWED_WHEN_SUSPENDED = ["/", "/terms", "/about", "/login", "/signup"];

/** 앱 정지 게이트를 돌리지 않음 (관리자·인증 화면) */
function skipSuspendedGate(pathname: string) {
  return (
    pathname.startsWith("/admin") ||
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname.startsWith("/login/") ||
    pathname.startsWith("/signup/")
  );
}

type SuspendedCtx = {
  suspended: boolean;
  reason: string;
  blockOrExplain: () => boolean;
};

const Ctx = createContext<SuspendedCtx>({
  suspended: false,
  reason: "",
  blockOrExplain: () => false,
});

export function useAccountSuspended() {
  return useContext(Ctx);
}

function isAllowedPath(pathname: string) {
  return ALLOWED_WHEN_SUSPENDED.some(
    (p) => pathname === p || (p !== "/" && pathname.startsWith(`${p}/`))
  );
}

export function AccountSuspendedGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const gateOff = skipSuspendedGate(pathname);
  const [suspended, setSuspended] = useState(
    () => Boolean(peekCurrentUser()?.suspended)
  );
  const [reason, setReason] = useState(
    () => peekCurrentUser()?.suspendedReason ?? ""
  );
  const [modalOpen, setModalOpen] = useState(false);
  const lastSyncAtRef = useRef(0);
  const hadUserRef = useRef(Boolean(peekCurrentUser()));

  const applyStatus = useCallback(
    (next: { suspended: boolean; reason: string }) => {
      setSuspended(next.suspended);
      setReason(next.reason);
    },
    []
  );

  const sync = useCallback(
    async (force = false) => {
      if (skipSuspendedGate(pathname)) return;

      const now = Date.now();
      if (!force && now - lastSyncAtRef.current < ACCOUNT_STATUS_SYNC_MIN_MS) {
        return;
      }

      const peeked = peekCurrentUser() ?? getCachedUser();
      if (!peeked) {
        applyStatus({ suspended: false, reason: "" });
        return;
      }

      const token = peekAccessTokenIfFresh();
      if (!token) {
        applyStatus({
          suspended: Boolean(peeked.suspended),
          reason: peeked.suspendedReason ?? "",
        });
        return;
      }

      lastSyncAtRef.current = now;
      const status = await refreshSuspendedFromServer(token);
      if (status.deleted) {
        applyStatus({ suspended: false, reason: "" });
        return;
      }
      applyStatus(status);
    },
    [applyStatus, pathname]
  );

  useEffect(() => {
    void sync(true);
    if (gateOff) return;
    const onVis = () => {
      if (document.visibilityState === "visible") void sync(false);
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
    };
  }, [sync, gateOff]);

  useEffect(() => {
    return subscribeAuthChange(() => {
      const user = peekCurrentUser();
      if (!user) {
        hadUserRef.current = false;
        lastSyncAtRef.current = 0;
        applyStatus({ suspended: false, reason: "" });
        return;
      }
      if (!hadUserRef.current) {
        hadUserRef.current = true;
        void sync(true);
      }
    });
  }, [applyStatus, sync]);

  useEffect(() => {
    if (gateOff) return;
    if (!suspended) return;
    if (isAllowedPath(pathname)) return;
    router.replace("/");
    setModalOpen(true);
  }, [suspended, pathname, router, gateOff]);

  const blockOrExplain = useCallback(() => {
    if (gateOff || !suspended) return false;
    setModalOpen(true);
    return true;
  }, [suspended, gateOff]);

  const value = useMemo(
    () => ({
      suspended: gateOff ? false : suspended,
      reason: gateOff ? "" : reason,
      blockOrExplain,
    }),
    [suspended, reason, blockOrExplain, gateOff]
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <Modal
        open={!gateOff && modalOpen}
        onClose={() => setModalOpen(false)}
        title="계정 이용 제한"
        description="관리자에게 문의해 주세요."
        dense
      >
        <div className="space-y-3">
          <p className="text-[14px] leading-relaxed text-gray-700">
            현재 계정이 정지되어 홈 외 기능을 이용할 수 없습니다.
            관리자에게 문의하시길 바랍니다.
          </p>
          {reason ? (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-[13px] font-semibold text-red-600">
              사유: {reason}
            </p>
          ) : null}
          <p className="text-[12px] text-gray-500">
            문의: bek94900@gmail.com
          </p>
          <Button fullWidth onClick={() => setModalOpen(false)}>
            확인
          </Button>
        </div>
      </Modal>
    </Ctx.Provider>
  );
}
