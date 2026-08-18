"use client";

import type { ReactElement, ReactNode } from "react";
import { PhoneChip } from "@/components/PhoneLink";
import {
  dealTypeBarClass,
  dealTypeTextClass,
  EndedBadge,
} from "@/components/ListEdgeChips";
import { displayRoomType } from "@/lib/constants";
import {
  getCustomerBudgetLabel,
  getCustomerMoveInLabel,
} from "@/lib/format";
import { formatSavedDate } from "@/lib/date";
import { getContractDeadlineLabel } from "@/lib/deadline";
import { peekCurrentUser } from "@/lib/auth";
import { teamSharerLabel } from "@/lib/teamActionGuard";
import { formatPreferredLocationLabel } from "@/lib/preferredLocation";
import { listCardFrameClass } from "@/lib/teamAlerts";
import type { Customer } from "@/lib/types";

interface CustomerListCardProps {
  customer: Customer;
  /** 칩 오른쪽 (팀 공유 버튼 등) */
  right?: ReactNode;
  /** 카드 본문 감싸기 (스와이프 행 등). 기본은 카드 그대로 */
  renderCard?: (card: ReactElement) => ReactNode;
  className?: string;
  /** false면 계약마감(입주 45일 전) 표시 숨김 */
  showDeadline?: boolean;
  /** false면 등록일 숨김 */
  showSavedDate?: boolean;
  /** 공유 신규(정적) | 매칭 신규(반짝임) */
  alertHighlight?: "share" | "match" | null;
  /** 현재 로그인 사용자 id. 넘기면 카드마다 세션을 다시 읽지 않음 */
  viewerId?: string;
}

function MoneyPhoneRow({
  moneyText,
  phone,
  done,
}: {
  moneyText: string;
  phone: string;
  done: boolean;
}) {
  return (
    <div className="mt-1.5 flex w-full items-center gap-2">
      {moneyText ? (
        <p
          title={moneyText}
          className={[
            "min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[22px] font-extrabold leading-none tracking-tight",
            done ? "text-gray-500" : "text-gray-900",
          ].join(" ")}
        >
          {moneyText}
        </p>
      ) : (
        <span className="min-w-0 flex-1" />
      )}
      <div className="flex shrink-0 items-center gap-1">
        <span
          className={[
            "shrink-0 text-[12px] font-semibold",
            done ? "text-gray-400" : "text-gray-500",
          ].join(" ")}
        >
          고객
        </span>
        <PhoneChip phone={phone} done={done} className="!ml-0" />
      </div>
    </div>
  );
}

export function CustomerListCard({
  customer: c,
  right,
  renderCard = (card) => card,
  className = "",
  showDeadline = true,
  showSavedDate = true,
  alertHighlight = null,
  viewerId,
}: CustomerListCardProps) {
  const saved = showSavedDate ? formatSavedDate(c.createdAt) : "";
  const done = Boolean(c.contractCompleted);
  const deadlineLabel =
    showDeadline && !done ? getContractDeadlineLabel(c) : null;
  const sharer = teamSharerLabel(
    c.createdByName,
    c.createdBy,
    viewerId ?? peekCurrentUser()?.id
  );
  const preferredLabel = formatPreferredLocationLabel(c);
  const moveInLabel = getCustomerMoveInLabel(c);
  const typeLabel = displayRoomType(c.roomType, c.buildingKind);
  const dealLabel = c.dealType?.trim() || "";
  const moneyLabel = getCustomerBudgetLabel(c).trim();
  const typeText = typeLabel && typeLabel !== "-" ? typeLabel : "유형";
  const moneyText = moneyLabel && moneyLabel !== "-" ? moneyLabel : "";

  const card = (
    <article
      className={[
        "flex overflow-hidden rounded-xl",
        listCardFrameClass(done, done ? null : alertHighlight),
      ].join(" ")}
    >
      <div
        className={[
          "w-1.5 shrink-0",
          dealTypeBarClass(c.dealType, done),
        ].join(" ")}
        aria-hidden
      />
      <div
        className={[
          "min-w-0 flex-1 px-3 pb-2.5",
          deadlineLabel ? "pt-3.5" : "pt-2.5",
        ].join(" ")}
      >
        <div
          data-testid="customer-card-conditions"
          className="flex items-start gap-2"
        >
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              {done ? <EndedBadge /> : null}
              {dealLabel ? (
                <span
                  className={[
                    "text-[22px] font-extrabold leading-none tracking-tight",
                    dealTypeTextClass(c.dealType, done),
                  ].join(" ")}
                >
                  {dealLabel}
                </span>
              ) : null}
              <span
                className={[
                  "inline-flex max-w-[8.5rem] shrink-0 truncate rounded-md border px-2 py-1 text-[16px] font-bold leading-none",
                  done
                    ? "border-gray-200 bg-gray-100 text-gray-400"
                    : "border-gray-200 bg-gray-50 text-gray-600",
                ].join(" ")}
              >
                {typeText}
              </span>
            </div>
          </div>
          {right ? (
            <div className="relative z-[1] -mt-1 shrink-0">{right}</div>
          ) : null}
        </div>

        <MoneyPhoneRow moneyText={moneyText} phone={c.phone} done={done} />

        {preferredLabel ? (
          <p
            data-testid="customer-card-preferred"
            title={`선호지역: ${preferredLabel}`}
            className={[
              "mt-1.5 min-w-0 w-full overflow-hidden text-ellipsis whitespace-nowrap text-[14px] font-semibold leading-snug",
              done ? "text-gray-500" : "text-gray-700",
            ].join(" ")}
          >
            {`선호지역: ${preferredLabel}`}
          </p>
        ) : null}
        {moveInLabel || sharer || saved ? (
          <div
            className={[
              "flex items-center gap-2",
              preferredLabel ? "mt-0.5" : "mt-1.5",
            ].join(" ")}
          >
            {moveInLabel ? (
              <p
                className={[
                  "min-w-0 flex-1 truncate text-[14px] font-semibold leading-snug",
                  done ? "text-gray-500" : "text-gray-700",
                ].join(" ")}
              >
                {moveInLabel}
              </p>
            ) : (
              <span className="min-w-0 flex-1" />
            )}
            {sharer || saved ? (
              <p className="ml-auto flex shrink-0 items-center justify-end gap-1 text-[11px] text-gray-400">
                {sharer ? (
                  <span className="max-w-[5.5rem] truncate">{sharer}</span>
                ) : null}
                {sharer && saved ? <span className="shrink-0">·</span> : null}
                {saved ? <span className="shrink-0">{saved}</span> : null}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );

  return (
    <div
      className={["relative", deadlineLabel ? "pt-2" : "", className].join(" ")}
    >
      {deadlineLabel ? (
        <span className="absolute left-3 top-2 z-10 -translate-y-1/2 rounded-md border border-amber-400 bg-amber-50 px-1.5 py-0.5 text-[12px] font-extrabold leading-none text-amber-700 shadow-sm ring-2 ring-[#F9FAFB]">
          {deadlineLabel}
        </span>
      ) : null}
      {renderCard(card)}
    </div>
  );
}
