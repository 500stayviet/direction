"use client";

import type { ReactElement, ReactNode } from "react";
import { PhoneChip } from "@/components/PhoneLink";
import {
  dealTypeBarClass,
  dealTypeTextClass,
  EndedBadge,
} from "@/components/ListEdgeChips";
import { displayRoomType } from "@/lib/constants";
import { formatDepositRent, getPropertyMoveInLabel } from "@/lib/format";
import { formatSavedDate } from "@/lib/date";
import { peekCurrentUser } from "@/lib/auth";
import { teamSharerLabel } from "@/lib/teamActionGuard";
import { formatCardAddress } from "@/lib/seoulRegions";
import { formatPropertyPlaceLine } from "@/lib/propertyRoomNo";
import { getPropertyDeadlineLabel, getDeadlineBadgeSortAt } from "@/lib/deadline";
import {
  listCardAlertEffectFromBadges,
  listCardFrameClass,
  type AlertTab,
  type ListCardBadge,
} from "@/lib/teamAlerts";
import { ListCardAlertBadges } from "@/components/ListCardAlertBadges";
import { useListCardAlertBadges } from "@/hooks/useListCardAlertBadges";
import type { ListedProperty } from "@/lib/types";
import {
  resolveMatchAgencyContact,
  type MatchAgencyContact,
} from "@/lib/matchAgencyContact";

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

export function getPropertyListAgencyContact(
  p: ListedProperty
): MatchAgencyContact {
  return resolveMatchAgencyContact(p);
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
  /** true면 협력 사무소명 (조건 매칭용) */
  showAgencyBadge?: boolean;
  /** 사이트내 공유 매칭 — 등록 부동산 상호·동·전화 */
  matchPartnerContact?: boolean;
  alertTab?: AlertTab;
  showListAlerts?: boolean;
  inlineBadges?: ListCardBadge[];
  /** 현재 로그인 사용자 id. 넘기면 카드마다 세션을 다시 읽지 않음 */
  viewerId?: string;
}

