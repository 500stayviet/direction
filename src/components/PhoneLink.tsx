"use client";

import { formatPhone, toTelHref } from "@/lib/format";

interface PhoneLinkProps {
  phone: string;
  className?: string;
  showIcon?: boolean;
  children?: React.ReactNode;
}

export function PhoneLink({
  phone,
  className = "",
  showIcon = true,
  children,
}: PhoneLinkProps) {
  if (!phone) return <span className="text-gray-400">전화번호 없음</span>;

  return (
    <a
      href={toTelHref(phone)}
      className={[
        "inline-flex items-center gap-1.5 font-semibold text-[#3182F6]",
        "active:scale-95 transition-all duration-150",
        className,
      ].join(" ")}
      onClick={(e) => e.stopPropagation()}
    >
      {children ?? (
        <>
          {showIcon ? <span aria-hidden>📞</span> : null}
          <span>{formatPhone(phone)}</span>
        </>
      )}
    </a>
  );
}

/** 리스트 카드용: 회색 박스 + 수화기 아이콘 */
export function PhoneChip({
  phone,
  done = false,
  className = "",
}: {
  phone?: string;
  done?: boolean;
  className?: string;
}) {
  const value = phone?.trim() ?? "";
  if (!value) {
    return (
      <span
        className={[
          "ml-auto shrink-0 rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-[13px] font-medium text-gray-300",
          className,
        ].join(" ")}
      >
        번호 없음
      </span>
    );
  }

  return (
    <PhoneLink
      phone={value}
      showIcon={false}
      className={[
        "relative z-[1] ml-auto !shrink-0 !gap-1 rounded-md border border-gray-200 bg-gray-50 px-1.5 py-0.5 sm:!gap-0.5 sm:px-1",
        "!text-[16px] !font-bold !leading-none !tracking-tight tabular-nums sm:!text-[14px] sm:!tracking-[-0.08em] sm:normal-nums",
        done ? "!text-gray-400" : "!text-[#2F9E66]",
        className,
      ].join(" ")}
    >
      <svg
        viewBox="0 0 20 20"
        fill="currentColor"
        className="h-3.5 w-3.5 shrink-0 sm:h-3 sm:w-3"
        aria-hidden
      >
        <path
          fillRule="evenodd"
          d="M2 3.5A1.5 1.5 0 0 1 3.5 2h1.148c.718 0 1.345.438 1.599 1.094l.716 3.223a1.5 1.5 0 0 1-1.052 1.767l-.933.267c-.41.117-.643.555-.48.95a11.542 11.542 0 0 0 6.254 6.254c.395.163.833-.07.95-.48l.267-.933a1.5 1.5 0 0 1 1.767-1.052l3.223.716A1.5 1.5 0 0 1 18 15.352V16.5a1.5 1.5 0 0 1-1.5 1.5H15c-1.149 0-2.263-.15-3.326-.43A13.022 13.022 0 0 1 2.43 8.326 13.019 13.019 0 0 1 2 5V3.5Z"
          clipRule="evenodd"
        />
      </svg>
      <span>{formatPhone(value)}</span>
    </PhoneLink>
  );
}
