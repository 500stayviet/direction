"use client";

import type { ReactElement, ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { PhoneLink } from "@/components/PhoneLink";
import { ListEdgeChips } from "@/components/ListEdgeChips";
import { formatDepositRent, formatMoveInRange } from "@/lib/format";
import { formatSavedDate } from "@/lib/date";
import { peekCurrentUser } from "@/lib/auth";
import { teamSharerLabel } from "@/lib/teamActionGuard";
import { alertHighlightClass } from "@/lib/teamAlerts";
import type { ListedProperty } from "@/lib/types";

export function getPropertyListContact(p: ListedProperty): {
  label: string;
  phone: string;
} | null {
  if (p.hasPartnerAgency) {
    const partner = p.partnerAgency?.phone?.trim();
    if (partner) {
      const name = p.partnerAgency?.name?.trim();
      return { label: name || "협력부동산", phone: partner };
    }
  }
  const landlord = p.landlordPhone?.trim();
  if (landlord) return { label: "임대인", phone: landlord };
  const tenant = p.tenantPhone?.trim();
  if (tenant) return { label: "임차인", phone: tenant };
  return null;
}

interface PropertyListCardProps {
  property: ListedProperty;
  /** 칩 오른쪽 (팀 공유 버튼 등) */
  right?: ReactNode;
  /** 카드 본문 감싸기 (스와이프 행 등). 기본은 카드 그대로 */
  renderCard?: (card: ReactElement) => ReactNode;
  className?: string;
  cardClassName?: string;
  /** false면 등록일 숨김 */
  showSavedDate?: boolean;
  /** true면 테두리 칩에 협력 사무소명 (조건 매칭용) */
  showAgencyBadge?: boolean;
  /** 공유 신규(정적) | 매칭 신규(반짝임) */
  alertHighlight?: "share" | "match" | null;
}

export function PropertyListCard({
  property: p,
  right,
  renderCard = (card) => card,
  className = "",
  cardClassName = "",
  showSavedDate = true,
  showAgencyBadge = false,
  alertHighlight = null,
}: PropertyListCardProps) {
  const saved = showSavedDate ? formatSavedDate(p.createdAt) : "";
  const moneyChip = formatDepositRent(p.dealType ?? "", p.deposit, p.monthlyRent);
  const address = (p.address ?? "").trim() || "주소 미입력";
  const room = (p.roomNo ?? "").trim();
  const contact = getPropertyListContact(p);
  const done = Boolean(p.contractCompleted);
  const sharer = teamSharerLabel(
    p.createdByName,
    p.createdBy,
    peekCurrentUser()?.id
  );

  const card = (
    <Card
      className={[
        "relative !rounded-2xl !px-3 !pb-2 !pt-3",
        alertHighlightClass(done ? null : alertHighlight, done, "properties"),
        cardClassName,
      ].join(" ")}
    >
      <div className="relative">
        <p
          className={[
            "mt-1 min-w-0 text-[11px] leading-tight",
            done ? "text-gray-500" : "text-gray-600",
          ].join(" ")}
        >
          입주가능{" "}
          {formatMoveInRange(p.moveInFrom, p.moveInTo, p.moveInDate)}
        </p>

        <p
          className={[
            "mt-0.5 min-w-0 truncate text-[18px] font-extrabold tracking-tight leading-snug",
            done ? "text-gray-600" : "text-gray-900",
          ].join(" ")}
        >
          {address}
          {room ? (
            <span
              className={[
                "ml-1.5 text-[13px] font-semibold",
                done ? "text-gray-500" : "text-gray-400",
              ].join(" ")}
            >
              {room}
            </span>
          ) : null}
        </p>

        <div className="mt-1.5 flex items-center justify-end gap-2">
          {contact ? (
            <>
              <span
                className={[
                  "shrink-0 text-[12px] font-bold",
                  done ? "text-gray-500" : "text-gray-400",
                ].join(" ")}
              >
                {contact.label}
              </span>
              <PhoneLink
                phone={contact.phone}
                className={[
                  "relative z-[1] !shrink-0 !text-[16px] !font-extrabold",
                  done ? "!text-gray-500" : "",
                ].join(" ")}
              />
            </>
          ) : (
            <span className="text-[13px] font-semibold text-gray-300">
              번호 없음
            </span>
          )}
        </div>

        {sharer || saved ? (
        <div className="mt-0.5 flex items-center justify-between gap-2">
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
        roomType={p.roomType}
        buildingKind={p.buildingKind}
        dealType={p.dealType}
        moneyLabel={moneyChip}
        depositMan={p.deposit}
        done={done}
        agencyLabel={
          showAgencyBadge && p.hasPartnerAgency
            ? p.partnerAgency?.name?.trim() || null
            : null
        }
        right={right}
      />
      {renderCard(card)}
    </div>
  );
}
