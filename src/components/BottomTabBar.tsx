"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { RequireAuthModal } from "@/components/RequireAuthModal";
import { getCachedUser } from "@/lib/auth";

const tabs = [
  { href: "/", label: "홈", icon: "🏠", match: (p: string) => p === "/", public: true },
  {
    href: "/customers",
    label: "고객리스트",
    icon: "👤",
    match: (p: string) => p.startsWith("/customers"),
    public: false,
  },
  {
    href: "/properties",
    label: "매물리스트",
    icon: "🏢",
    match: (p: string) => p.startsWith("/properties"),
    public: false,
  },
  {
    href: "/navi",
    label: "네비",
    icon: "🧭",
    match: (p: string) => p.startsWith("/navi"),
    public: false,
  },
] as const;

export function BottomTabBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [authModalOpen, setAuthModalOpen] = useState(false);

  // 현장 리드 중에는 하단 CTA만 남김
  if (pathname.startsWith("/navi/") && pathname !== "/navi") {
    return null;
  }

  const handleTab = (href: string, isPublic: boolean) => {
    if (isPublic || getCachedUser()) {
      router.push(href);
      return;
    }
    // 가입 안내는 홈에서만 — 다른 공개 페이지에서는 홈으로 이동
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
              const className = [
                "flex min-h-[56px] flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-semibold",
                "active:scale-95 transition-all duration-150",
                active ? "text-[#3182F6]" : "text-gray-400",
              ].join(" ");

              if (tab.public) {
                return (
                  <Link key={tab.href} href={tab.href} className={className}>
                    <span className="text-xl leading-none">{tab.icon}</span>
                    <span>{tab.label}</span>
                  </Link>
                );
              }

              return (
                <button
                  key={tab.href}
                  type="button"
                  onClick={() => handleTab(tab.href, tab.public)}
                  className={className}
                >
                  <span className="text-xl leading-none">{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
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
