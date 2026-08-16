"use client";

import type { ReactElement, ReactNode } from "react";
import { PhoneLink } from "@/components/PhoneLink";
import { dealTypeBarClass, dealTypeTextClass } from "@/components/ListEdgeChips";
import { displayRoomType } from "@/lib/constants";
import { formatDepositRent, formatMoveInRange } from "@/lib/format";
import { formatSavedDate } from "@/lib/date";
import { peekCurrentUser } from "@/lib/auth";
import { teamSharerLabel } from "@/lib/teamActionGuard";
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
  /** true면 협력 사무소명 (조건 매칭용) */
  showAgencyBadge?: boolean;
  /** 공유 신규(정적) | 매칭 신규(반짝임) */
  alertHighlight?: "share" | "match" | null;
}

function frameClass(
  done: boolean,
  highlight: "share" | "match" | null | undefined
): string {
  if (done) return "border-gray-200 bg-gray-50";
  if (highlight === "share") return "border-emerald-400 bg-white";
  if (highlight === "match") return "animate-border-sparkle bg-white";
  return "border-gray-200 bg-white";
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
  const moneyLabel = formatDepositRent(
    p.dealType ?? "",
    p.deposit,
    p.monthlyRent
  ).trim();
  const address = (p.address ?? "").trim() || "주소 미입력";
  const room = (p.roomNo ?? "").trim();
  const contact = getPropertyListContact(p);
  const done = Boolean(p.contractCompleted);
  const sharer = teamSharerLabel(
    p.createdByName,
    p.createdBy,
    peekCurrentUser()?.id
  );
  const typeLabel = displayRoomType(p.roomType, p.buildingKind);
  const dealLabel = p.dealType?.trim() || "";
  const typeText = typeLabel && typeLabel !== "-" ? typeLabel : "유형";
  const moneyText = moneyLabel && moneyLabel !== "-" ? moneyLabel : "";
  const moveInText = formatMoveInRange(p.moveInFrom, p.moveInTo, p.moveInDate);
  const agencyText =
    showAgencyBadge && p.hasPartnerAgency
      ? p.partnerAgency?.name?.trim() || ""
      : "";

  const card = (
    <article
      className={[
        "flex overflow-hidden rounded-xl border",
        frameClass(done, done ? null : alertHighlight),
        cardClassName,
      ].join(" ")}
    >
      <div
        className={["w-1.5 shrink-0", dealTypeBarClass(p.dealType, done)].join(
          " "
        )}
        aria-hidden
      />
      <div className="min-w-0 flex-1 px-3 py-2.5">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
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
            {moneyText ? (
              <p
                className={[
                  "mt-1.5 truncate text-[22px] font-extrabold leading-none tracking-tight",
                  done ? "text-gray-500" : "text-gray-900",
                ].join(" ")}
              >
                {moneyText}
              </p>
            ) : null}
          </div>
          {right ? (
            <div className="relative z-[1] shrink-0 pt-0.5">{right}</div>
          ) : null}
        </div>

        <p
          className={[
            "mt-2 truncate text-[16px] font-bold leading-snug",
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
        <p
          className={[
            "mt-1 truncate text-[13px] font-medium leading-snug",
            done ? "text-gray-400" : "text-gray-500",
          ].join(" ")}
        >
          입주가능 {moveInText}
        </p>

        {agencyText && agencyText !== contact?.label ? (
          <p
            className={[
              "mt-1 truncate text-[12px] font-semibold",
              done ? "text-gray-400" : "text-gray-500",
            ].join(" ")}
          >
            {agencyText}
          </p>
        ) : null}

        <div className="mt-1 flex items-center gap-1.5">
          {contact ? (
            <>
              <span
                className={[
                  "shrink-0 text-[13px] font-semibold",
                  done ? "text-gray-400" : "text-gray-500",
                ].join(" ")}
              >
                {contact.label}
              </span>
              <PhoneLink
                phone={contact.phone}
                showIcon={false}
                className={[
                  "relative z-[1] !text-[14px] !font-semibold",
                  done ? "!text-gray-400" : "",
                ].join(" ")}
              />
            </>
          ) : (
            <span className="text-[13px] font-medium text-gray-300">
              번호 없음
            </span>
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
      </div>
    </article>
  );

  return (
    <div className={["relative", className].join(" ")}>{renderCard(card)}</div>
  );
}
