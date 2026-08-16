"use client";

import { useMemo, useState, useSyncExternalStore, type MouseEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { RequireAuthModal } from "@/components/RequireAuthModal";
import { useAccountSuspended } from "@/components/AccountSuspendedGate";
import { useAlertBadgeCounts } from "@/components/TeamAlertsSync";
import {
  getAuthEpoch,
  peekCurrentUser,
  subscribeAuthChange,
} from "@/lib/auth";

const tabs = [
  { href: "/", label: "홈", icon: "🏠", match: (p: string) => p === "/", public: true },
  {
    href: "/customers",
    label: "고객리스트",
    icon: "👤",
    match: (p: string) => p.startsWith("/customers"),
    public: false,
    badgeKey: "customers" as const,
  },
  {
    href: "/properties",
    label: "매물리스트",
    icon: "🏢",
    match: (p: string) => p.startsWith("/properties"),
    public: false,
    badgeKey: "properties" as const,
  },
  {
    href: "/navi",
    label: "네비",
    icon: "🧭",
    match: (p: string) => p.startsWith("/navi"),
    public: false,
    badgeKey: "navi" as const,
  },
] as const;

export function BottomTabBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const badges = useAlertBadgeCounts();
  const { blockOrExplain } = useAccountSuspended();
  const authEpoch = useSyncExternalStore(
    subscribeAuthChange,
    getAuthEpoch,
    () => 0
  );
  const loggedIn = useMemo(() => {
    void authEpoch;
    return Boolean(peekCurrentUser()?.id);
  }, [authEpoch]);

  // 현장 리드 중에는 하단 CTA만 남김
  if (pathname.startsWith("/navi/") && pathname !== "/navi") {
    return null;
  }

  const onTabClick = (
    event: MouseEvent<HTMLAnchorElement>,
    href: string,
    isPublic: boolean
  ) => {
    if (href !== "/" && blockOrExplain()) {
      event.preventDefault();
      return;
    }
    if (isPublic || loggedIn) return;
    event.preventDefault();
    if (pathname === "/") {
      setAuthModalOpen(true);
      return;
    }
    router.push("/");
  };

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center">
        <nav
          className="pointer-events-auto w-full max-w-[430px] border-t border-gray-100 bg-white/95 backdrop-blur"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <div className="grid grid-cols-4 px-2 pt-1">
            {tabs.map((tab) => {
              const active = tab.match(pathname);
              const badgeCount =
                loggedIn && "badgeKey" in tab ? badges[tab.badgeKey] : 0;
              const className = [
                "flex min-h-[56px] flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-semibold",
                "active:scale-95 transition-all duration-150",
                active ? "text-[#3182F6]" : "text-gray-400",
              ].join(" ");

              const icon = (
                <span className="relative inline-flex text-xl leading-none">
                  <span aria-hidden>{tab.icon}</span>
                  {badgeCount > 0 ? (
                    <span
                      className="absolute -right-2.5 -top-1.5 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-red-500 px-[3px] text-[9px] font-extrabold leading-none text-white ring-2 ring-white"
                      aria-label={`새 알림 ${badgeCount}건`}
                    >
                      {badgeCount > 99 ? "99+" : badgeCount}
                    </span>
                  ) : null}
                </span>
              );

              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  prefetch
                  aria-label={tab.label}
                  onClick={(event) => onTabClick(event, tab.href, tab.public)}
                  className={className}
                >
                  {icon}
                  <span>{tab.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>

      <RequireAuthModal
        open={authModalOpen && pathname === "/"}
        onClose={() => setAuthModalOpen(false)}
      />
    </>
  );
}
