"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getCurrentUser, getSessionUserId, BOOT_SPLASH_DONE_KEY, peekCurrentUser } from "@/lib/auth";
import { seedDemoDataIfNeeded } from "@/lib/seedDemo";
import { createClient } from "@/lib/supabase/client";

/** 로그인 없이 볼 수 있는 경로 */
const PUBLIC_PATHS = ["/", "/login", "/signup", "/terms", "/about", "/admin"];

/** 앱 세션 갱신·데모 시드가 필요 없는 경로 */
function skipAppSessionWork(pathname: string) {
  return (
    pathname.startsWith("/admin") ||
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname.startsWith("/login/") ||
    pathname.startsWith("/signup/")
  );
}

function isPublicPath(path: string) {
  return PUBLIC_PATHS.some(
    (p) => path === p || (p !== "/" && path.startsWith(`${p}/`))
  );
}

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

    const loadSession = async () => {
      const path = window.location.pathname;
      const light = skipAppSessionWork(path);

      try {
        // 최초 부팅·세션 변경만 전체 조회. 경로 이동은 peek만 쓴다.
        const user = light ? peekCurrentUser() : await getCurrentUser();
        const sid = light
          ? peekCurrentUser()?.id ?? "guest"
          : (await getSessionUserId()) ?? "guest";
        if (cancelled) return;
        setSessionKey(sid);

        const currentPath = window.location.pathname;
        const currentPublic = isPublicPath(currentPath);

        if (!user && !currentPublic) {
          router.replace("/");
          setReady(true);
          return;
        }

        if (user && (currentPath === "/login" || currentPath === "/signup")) {
          await seedDemoDataIfNeeded().catch(() => undefined);
          if (cancelled) return;
          router.replace("/");
          setReady(true);
          return;
        }

        if (user && !light) {
          await seedDemoDataIfNeeded().catch(() => undefined);
        }
        if (cancelled) return;
        setReady(true);
      } catch {
        if (cancelled) return;
        if (!isPublicPath(window.location.pathname)) {
          router.replace("/");
        }
        setReady(true);
      }
    };

    void loadSession();

    let unsubscribe = () => {};
    try {
      const supabase = createClient();
      const { data } = supabase.auth.onAuthStateChange(() => {
        void loadSession();
      });
      unsubscribe = () => data.subscription.unsubscribe();
    } catch {
      /* env 미설정 시 공개 페이지만 */
    }

    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      const path = window.location.pathname;
      if (skipAppSessionWork(path)) return;
      void getCurrentUser();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      unsubscribe();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router]);

  // 세션이 준비된 뒤 경로만 바뀌면 저장소 peek로 가드 (getCurrentUser 재호출 없음)
  useEffect(() => {
    if (!ready) return;
    const user = peekCurrentUser();
    if (!user && !isPublicPath(pathname)) {
      router.replace("/");
      return;
    }
    if (user && (pathname === "/login" || pathname === "/signup")) {
      router.replace("/");
    }
  }, [pathname, ready, router]);

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

  // 로그인·가입은 스플래시/부팅 게이트 없이 즉시 표시 (폼 입력 가능)
  if (isAuthPath(pathname)) {
    return <div key={sessionKey}>{children}</div>;
  }

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
