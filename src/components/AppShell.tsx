"use client";

import { usePathname } from "next/navigation";
import { AuthGate } from "@/components/AuthGate";
import { AccountSuspendedGate } from "@/components/AccountSuspendedGate";
import { BottomTabBar } from "@/components/BottomTabBar";
import { AdConsentNotice } from "@/components/ads/AdConsentNotice";
import { EntityListWarmup } from "@/components/EntityListWarmup";
import { EntityRealtimeSync } from "@/components/EntityRealtimeSync";
import { TeamAlertsSync } from "@/components/TeamAlertsSync";
import { AlertTopInset, AlertUxSync } from "@/components/AlertUxHost";
import { FeatureIntroHost } from "@/components/FeatureIntroHost";
import { useAppScreenWakeLock } from "@/hooks/useScreenWakeLock";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // 앱이 보일 때 약 10분만 화면 유지 (이후 슬립 허용)
  useAppScreenWakeLock();
  const isAdmin = pathname.startsWith("/admin");
  // 현장 리드·관리자에서는 탭바 숨김 (로그인·가입은 홈 탭으로 나갈 수 있게 표시)
  const hideTab =
    isAdmin ||
    (pathname.startsWith("/navi/") && pathname !== "/navi");
  // 하단 고정 CTA가 있는 화면 (스크롤 여유)
  const stickySave =
    pathname === "/signup" ||
    pathname === "/schedules/new" ||
    pathname === "/customers" ||
    pathname === "/customers/new" ||
    pathname === "/properties" ||
    pathname === "/properties/new" ||
    pathname === "/navi" ||
    pathname === "/account/edit" ||
    /^\/customers\/[^/]+$/.test(pathname) ||
    /^\/properties\/[^/]+$/.test(pathname) ||
    /^\/schedules\/[^/]+$/.test(pathname);

  return (
    <div className="min-h-dvh bg-[#F9FAFB] text-gray-900">
      <div className="relative mx-auto min-h-dvh w-full max-w-[430px] bg-[#F9FAFB] shadow-[0_0_0_1px_rgba(0,0,0,0.04)]">
        <AuthGate>
          <AccountSuspendedGate>
          <EntityListWarmup />
          <EntityRealtimeSync />
          <TeamAlertsSync />
          <AlertUxSync />
          <div
            className={[
              "min-h-dvh px-4 pt-[max(0.5rem,env(safe-area-inset-top))]",
              isAdmin
                ? "pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
                : hideTab && stickySave
                  ? "pb-[calc(7.5rem+env(safe-area-inset-bottom))]"
                  : hideTab
                    ? "pb-[calc(5.5rem+env(safe-area-inset-bottom))]"
                    : stickySave
                      ? "pb-[calc(10.5rem+env(safe-area-inset-bottom))]"
                      : "pb-[calc(5rem+env(safe-area-inset-bottom))]",
            ].join(" ")}
          >
            <AlertTopInset>{children}</AlertTopInset>
          </div>
          {!hideTab && <BottomTabBar />}
          {!hideTab && <AdConsentNotice />}
          <FeatureIntroHost />
          </AccountSuspendedGate>
        </AuthGate>
      </div>
    </div>
  );
}
