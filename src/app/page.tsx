"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { RequireAuthModal } from "@/components/RequireAuthModal";
import { BrandIcon } from "@/components/BrandIcon";
import { getCurrentUser, hardRedirectHome, logoutUser } from "@/lib/auth";
import { todayISO } from "@/lib/date";
import {
  getContractDeadlineLabel,
  isContractDeadlineActive,
} from "@/lib/deadline";
import { getCustomers } from "@/lib/storage";
import type { Customer, User } from "@/lib/types";
import { AdBanner } from "@/components/ads/AdBanner";

const menus = [
  {
    href: "/customers/new",
    title: "손님 추가",
    description: "문의 손님 바로 등록",
    icon: "👤",
    accent: "bg-blue-50 text-[#3182F6]",
  },
  {
    href: "/properties/new",
    title: "매물 추가",
    description: "매물 정보 바로 등록",
    icon: "🏢",
    accent: "bg-violet-50 text-violet-600",
  },
  {
    href: "/schedules/new",
    title: "방문 일정 만들기",
    description: "매물 루트 구성",
    icon: "🗓️",
    accent: "bg-emerald-50 text-emerald-600",
  },
  {
    href: "/navi",
    title: "네비 시작하기",
    description: "현장 리드 · 길안내",
    icon: "🧭",
    accent: "bg-orange-50 text-orange-600",
  },
] as const;

function deadlineModalKey(userId: string) {
  return `realty_deadline_modal_${userId}_${todayISO()}`;
}

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [deadlineModalOpen, setDeadlineModalOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    void (async () => {
      const u = await getCurrentUser();
      if (cancelled) return;
      setUser(u);
      if (!u) return;

      const list = await getCustomers();
      if (cancelled) return;
      setCustomers(list);

      const due = list.filter((c) => isContractDeadlineActive(c));
      if (due.length === 0) return;

      const key = deadlineModalKey(u.id);
      try {
        if (sessionStorage.getItem(key)) return;
        sessionStorage.setItem(key, "1");
      } catch {
        // sessionStorage 불가 시에도 모달은 표시
      }

      setDeadlineModalOpen(true);
      timer = window.setTimeout(() => setDeadlineModalOpen(false), 4500);
    })();

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  const deadlineCustomers = useMemo(
    () => customers.filter((c) => isContractDeadlineActive(c)),
    [customers]
  );

  const requireAuth = (href: string) => {
    if (user) {
      router.push(href);
      return;
    }
    setAuthModalOpen(true);
  };

  const closeDeadlineModal = () => setDeadlineModalOpen(false);

  return (
    <main className="flex min-h-[calc(100dvh-6.5rem)] flex-col pt-6">
      <div className="mb-6 px-1">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-xl shadow-sm">
                <BrandIcon size={32} />
              </span>
              <p className="text-[13px] font-bold tracking-tight text-[#3182F6]">
                {user?.shopName || "현장동선"}
              </p>
            </div>
            <h1 className="mt-2 text-[30px] font-bold leading-[1.25] tracking-tight text-gray-900">
              {user ? (
                <>
                  {user.name || user.username}님,
                  <br />
                  오늘도 현장 화이팅
                </>
              ) : (
                <>
                  손님 브리핑부터
                  <br />
                  동선 관리까지
                </>
              )}
            </h1>
            <p className="mt-3 text-[15px] leading-relaxed text-gray-500">
              {user ? (
                <>
                  전화·내비는 원클릭으로.
                  <br />
                  이 계정에 저장된 손님·매물만 보여요.
                </>
              ) : (
                <>
                  전화·내비는 원클릭으로.
                  <br />
                  회원가입 후 바로 시작해 보세요.
                </>
              )}
            </p>
          </div>
          {user ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                void logoutUser().then(() => hardRedirectHome());
              }}
            >
              로그아웃
            </Button>
          ) : (
            <Link href="/login">
              <Button type="button" variant="outline">
                로그인
              </Button>
            </Link>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2.5 pb-2">
        {menus.map((menu) => (
          <button
            key={menu.href}
            type="button"
            onClick={() => requireAuth(menu.href)}
            className="flex min-h-[84px] items-center rounded-2xl border border-gray-100 bg-white px-4 py-3.5 text-left shadow-sm active:scale-[0.98] transition-all duration-150"
          >
            <div className="flex w-full items-center gap-3.5">
              <div
                className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-[24px] ${menu.accent}`}
              >
                {menu.icon}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-[19px] font-bold tracking-tight text-gray-900">
                  {menu.title}
                </h2>
                <p className="mt-0.5 text-[14px] text-gray-500">
                  {menu.description}
                </p>
              </div>
              <span className="text-2xl text-gray-300">›</span>
            </div>
          </button>
        ))}
      </div>

      <AdBanner slot="home" className="mt-3" />

      <footer className="mt-5 space-y-2 px-1 pb-2 text-center text-[12px] text-gray-400">
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
          <Link
            href="/about"
            className="font-semibold text-gray-500 underline-offset-2 hover:text-[#3182F6] hover:underline"
          >
            서비스 소개
          </Link>
          <Link
            href="/terms"
            className="font-semibold text-gray-500 underline-offset-2 hover:text-[#3182F6] hover:underline"
          >
            약관·개인정보·광고
          </Link>
        </div>
        <p>무료 편의 도구 · 필요한 분만 이용</p>
      </footer>

      <RequireAuthModal
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
      />

      <Modal
        open={deadlineModalOpen && deadlineCustomers.length > 0}
        onClose={closeDeadlineModal}
        position="center"
        title="마지막 계약 데드라인"
        description="희망 입주까지 정확히 한 달 남은 손님만 표시해요"
      >
        <div className="max-h-52 space-y-1.5 overflow-y-auto">
          {deadlineCustomers.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                closeDeadlineModal();
                router.push(`/customers/${c.id}`);
              }}
              className="flex w-full items-center justify-between gap-2 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2.5 text-left active:scale-[0.99] transition-all duration-150"
            >
              <span className="truncate text-[15px] font-bold text-gray-900">
                {c.name}
              </span>
              <span className="shrink-0 text-[11px] font-bold text-amber-700">
                {getContractDeadlineLabel(c)}
              </span>
            </button>
          ))}
        </div>
        <Button fullWidth className="mt-4" onClick={closeDeadlineModal}>
          확인
        </Button>
      </Modal>
    </main>
  );
}
