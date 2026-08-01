"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getCurrentUser, getSessionUserId } from "@/lib/auth";
import { seedDemoDataIfNeeded } from "@/lib/seedDemo";

/** 로그인 없이 볼 수 있는 경로 */
const PUBLIC_PATHS = ["/", "/login", "/signup", "/terms"];

export function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [sessionKey, setSessionKey] = useState("guest");

  useEffect(() => {
    const publicPage = PUBLIC_PATHS.some(
      (p) => pathname === p || (p !== "/" && pathname.startsWith(`${p}/`))
    );
    const user = getCurrentUser();
    const sid = getSessionUserId() ?? "guest";
    setSessionKey(sid);

    if (!user && !publicPage) {
      router.replace("/");
      setReady(false);
      return;
    }

    if (user && (pathname === "/login" || pathname === "/signup")) {
      seedDemoDataIfNeeded();
      router.replace("/");
      setReady(false);
      return;
    }

    if (user) {
      seedDemoDataIfNeeded();
    }
    setReady(true);
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
