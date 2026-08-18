"use client";

import type { ReactNode } from "react";
import { Modal } from "@/components/ui/Modal";

const FEATURES = [
  {
    title: "AI 입력",
    desc: "메시지·사진 분석",
    accent: "bg-violet-50 text-violet-600",
    icon: <AiIcon />,
  },
  {
    title: "마이크 입력",
    desc: "대화로 정보 입력",
    accent: "bg-sky-50 text-sky-600",
    icon: <MicIcon />,
  },
  {
    title: "조건 매칭",
    desc: "고객·매물 자동 매칭",
    accent: "bg-amber-50 text-amber-600",
    icon: <MatchIcon />,
  },
  {
    title: "원터치 네비 전화",
    desc: "간편 전화 주소 입력",
    accent: "bg-blue-50 text-[#3182F6]",
    icon: <NaviIcon />,
  },
  {
    title: "간편 브리핑",
    desc: "간편한 매물 일정 제공",
    accent: "bg-emerald-50 text-emerald-600",
    icon: <BriefIcon />,
  },
  {
    title: "팀 공유",
    desc: "동료와 항목 공유",
    accent: "bg-orange-50 text-orange-600",
    icon: <TeamIcon />,
  },
] as const;

export function FeatureIntroModal({
  open,
  onClose,
  onHideForever,
}: {
  open: boolean;
  onClose: () => void;
  onHideForever: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      position="center"
      dense
      className="!max-h-[calc(100dvh-24px)] !max-w-[min(100%,398px)] overflow-hidden !px-4 !pb-3 !pt-4"
    >
      <div className="flex flex-col overflow-hidden">
        <p className="text-center text-[13px] font-bold tracking-tight text-[#3182F6]">
          현장동선
        </p>
        <h2 className="mt-1 text-center text-[19px] font-bold leading-snug tracking-tight text-gray-900">
          이런 기능을 쓸 수 있어요
        </h2>

        <div className="mt-3.5 grid grid-cols-2 gap-2">
          {FEATURES.map((item) => (
            <div
              key={item.title}
              className="flex min-h-0 items-center gap-2.5 rounded-2xl bg-[#F9FAFB] px-2.5 py-2.5 ring-1 ring-inset ring-gray-100"
            >
              <span
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${item.accent}`}
                aria-hidden
              >
                {item.icon}
              </span>
              <span className="min-w-0">
                <span className="block text-[14px] font-bold leading-tight text-gray-900">
                  {item.title}
                </span>
                <span className="mt-0.5 block text-[12px] leading-tight text-gray-500">
                  {item.desc}
                </span>
              </span>
            </div>
          ))}
        </div>

        <div className="mt-3.5 flex items-center gap-2">
          <button
            type="button"
            onClick={onHideForever}
            className="flex h-8 min-w-0 flex-1 items-center justify-center rounded-full border border-gray-200 bg-white text-[12px] font-semibold text-gray-500 active:scale-[0.98] transition-all duration-150"
          >
            다시 보지 않기
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 min-w-0 flex-1 items-center justify-center rounded-full bg-[#3182F6] text-[13px] font-bold text-white shadow-sm active:scale-[0.98] transition-all duration-150"
          >
            닫기
          </button>
        </div>
      </div>
    </Modal>
  );
}

function IconWrap({ children }: { children: ReactNode }) {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" aria-hidden>
      {children}
    </svg>
  );
}

/** 누구나 AI로 읽히는 글자 마크 */
function AiIcon() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3.4 18.6 8.2 5.8l4.8 12.8"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5.7 13.8h5"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M17.6 5.8v12.8"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M15.4 5.8h4.4M15.4 18.6h4.4"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MicIcon() {
  return (
    <IconWrap>
      <rect
        x="9"
        y="3.4"
        width="6"
        height="10.2"
        rx="3"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M7 12a5 5 0 0 0 10 0M12 17v3M8.6 20.6h6.8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconWrap>
  );
}

/** 고객·매물이 맞물리는 매칭 */
function MatchIcon() {
  return (
    <IconWrap>
      <circle cx="8.2" cy="8" r="2.4" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M4.4 16.6c.6-2.3 2.1-3.5 3.8-3.5 1.7 0 3.2 1.2 3.8 3.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <rect
        x="13.2"
        y="6.2"
        width="6.6"
        height="8.4"
        rx="1.3"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M15 9h3M15 11.4h3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M11.2 18.8h8.2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </IconWrap>
  );
}

function NaviIcon() {
  return (
    <IconWrap>
      <path
        d="M5.2 11.2 19 5.2l-4.8 14.4-2.7-6.4-6.3-2Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </IconWrap>
  );
}

function BriefIcon() {
  return (
    <IconWrap>
      <rect
        x="5"
        y="4.2"
        width="14"
        height="16.2"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M8.4 9h7.2M8.4 12.4h7.2M8.4 15.8h4.6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </IconWrap>
  );
}

function TeamIcon() {
  return (
    <IconWrap>
      <circle cx="9" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M4.3 17.8c.7-2.6 2.4-3.9 4.7-3.9 2.3 0 4 1.3 4.7 3.9"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle cx="16.6" cy="8.4" r="2.1" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M14.8 20 20 14.8M20 14.8h-3.6M20 14.8V18.4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconWrap>
  );
}
