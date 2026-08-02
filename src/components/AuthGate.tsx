"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getCurrentUser, getSessionUserId } from "@/lib/auth";
import { seedDemoDataIfNeeded } from "@/lib/seedDemo";
import { createClient } from "@/lib/supabase/client";

/** 로그인 없이 볼 수 있는 경로 */
const PUBLIC_PATHS = ["/", "/login", "/signup", "/terms", "/about"];

/** React 트리 노드를 remove() 하면 insertBefore 오류가 나므로 숨기기만 함 */
function hideBootSplash() {
  const el = document.getElementById("boot-splash");
  if (!el) return;
  el.classList.add("boot-splash-done");
  el.setAttribute("aria-hidden", "true");
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  /** 최초 부팅이 끝난 뒤에는 브랜드 스플래시를 다시 띄우지 않음 */
  const [booted, setBooted] = useState(false);
  const [sessionKey, setSessionKey] = useState("guest");

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
          void seedDemoDataIfNeeded().catch(() => undefined);
          if (cancelled) return;
          router.replace("/");
          return;
        }

        if (user) {
          void seedDemoDataIfNeeded().catch(() => undefined);
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
    setBooted(true);
    hideBootSplash();
  }, [ready, booted]);

  // 최초 부팅 중: children은 마운트하되 보이지 않게 (null 반환 시 트리 깨짐 방지)
  if (!ready && !booted) {
    return <div className="invisible h-0 overflow-hidden">{children}</div>;
  }

  // 계정(세션)이 바뀌면 트리 전체를 리마운트해 화면 캐시 차단
  return <div key={sessionKey}>{children}</div>;
}
