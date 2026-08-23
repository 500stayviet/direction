"use client";

import { formatPhone } from "@/lib/format";
import type { MatchAgencyContact } from "@/lib/matchAgencyContact";
import { PhoneLink } from "@/components/PhoneLink";

/** 원터치 전화 안내 — PropertyBrief와 동일 */
const touchActionHintClass =
  "ml-auto min-w-0 max-w-full rounded px-0.5 py-px text-right text-[12px] font-semibold leading-snug text-amber-600";

const regionBadgeClass =
  "shrink-0 rounded-md border border-gray-200 bg-white px-1 py-0.5 text-[10px] font-bold text-gray-500";

const phoneNumberClass =
  "shrink-0 font-extrabold tabular-nums text-[#03B26C] underline decoration-[#03B26C]/45 underline-offset-[3px] text-[17px] leading-none tracking-[-0.06em]";

/** 사이트내 공유 매칭 — 등록 부동산 상호·동·전화 */
export function MatchAgencyContactBlock({
  contact,
}: {
  contact: MatchAgencyContact;
}) {
  const shopEl = (
    <span
      title={contact.shopName}
      className="min-w-0 shrink text-[18px] font-extrabold leading-none tracking-tight text-gray-900"
    >
      {contact.shopName}
    </span>
  );

  const dongEl = contact.dong ? (
    <span className={regionBadgeClass}>{contact.dong}</span>
  ) : null;

  const phoneEl = contact.phone ? (
    <span className={phoneNumberClass}>{formatPhone(contact.phone)}</span>
  ) : (
    <span className="shrink-0 text-[13px] font-semibold text-gray-400">
      전화번호 미입력
    </span>
  );

  const rowClass = "flex w-full min-w-0 items-center gap-1";

  return (
    <div className="rounded-2xl bg-[#E8F8F1] px-3 py-3 ring-1 ring-inset ring-[#03B26C]/20">
      <div className="flex w-full flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <p className="shrink-0 text-[14px] font-extrabold leading-none text-[#03B26C]">
          원터치 전화
        </p>
        <span className={touchActionHintClass}>
          번호를 누르면 전화로 이동
        </span>
      </div>
      <div className="mt-2 w-full min-w-0">
        {contact.phone ? (
          <PhoneLink
            phone={contact.phone}
            showIcon={false}
            className={`${rowClass} !text-[#03B26C]`}
          >
            {shopEl}
            {dongEl}
            {phoneEl}
          </PhoneLink>
        ) : (
          <div className={rowClass}>
            {shopEl}
            {dongEl}
            {phoneEl}
          </div>
        )}
      </div>
    </div>
  );
}
