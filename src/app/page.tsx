"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { RequireAuthModal } from "@/components/RequireAuthModal";
import { BrandIcon } from "@/components/BrandIcon";
import { getCurrentUser, hardRedirectHome, logoutUser, peekCurrentUser } from "@/lib/auth";
import { getDailyGreeting } from "@/lib/dailyGreeting";
import { todayISO } from "@/lib/date";
import {
  getContractDeadlineLabel,
  isContractDeadlineActive,
} from "@/lib/deadline";
import { useCustomersList } from "@/hooks/useEntityList";
import type { User } from "@/lib/types";
import { AdBanner } from "@/components/ads/AdBanner";

function subscribeNoop() {
  return () => {};
}

/** SSR·hydration은 null, 이후 localStorage peek (mismatch 방지) */
function usePeekedUser(): User | null {
  return useSyncExternalStore(subscribeNoop, peekCurrentUser, () => null);
}

const menus = [
  {
    href: "/customers/new",
    title: "고객 추가",
    description: "문의 고객 바로 등록",
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
    description: "매물 동선 구성",
    icon: "🗓️",
    accent: "bg-emerald-50 text-emerald-600",
  },
  {
    href: "/navi",
    title: "네비 시작하기",
    description: "원터치 네비 · 원터치 전화",
    icon: "🧭",
    accent: "bg-orange-50 text-orange-600",
  },
] as const;

function deadlineModalKey(userId: string) {
  return `realty_deadline_modal_${userId}_${todayISO()}`;
}

const FREE_NOTICE_HIDE_KEY = "realty_home_free_notice_hide";

