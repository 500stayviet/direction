"use client";

import { usePathname } from "next/navigation";
import { AuthGate } from "@/components/AuthGate";
import { AccountSuspendedGate } from "@/components/AccountSuspendedGate";
import { BottomTabBar } from "@/components/BottomTabBar";
import { AdConsentNotice } from "@/components/ads/AdConsentNotice";
import { EntityRealtimeSync } from "@/components/EntityRealtimeSync";
import { TeamAlertsSync } from "@/components/TeamAlertsSync";

const AUTH_PATHS = ["/login", "/signup"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = AUTH_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
  // 현장 리드 진행 중에만 탭바 숨김 (로그인·회원가입은 홈 이동 위해 표시)
  const hideTab = pathname.startsWith("/navi/") && pathname !== "/navi";
  // 하단 고정 CTA + 탭바가 있는 화면 (스크롤 여유)
  const stickySave =
    !isAuthPage &&
    (pathname === "/schedules/new" ||
      pathname === "/customers" ||
      pathname === "/customers/new" ||
      pathname === "/properties" ||
      pathname === "/properties/new" ||
      pathname === "/account/edit" ||
      /^\/customers\/[^/]+$/.test(pathname) ||
      /^\/properties\/[^/]+$/.test(pathname) ||
      /^\/schedules\/[^/]+$/.test(pathname));

  return (
    <div className="min-h-dvh bg-[#F9FAFB] text-gray-900">
      <div className="relative mx-auto min-h-dvh w-full max-w-[430px] bg-[#F9FAFB] shadow-[0_0_0_1px_rgba(0,0,0,0.04)]">
        <AuthGate>
          <AccountSuspendedGate>
          <EntityRealtimeSync />
          <TeamAlertsSync />
          <div
            className={[
              "min-h-dvh px-4 pt-[max(0.5rem,env(safe-area-inset-top))]",
              hideTab
                ? "pb-[calc(5.5rem+env(safe-area-inset-bottom))]"
                : stickySave
                  ? "pb-[calc(10.5rem+env(safe-area-inset-bottom))]"
                  : "pb-[calc(5rem+env(safe-area-inset-bottom))]",
            ].join(" ")}
          >
            {children}
          </div>
          {!hideTab && <BottomTabBar />}
          {!hideTab && <AdConsentNotice />}
          </AccountSuspendedGate>
        </AuthGate>
      </div>
    </div>
  );
}
