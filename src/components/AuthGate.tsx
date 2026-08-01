"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getCurrentUser, getSessionUserId } from "@/lib/auth";
import { seedDemoDataIfNeeded } from "@/lib/seedDemo";
import { createClient } from "@/lib/supabase/client";

/** 로그인 없이 볼 수 있는 경로 */
const PUBLIC_PATHS = ["/", "/login", "/signup", "/terms", "/about"];

export function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
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
          setReady(false);
          return;
        }

        if (user && (pathname === "/login" || pathname === "/signup")) {
          void seedDemoDataIfNeeded();
          if (cancelled) return;
          router.replace("/");
          setReady(false);
          return;
        }

        // 시드는 백그라운드 — 로그인 화면 진입을 막지 않음
        if (user) {
          void seedDemoDataIfNeeded();
        }
        if (cancelled) return;
        setReady(true);
      } catch {
        if (cancelled) return;
        if (!publicPage) {
          router.replace("/");
          setReady(false);
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

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#F9FAFB] text-sm text-gray-400">
        불러오는 중...
      </div>
    );
  }

  // 계정(세션)이 바뀌면 트리 전체를 리마운트해 화면 캐시 차단
  return <div key={sessionKey}>{children}</div>;
}
