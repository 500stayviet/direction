"use client";

import Link from "next/link";
import { BrandIcon } from "@/components/BrandIcon";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

interface RequireAuthModalProps {
  open: boolean;
  onClose: () => void;
}

export function RequireAuthModal({ open, onClose }: RequireAuthModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      position="center"
      dense
      className="max-w-[340px] overflow-hidden !p-0 !rounded-[28px]"
    >
      <div className="relative overflow-hidden px-5 pb-5 pt-6 text-center">
        <div
          className="pointer-events-none absolute -left-10 -top-16 h-40 w-40 rounded-full bg-[#3182F6]/10"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -right-12 top-8 h-32 w-32 rounded-full bg-[#3182F6]/[0.07]"
          aria-hidden
        />

        <div className="relative mx-auto flex h-16 w-16 items-center justify-center overflow-hidden rounded-[22px] shadow-[0_10px_24px_rgba(49,130,246,0.35)]">
          <BrandIcon size={64} />
        </div>

        <h2 className="relative mt-5 text-[22px] font-bold leading-snug tracking-tight text-gray-900">
          회원가입 후
          <br />
          이용할 수 있어요
        </h2>
        <p className="relative mt-2 text-[14px] leading-relaxed text-gray-500">
          손님 · 일정 · 네비 기능은
          <br />
          가입 후 바로 사용할 수 있습니다.
        </p>

        <div className="relative mt-5 grid grid-cols-3 gap-1.5">
          {FEATURES.map((item) => (
            <div
              key={item.label}
              className="rounded-2xl bg-gray-50 px-1 py-2.5"
            >
              <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-xl bg-white text-[#3182F6] shadow-sm">
                {item.icon}
              </div>
              <p className="mt-1.5 text-[12px] font-bold text-gray-700">
                {item.label}
              </p>
            </div>
          ))}
        </div>

        <div className="relative mt-5 space-y-2">
          <Link href="/signup" onClick={onClose} className="block">
            <Button fullWidth size="lg">
              회원가입하고 시작하기
            </Button>
          </Link>
          <Link href="/login" onClick={onClose} className="block">
            <Button fullWidth variant="secondary">
              이미 계정이 있어요
            </Button>
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 text-[13px] font-semibold text-gray-400 active:scale-95 transition-all duration-150"
          >
            나중에 할게요
          </button>
        </div>
      </div>
    </Modal>
  );
}

const FEATURES = [
  { label: "손님", icon: <PersonIcon /> },
  { label: "일정", icon: <CalendarIcon /> },
  { label: "네비", icon: <NaviIcon /> },
] as const;

function PersonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="2" />
      <path
        d="M5 19c1.5-3.5 4-5 7-5s5.5 1.5 7 5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="4"
        y="5"
        width="16"
        height="15"
        rx="2.5"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M8 3v4M16 3v4M4 10h16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function NaviIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3l7 17-7-4-7 4 7-17z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}