export function PropertyListCard({
  property: p,
  right,
  renderCard = (card) => card,
  className = "",
  cardClassName = "",
  showSavedDate = true,
  showAgencyBadge = false,
  matchPartnerContact = false,
  alertTab = "properties",
  showListAlerts = true,
  inlineBadges = [],
  viewerId,
}: PropertyListCardProps) {
  const saved = showSavedDate ? formatSavedDate(p.createdAt) : "";
  const moneyLabel = formatDepositRent(
    p.dealType ?? "",
    p.deposit,
    p.monthlyRent
  ).trim();
  const address = formatCardAddress((p.address ?? "").trim()) || "주소 미입력";
  const room = formatPropertyPlaceLine(p) || "";
  const contact = matchPartnerContact ? null : getPropertyListContact(p);
  const agencyContact = matchPartnerContact
    ? getPropertyListAgencyContact(p)
    : null;
  const done = Boolean(p.contractCompleted);
  const sharer = matchPartnerContact
    ? ""
    : teamSharerLabel(
        p.createdByName,
        p.createdBy,
        viewerId ?? peekCurrentUser()?.id
      );
  const typeLabel = displayRoomType(p.roomType, p.buildingKind);
  const dealLabel = p.dealType?.trim() || "";
  const typeText = typeLabel && typeLabel !== "-" ? typeLabel : "유형";
  const moneyText = moneyLabel && moneyLabel !== "-" ? moneyLabel : "";
  const moveInText = getPropertyMoveInLabel(p);
  const deadlineLabel = done ? null : getPropertyDeadlineLabel(p);
  const moveInStart = p.moveInFrom || (/^\d{4}-\d{2}-\d{2}$/.test(p.moveInDate ?? "") ? p.moveInDate : null);
  const deadlineAt = deadlineLabel ? getDeadlineBadgeSortAt(moveInStart) : 0;
  const listBadges = useListCardAlertBadges({
    tab: alertTab,
    id: p.id,
    deadlineLabel,
    deadlineAt,
  });
  const badges = showListAlerts ? listBadges : inlineBadges;
  const alertEffect = done ? null : listCardAlertEffectFromBadges(badges);
  const agencyText =
    showAgencyBadge && p.hasPartnerAgency
      ? p.partnerAgency?.name?.trim() || ""
      : "";

  const card = (
    <article
      className={[
        "flex overflow-hidden rounded-xl",
        listCardFrameClass(done, alertEffect),
        cardClassName,
      ].join(" ")}
    >
      <div
        className={["w-1.5 shrink-0", dealTypeBarClass(p.dealType, done)].join(
          " "
        )}
        aria-hidden
      />
      <div
        className={[
          "min-w-0 flex-1 px-3 pb-2.5",
          deadlineLabel ? "pt-3.5" : "pt-2.5",
        ].join(" ")}
      >
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              {done ? <EndedBadge /> : null}
              {dealLabel ? (
                <span
                  className={[
                    "text-[22px] font-extrabold leading-none tracking-tight",
                    dealTypeTextClass(p.dealType, done),
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
          {matchPartnerContact && agencyContact ? (
            <div className="flex min-w-0 max-w-[55%] shrink items-center justify-between gap-1">
              <span
                title={agencyContact.shopName}
                className={[
                  "min-w-0 truncate text-[12px] font-semibold",
                  done ? "text-gray-400" : "text-gray-500",
                ].join(" ")}
              >
                {agencyContact.shopName}
              </span>
              <span className="flex shrink-0 items-center gap-1">
                {agencyContact.dong ? (
                  <span className="shrink-0 rounded-md border border-gray-200 bg-white px-1 py-0.5 text-[10px] font-bold text-gray-500">
                    {agencyContact.dong}
                  </span>
                ) : null}
                <PhoneChip
                  phone={agencyContact.phone}
                  done={done}
                  className="!ml-0"
                />
              </span>
            </div>
          ) : (
            <div className="flex shrink-0 items-center gap-1">
              {contact?.label ? (
                <span
                  className={[
                    "max-w-[4.5rem] truncate text-[12px] font-semibold",
                    done ? "text-gray-400" : "text-gray-500",
                  ].join(" ")}
                >
                  {contact.label}
                </span>
              ) : null}
              <PhoneChip phone={contact?.phone} done={done} className="!ml-0" />
            </div>
          )}
        </div>

        <p
          title={[address, room].filter(Boolean).join(" ")}
          className={[
            "mt-1.5 min-w-0 w-full overflow-hidden text-ellipsis whitespace-nowrap text-[16px] font-bold leading-snug",
            done ? "text-gray-500" : "text-gray-800",
          ].join(" ")}
        >
          {address}
          {room ? (
            <span
              className={[
                "ml-1.5 text-[13px] font-semibold",
                done ? "text-gray-400" : "text-gray-500",
              ].join(" ")}
            >
              {room}
            </span>
          ) : null}
        </p>
        {agencyText && agencyText !== contact?.label ? (
          <p
            className={[
              "mt-0.5 truncate text-[12px] font-semibold",
              done ? "text-gray-400" : "text-gray-500",
            ].join(" ")}
          >
            {agencyText}
          </p>
        ) : null}
        <div className="mt-0.5 flex items-center gap-2">
          <p
            className={[
              "min-w-0 flex-1 truncate text-[14px] font-semibold leading-snug",
              done ? "text-gray-500" : "text-gray-700",
            ].join(" ")}
          >
            {moveInText}
          </p>
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
      </div>
    </article>
  );

  return (
    <div
      className={[
        "relative",
        badges.length > 0 || deadlineLabel ? "pt-2" : "",
        className,
      ].join(" ")}
    >
      <ListCardAlertBadges badges={badges} />
      {renderCard(card)}
    </div>
  );
}
