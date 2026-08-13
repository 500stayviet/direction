"use client";

import type { ReactElement, ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { PhoneLink } from "@/components/PhoneLink";
import { ListEdgeChips } from "@/components/ListEdgeChips";
import {
  getCustomerBudgetLabel,
  getCustomerMoveInLabel,
} from "@/lib/format";
import { formatSavedDate } from "@/lib/date";
import { getContractDeadlineLabel } from "@/lib/deadline";
import { peekCurrentUser } from "@/lib/auth";
import { teamSharerLabel } from "@/lib/teamActionGuard";
import { alertHighlightClass } from "@/lib/teamAlerts";
import { formatPreferredLocationLabel } from "@/lib/preferredLocation";
import type { Customer } from "@/lib/types";

interface CustomerListCardProps {
  customer: Customer;
  /** 칩 오른쪽 (팀 공유 버튼 등) */
  right?: ReactNode;
  /** 카드 본문 감싸기 (스와이프 행 등). 기본은 카드 그대로 */
  renderCard?: (card: ReactElement) => ReactNode;
  className?: string;
  /** false면 계약마감(입주 31일 전) 표시 숨김 */
  showDeadline?: boolean;
  /** false면 등록일 숨김 */
  showSavedDate?: boolean;
  /** 공유 신규(정적) | 매칭 신규(반짝임) */
  alertHighlight?: "share" | "match" | null;
}

export function CustomerListCard({
  customer: c,
  right,
  renderCard = (card) => card,
  className = "",
  showDeadline = true,
  showSavedDate = true,
  alertHighlight = null,
}: CustomerListCardProps) {
  const saved = showSavedDate ? formatSavedDate(c.createdAt) : "";
  const done = Boolean(c.contractCompleted);
  const deadlineLabel =
    showDeadline && !done ? getContractDeadlineLabel(c) : null;
  const sharer = teamSharerLabel(
    c.createdByName,
    c.createdBy,
    peekCurrentUser()?.id
  );
  const preferredLabel = formatPreferredLocationLabel(c);

  const card = (
    <Card
      className={[
        "relative !rounded-2xl !px-3 !pb-2 !pt-3",
        alertHighlightClass(done ? null : alertHighlight, done, "customers"),
      ].join(" ")}
    >
      <div className="relative">
        <div className="flex items-center justify-between gap-2">
          <p
            className={[
              "min-w-0 truncate text-[11px] leading-tight",
              done ? "text-gray-500" : "text-gray-600",
            ].join(" ")}
          >
            입주희망 {getCustomerMoveInLabel(c)}
          </p>
          {deadlineLabel ? (
            <p className="shrink-0 text-[11px] font-extrabold text-emerald-500">
              {deadlineLabel}
            </p>
          ) : null}
        </div>

        <div className="mt-1 flex items-center justify-between gap-3">
          <p
            className={[
              "min-w-0 flex-1 truncate text-[20px] font-extrabold tracking-tight leading-none",
              done ? "text-gray-600" : "text-gray-900",
            ].join(" ")}
          >
            {c.name}
          </p>
          <PhoneLink
            phone={c.phone}
            className={[
              "relative z-[1]",
              done
                ? "!shrink-0 !text-[16px] !font-bold !text-gray-500"
                : "!shrink-0 !text-[16px] !font-extrabold",
            ].join(" ")}
          />
        </div>

        {preferredLabel ? (
          <p
            data-testid="customer-card-preferred"
            className={[
              "mt-1.5 truncate text-[12px] font-semibold leading-snug",
              done ? "text-gray-500" : "text-gray-700",
            ].join(" ")}
          >
            {preferredLabel}
          </p>
        ) : null}

        {sharer || saved ? (
        <div
          className={[
            "flex items-center justify-between gap-2",
            preferredLabel ? "mt-0.5" : "mt-4",
          ].join(" ")}
        >
          <p className="min-w-0 truncate text-[11px] font-bold leading-none text-gray-500">
            {sharer}
          </p>
          {saved ? (
          <p
            className={[
              "shrink-0 text-[11px] font-bold leading-none",
              done ? "text-gray-500" : "text-gray-400",
            ].join(" ")}
          >
            {`등록일 · ${saved}`}
          </p>
          ) : null}
        </div>
        ) : null}
      </div>
    </Card>
  );

  return (
    <div
      className={[
        "relative mb-2.5 overflow-visible pb-0.5 pt-2",
        className,
      ].join(" ")}
    >
      <ListEdgeChips
        roomType={c.roomType}
        buildingKind={c.buildingKind}
        dealType={c.dealType}
        moneyLabel={getCustomerBudgetLabel(c)}
        depositMan={Math.max(c.deposit ?? 0, c.depositTo ?? 0)}
        done={done}
        right={right}
      />
      {renderCard(card)}
    </div>
  );
}
