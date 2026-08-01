"use client";

import { formatPhone, toTelHref } from "@/lib/format";

interface PhoneLinkProps {
  phone: string;
  className?: string;
  showIcon?: boolean;
}

export function PhoneLink({
  phone,
  className = "",
  showIcon = true,
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
      {showIcon && <span aria-hidden>📞</span>}
      <span>{formatPhone(phone)}</span>
    </a>
  );
}
