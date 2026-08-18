"use client";

import type { ReactNode } from "react";
import { Modal } from "@/components/ui/Modal";

const FEATURES = [
  {
    title: "AI 메시지 사진 분석 기능",
    desc: "메시지 사진 내용을 분석하여 해당 칸에 자동 입력합니다.",
    accent: "bg-violet-50 text-violet-600",
    icon: <AiIcon />,
  },
  {
    title: "마이크 입력 기능",
    desc: "대화로 고객 매물 등록 해 보세요",
    accent: "bg-sky-50 text-sky-600",
    icon: <MicIcon />,
  },
  {
    title: "조건 매칭",
    desc: "리스트에 있는 고객과 매물을 자동 매칭해 줍니다.",
    accent: "bg-amber-50 text-amber-600",
    icon: <MatchIcon />,
  },
  {
    title: "원터치 기능",
    desc: "네비앱과 전화앱에 클릭한번으로 입력",
    accent: "bg-blue-50 text-[#3182F6]",
    icon: <NaviIcon />,
  },
  {
    title: "간편 브리핑",
    desc: "보유한 매물 일정을 간편하게 고객에게 제공",
    accent: "bg-emerald-50 text-emerald-600",
    icon: <BriefIcon />,
  },
  {
    title: "팀 공유",
    desc: "같은 소속 직원들과 공유해 보세요",
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
      className="!max-h-[min(100dvh-32px,fit-content)] !w-[min(100%,336px)] !max-w-[336px] overflow-hidden !px-3.5 !pb-3 !pt-3.5"
    >
      <div className="flex flex-col">
        <p className="text-center text-[13px] font-bold tracking-tight text-[#3182F6]">
          현장동선
        </p>
        <h2 className="mt-1 text-center text-[18px] font-bold leading-snug tracking-tight text-gray-900">
          이런 기능을 쓸 수 있어요
        </h2>

        <ul className="mt-3 space-y-1.5">
          {FEATURES.map((item) => (
            <li
              key={item.title}
              className="flex items-center gap-3 rounded-xl bg-[#F9FAFB] px-2.5 py-2.5 ring-1 ring-inset ring-gray-100"
            >
              <span
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${item.accent}`}
                aria-hidden
              >
                {item.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-bold leading-tight text-gray-900">
                  {item.title}
                </span>
                <span className="mt-0.5 block text-[12px] font-medium leading-snug text-gray-500">
                  {item.desc}
                </span>
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-3 flex items-center gap-1.5">
          <button
            type="button"
            onClick={onHideForever}
            className="flex h-8 min-w-0 flex-1 items-center justify-center rounded-full border border-gray-200 bg-white px-2 text-[12px] font-semibold text-gray-500 active:scale-[0.98] transition-all duration-150"
          >
            일주일간 보지 않기
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 min-w-0 flex-[0.72] items-center justify-center rounded-full bg-[#3182F6] text-[13px] font-bold text-white shadow-sm active:scale-[0.98] transition-all duration-150"
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
    <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" aria-hidden>
      {children}
    </svg>
  );
}

function AiIcon() {
  return (
    <span className="text-[22px] font-extrabold tracking-tight leading-none">
      AI
    </span>
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
      <circle cx="6.2" cy="8.6" r="2" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="17.8" cy="8.6" r="2" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="7.2" r="2.5" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M3.4 18.2c.5-2.1 1.8-3.2 2.8-3.2 1.2 0 2.1.7 2.6 1.9"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M15.2 16.9c.5-1.2 1.4-1.9 2.6-1.9 1 0 2.3 1.1 2.8 3.2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M7.4 18.4c.8-2.6 2.6-3.8 4.6-3.8s3.8 1.2 4.6 3.8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </IconWrap>
  );
}
