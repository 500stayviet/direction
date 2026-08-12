"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getCurrentUser, getSessionUserId, BOOT_SPLASH_DONE_KEY } from "@/lib/auth";
import { seedDemoDataIfNeeded } from "@/lib/seedDemo";
import { createClient } from "@/lib/supabase/client";

/** 로그인 없이 볼 수 있는 경로 */
const PUBLIC_PATHS = ["/", "/login", "/signup", "/terms", "/about"];

/** 앱 실행 시 브랜드 스플래시 최소 노출 (너무 빨리 사라지지 않게) */
const BOOT_SPLASH_MIN_MS = 1400;

function wasSplashDoneThisSession(): boolean {
  try {
    return sessionStorage.getItem(BOOT_SPLASH_DONE_KEY) === "1";
  } catch {
    return false;
  }
}

function markSplashDone() {
  try {
    sessionStorage.setItem(BOOT_SPLASH_DONE_KEY, "1");
  } catch {
    /* ignore */
  }
}

/** React 트리 노드를 remove() 하면 insertBefore 오류가 나므로 숨기기만 함 */
function hideBootSplash() {
  const el = document.getElementById("boot-splash");
  if (!el) return;
  el.classList.add("boot-splash-done");
  el.setAttribute("aria-hidden", "true");
  markSplashDone();
}

function isAuthPath(pathname: string): boolean {
  return pathname === "/login" || pathname === "/signup";
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  /** 최초 부팅이 끝난 뒤·같은 탭 재진입 시에는 스플래시 생략 */
  const [booted, setBooted] = useState(false);
  const [sessionKey, setSessionKey] = useState("guest");
  const splashShownAt = useRef(Date.now());
  const skipSplash = useRef(false);
  const initialPath = useRef(pathname);
  /** 이 문서 로드 시점에 이미 스플래시를 본 탭인지 (시각 대기 생략용) */
  const alreadyDoneOnLoad = useRef(wasSplashDoneThisSession());

  useEffect(() => {
    if (alreadyDoneOnLoad.current || isAuthPath(initialPath.current)) {
      skipSplash.current = true;
      hideBootSplash();
      setBooted(true);
      return;
    }
    // 이번 탭 첫 실행: 바로 '완료'로 표시해 로그인/새로고침 때 재표시 방지
    // (화면 스플래시는 아래 타이머로 최소 시간 유지)
    markSplashDone();
  }, []);

  // 스플래시 중에 로그인 등으로 이동하면 즉시 종료
  useEffect(() => {
    if (booted) return;
    if (pathname !== initialPath.current || isAuthPath(pathname)) {
      skipSplash.current = true;
      hideBootSplash();
      setBooted(true);
    }
  }, [pathname, booted]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const publicPage = PUBLIC_PATHS.some(
        (p) => pathname === p || (p !== "/" && pathname.startsWith(`${p}/`))
      );

      try {
        const user = await getCurrentUser();
        const sid = (await getSessionUserId()) ?? "guest";
        if (cancelled) return;
        setSessionKey(sid);

        if (!user && !publicPage) {
          router.replace("/");
          return;
        }

        if (user && (pathname === "/login" || pathname === "/signup")) {
          await seedDemoDataIfNeeded().catch(() => undefined);
          if (cancelled) return;
          router.replace("/");
          return;
        }

        if (user) {
          await seedDemoDataIfNeeded().catch(() => undefined);
        }
        if (cancelled) return;
        setReady(true);
      } catch {
        if (cancelled) return;
        if (!publicPage) {
          router.replace("/");
          return;
        }
        setReady(true);
      }
    };

    void run();

    let unsubscribe = () => {};
    try {
      const supabase = createClient();
      const { data } = supabase.auth.onAuthStateChange(() => {
        void run();
      });
      unsubscribe = () => data.subscription.unsubscribe();
    } catch {
      /* env 미설정 시 공개 페이지만 */
    }

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [pathname, router]);

  useEffect(() => {
    if (!ready || booted) return;

    if (skipSplash.current || alreadyDoneOnLoad.current || isAuthPath(pathname)) {
      hideBootSplash();
      setBooted(true);
      return;
    }

    const elapsed = Date.now() - splashShownAt.current;
    const wait = Math.max(0, BOOT_SPLASH_MIN_MS - elapsed);
    const timer = window.setTimeout(() => {
      setBooted(true);
      hideBootSplash();
    }, wait);

    return () => window.clearTimeout(timer);
  }, [ready, booted, pathname]);

  // 최초 부팅 중: children은 마운트하되 보이지 않게 (null 반환 시 트리 깨짐 방지)
  if (!ready && !booted) {
    return <div className="invisible h-0 overflow-hidden">{children}</div>;
  }

  // 아직 스플래시 최소 시간 — 화면은 가리고 스플래시(#boot-splash)만 보이게
  if (ready && !booted) {
    return <div className="invisible h-0 overflow-hidden">{children}</div>;
  }

  // 계정(세션)이 바뀌면 트리 전체를 리마운트해 화면 캐시 차단
  return <div key={sessionKey}>{children}</div>;
}