export default function HomePage() {
  const router = useRouter();
  const peekedUser = usePeekedUser();
  /** undefined = 아직 getCurrentUser 전 → peekedUser 사용 */
  const [userOverride, setUserOverride] = useState<User | null | undefined>(
    undefined
  );
  const user = userOverride === undefined ? peekedUser : userOverride;
  const { items: customers } = useCustomersList();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [deadlineModalOpen, setDeadlineModalOpen] = useState(false);
  const [freeNoticeOpen, setFreeNoticeOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const u = await getCurrentUser();
      if (cancelled) return;
      setUserOverride(u);
      if (u) {
        setFreeNoticeOpen(false);
        return;
      }
      try {
        if (localStorage.getItem(FREE_NOTICE_HIDE_KEY) !== "1") {
          setFreeNoticeOpen(true);
        }
      } catch {
        setFreeNoticeOpen(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // 고객 캐시가 채워지면 계약 마감 모달
  useEffect(() => {
    if (!user) return;
    const due = customers.filter((c) => isContractDeadlineActive(c));
    if (due.length === 0) return;
    const key = deadlineModalKey(user.id);
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      /* ignore */
    }
    setDeadlineModalOpen(true);
    const timer = window.setTimeout(() => setDeadlineModalOpen(false), 4500);
    return () => window.clearTimeout(timer);
  }, [user, customers]);

  const closeFreeNotice = () => setFreeNoticeOpen(false);

  const hideFreeNoticeForever = () => {
    try {
      localStorage.setItem(FREE_NOTICE_HIDE_KEY, "1");
    } catch {
      /* ignore */
    }
    setFreeNoticeOpen(false);
  };

  const deadlineCustomers = useMemo(
    () => customers.filter((c) => isContractDeadlineActive(c)),
    [customers]
  );
  // SSR은 고정값, hydration 이후 로컬 날짜 인사 (mismatch 방지)
  const dailyGreeting = useSyncExternalStore(
    subscribeNoop,
    () => getDailyGreeting(),
    () => "오늘도 현장 화이팅"
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
      <div className="mb-3 px-1">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-xl shadow-sm">
                <BrandIcon size={32} />
              </span>
              <p className="text-[13px] font-bold tracking-tight text-[#3182F6]">
                현장동선
              </p>
            </div>
            {user?.shopName?.trim() &&
            user.shopName.trim() !== "현장동선" ? (
              <p className="mt-3 text-[14px] font-extrabold leading-none tracking-tight text-[#3182F6]">
                {user.shopName.trim()}
              </p>
            ) : null}
            <h1
              className={`${
                user?.shopName?.trim() &&
                user.shopName.trim() !== "현장동선"
                  ? "mt-0"
                  : "mt-2"
              } text-[30px] font-bold leading-[1.25] tracking-tight text-gray-900`}
            >
              {user ? (
                <>
                  {user.name || user.username}님,
                  <br />
                  {dailyGreeting}
                </>
              ) : (
                <>
                  고객 브리핑부터
                  <br />
                  동선 관리까지
                </>
              )}
            </h1>
            <p className="mt-3 text-[15px] leading-relaxed text-gray-500">
              {user ? (
                <>
                  전화·네비는 원클릭으로.
                  <br />
                  부동산 업무를 더 빠르고 가볍게.
                </>
              ) : (
                <>
                  전화·네비는 원클릭으로.
                  <br />
                  회원가입 후 바로 시작해 보세요.
                </>
              )}
            </p>
          </div>
          {user ? (
            <div className="flex shrink-0 items-center gap-2.5 pt-1">
              <Link
                href="/account"
                className="text-[13px] font-semibold text-[#3182F6] active:scale-95 transition-all duration-150"
              >
                내정보
              </Link>
              <span className="text-[12px] text-gray-300" aria-hidden>
                |
              </span>
              <button
                type="button"
                onClick={() => {
                  void (async () => {
                    setUserOverride(null);
                    await logoutUser();
                    hardRedirectHome();
                  })();
                }}
                className="text-[13px] font-semibold text-gray-500 active:scale-95 transition-all duration-150"
              >
                로그아웃
              </button>
            </div>
          ) : (
            <div className="flex shrink-0 items-center gap-2.5 pt-1">
              <Link
                href="/login"
                className="text-[13px] font-semibold text-gray-500 active:scale-95 transition-all duration-150"
              >
                로그인
              </Link>
              <span className="text-[12px] text-gray-300" aria-hidden>
                |
              </span>
              <Link
                href="/signup"
                className="text-[13px] font-semibold text-[#3182F6] active:scale-95 transition-all duration-150"
              >
                회원가입
              </Link>
            </div>
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
            href="/about#guide"
            className="font-semibold text-gray-500 underline-offset-2 hover:text-[#3182F6] hover:underline"
          >
            사용설명
          </Link>
          <Link
            href="/terms"
            className="font-semibold text-gray-500 underline-offset-2 hover:text-[#3182F6] hover:underline"
          >
            약관·개인정보·광고
          </Link>
        </div>
        <p>업무 편의 도구 · 필요한 분만 이용</p>
        <p>
          문의{" "}
          <a
            href="mailto:bek94900@gmail.com"
            className="font-semibold text-gray-500 underline-offset-2 hover:text-[#3182F6] hover:underline"
          >
            bek94900@gmail.com
          </a>
        </p>
      </footer>

      <RequireAuthModal
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
      />

      <Modal
        open={freeNoticeOpen && !user}
        onClose={closeFreeNotice}
        position="center"
        dense
        className="!max-w-[300px] !bg-[#E8F3FF] !p-4 ring-1 ring-inset ring-[#3182F6]/25"
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl shadow-sm">
            <BrandIcon size={40} />
          </span>
          <p className="text-[13px] font-extrabold text-[#3182F6]">현장동선</p>
          <p className="text-[16px] font-bold leading-snug tracking-tight text-[#1B64DA]">
            회원가입 후
            <br />
            서비스를 이용할 수 있습니다.
          </p>
          <div className="mt-1 flex w-full gap-2">
            <Button
              variant="secondary"
              className="min-w-0 flex-1 !bg-white !px-2 !text-[13px] !text-gray-600 ring-1 ring-inset ring-[#3182F6]/15"
              onClick={hideFreeNoticeForever}
            >
              다시 보이지 않기
            </Button>
            <Button
              className="min-w-0 flex-1 !text-[15px]"
              onClick={closeFreeNotice}
            >
              확인
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={deadlineModalOpen && deadlineCustomers.length > 0}
        onClose={closeDeadlineModal}
        position="center"
        title="마지막 계약 데드라인"
        description="희망 입주 시작일 기준 31일 전인 고객만 표시해요 · 단일은 그날, 기간은 시작~끝까지 보여요"
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
