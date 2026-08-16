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
  {
    href: "/",
    label: "홈",
    Icon: HomeIcon,
    match: (p: string) => p === "/",
    public: true,
  },
  {
    href: "/customers",
    label: "고객리스트",
    Icon: CustomersIcon,
    match: (p: string) => p.startsWith("/customers"),
    public: false,
    badgeKey: "customers" as const,
  },
  {
    href: "/properties",
    label: "매물리스트",
    Icon: PropertiesIcon,
    match: (p: string) => p.startsWith("/properties"),
    public: false,
    badgeKey: "properties" as const,
  },
  {
    href: "/navi",
    label: "네비",
    Icon: NaviIcon,
    match: (p: string) => p.startsWith("/navi"),
    public: false,
    badgeKey: "navi" as const,
  },
] as const;

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3.8" y="3.8" width="7.2" height="7.2" rx="1.8" stroke="currentColor" strokeWidth="1.8" />
      <rect x="13" y="3.8" width="7.2" height="7.2" rx="1.8" stroke="currentColor" strokeWidth="1.8" />
      <rect x="3.8" y="13" width="7.2" height="7.2" rx="1.8" stroke="currentColor" strokeWidth="1.8" />
      <rect x="13" y="13" width="7.2" height="7.2" rx="1.8" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function CustomersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="9" cy="8" r="2.6" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M4.2 18c.8-2.8 2.6-4.2 4.8-4.2s4 1.4 4.8 4.2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle cx="16.4" cy="8.4" r="2.1" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M15.2 13.9c1.7 0 3.3 1 4.2 3.1"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PropertiesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="5.2"
        y="3.2"
        width="13.6"
        height="17.6"
        rx="1.6"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M8.2 7h2.2M13.6 7h2.2M8.2 10.6h2.2M13.6 10.6h2.2M8.2 14.2h2.2M13.6 14.2h2.2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M10.4 20.8v-3.4h3.2v3.4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function NaviIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5.2 11.2 19 5.2l-4.8 14.4-2.7-6.4-6.3-2Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

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
                "flex min-h-[60px] flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-semibold",
                "active:scale-95 transition-all duration-150",
                active ? "text-[#3182F6]" : "text-gray-400",
              ].join(" ");

              const icon = (
                <span className="relative inline-flex">
                  <tab.Icon className="h-8 w-8" />
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
