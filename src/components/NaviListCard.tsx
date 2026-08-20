"use client";

import type { ReactElement, ReactNode } from "react";
import { EndedBadge } from "@/components/ListEdgeChips";
import { PhoneChip } from "@/components/PhoneLink";
import { formatVisitDateTime } from "@/lib/format";
import {
  formatSavedDate,
  isScheduleEnded,
  parseISODate,
  todayISO,
  toISODate,
} from "@/lib/date";
import { peekCurrentUser } from "@/lib/auth";
import { teamSharerLabel } from "@/lib/teamActionGuard";
import { parseSeoulAddress } from "@/lib/seoulRegions";
import {
  listCardAlertEffectFromBadges,
  listCardFrameClass,
  type AlertTab,
} from "@/lib/teamAlerts";
import { ListCardAlertBadges } from "@/components/ListCardAlertBadges";
import { useListCardAlertBadges } from "@/hooks/useListCardAlertBadges";
import type { Customer, Schedule } from "@/lib/types";

export function scheduleTitle(
  schedule: Schedule,
  customers: Record<string, Customer>
): string {
  if (schedule.guestName?.trim()) return schedule.guestName.trim();
  if (schedule.customerId) {
    const name = customers[schedule.customerId]?.name;
    if (name) return name;
  }
  return "고객 미지정";
}

export function schedulePhone(
  schedule: Schedule,
  customers: Record<string, Customer>
): string {
  if (schedule.customerId) {
    return customers[schedule.customerId]?.phone?.trim() || "";
  }
  return "";
}

function visitDongsLabel(schedule: Schedule): string {
  return [...schedule.properties]
    .sort((a, b) =>
      (a.arriveTime?.trim() || "99:99").localeCompare(
        b.arriveTime?.trim() || "99:99"
      )
    )
    .map((p) => parseSeoulAddress(p.address).dong.trim())
    .filter(Boolean)
    .join(", ");
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;

function visitWhenLabel(date?: string, time?: string): string {
  const base = formatVisitDateTime(date, time);
  if (!date || base === "-") return base;
  const parsed = parseISODate(date);
  if (!parsed) return base;
  const week = WEEKDAYS[parsed.getDay()];
  return base.replace(/일(?=\s|$)/, `일 (${week})`);
}

type WhenKind = "done" | "today" | "tomorrow" | "other";

function tomorrowISO(): string {
  const d = parseISODate(todayISO());
  if (!d) return "";
  d.setDate(d.getDate() + 1);
  return toISODate(d);
}

function visitWhenKind(date: string | undefined, done: boolean): WhenKind {
  if (done) return "done";
  const today = todayISO();
  if (!date) return "other";
  if (date === today) return "today";
  if (date === tomorrowISO()) return "tomorrow";
  return "other";
}

interface NaviListCardProps {
  schedule: Schedule;
  customers: Record<string, Customer>;
  right?: ReactNode;
  renderCard?: (card: ReactElement) => ReactNode;
  className?: string;
  alertTab?: AlertTab;
  viewerId?: string;
}

export function NaviListCard({
  schedule: s,
  customers,
  right,
  renderCard = (card) => card,
  className = "",
  alertTab = "navi",
  viewerId,
}: NaviListCardProps) {
  const done = isScheduleEnded(s);
  const kind = visitWhenKind(s.visitDate, done);
  const whenLabel = visitWhenLabel(s.visitDate, s.visitTime);
  const name = scheduleTitle(s, customers);
  const phone = schedulePhone(s, customers);
  const dongs = visitDongsLabel(s);
  const stopLabel = [`매물 ${s.properties.length}곳`, dongs || null]
    .filter(Boolean)
    .join(" · ");
  const saved = formatSavedDate(s.createdAt);
  const sharer = teamSharerLabel(
    s.createdByName,
    s.createdBy,
    viewerId ?? peekCurrentUser()?.id
  );
  const shareBadges = useListCardAlertBadges({ tab: alertTab, id: s.id });
  const naviWhenBadges = done || kind === "today" || kind === "tomorrow";
  const alertEffect =
    done || naviWhenBadges
      ? null
      : listCardAlertEffectFromBadges(shareBadges);
  const topShareBadges = done ? [] : shareBadges;
  const hasTopBadges =
    topShareBadges.length > 0 || done || kind === "today" || kind === "tomorrow";

  const card = (
    <article
      className={[
        "flex overflow-hidden rounded-xl",
        listCardFrameClass(done, alertEffect),
      ].join(" ")}
    >
      <div
        className={[
          "w-1.5 shrink-0",
          kind === "today"
            ? "bg-orange-500"
            : kind === "tomorrow"
              ? "bg-[#3182F6]"
              : done
                ? "bg-gray-400"
                : "bg-gray-300",
        ].join(" ")}
        aria-hidden
      />
      <div
        className={[
          "min-w-0 flex-1 px-3 pb-2.5",
          done || kind === "today" || kind === "tomorrow"
            ? "pt-3.5"
            : "pt-2.5",
        ].join(" ")}
      >
        <div className="flex items-center gap-2">
          <div
            className={[
              "flex min-w-0 flex-1 items-center rounded-lg px-2.5 py-1.5",
              kind === "today"
                ? "bg-orange-50"
                : kind === "tomorrow"
                  ? "bg-[#E8F3FF]"
                  : "bg-gray-50",
            ].join(" ")}
          >
            <p
              className={[
                "min-w-0 truncate text-[17px] font-extrabold leading-snug tracking-tight",
                kind === "today"
                  ? "text-orange-600"
                  : kind === "tomorrow"
                    ? "text-[#1B64DA]"
                    : "text-gray-500",
              ].join(" ")}
            >
              {whenLabel}
            </p>
          </div>
          {right ? (
            <div className="relative z-[1] shrink-0">{right}</div>
          ) : null}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <p
            className={[
              "min-w-0 truncate text-[16px] font-bold leading-none",
              done ? "text-gray-400" : "text-gray-800",
            ].join(" ")}
          >
            {name}
          </p>
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <span
              className={[
                "shrink-0 text-[12px] font-semibold",
                done ? "text-gray-400" : "text-gray-500",
              ].join(" ")}
            >
              고객
            </span>
            <PhoneChip
              phone={phone}
              done={done}
              className="!ml-0 !px-1.5 !py-1 !text-[20px] sm:!text-[18px]"
            />
          </div>
        </div>

        <div className="mt-2 flex items-center gap-2">
          <p
            className={[
              "min-w-0 truncate text-[14px] font-semibold leading-snug",
              done ? "text-gray-400" : "text-gray-600",
            ].join(" ")}
          >
            {stopLabel}
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
        hasTopBadges ? "pt-3" : "",
        className,
      ].join(" ")}
    >
      {hasTopBadges ? (
        <div className="absolute left-3 top-2.5 z-10 flex max-w-[calc(100%-1.5rem)] -translate-y-1/2 flex-wrap items-center gap-1">
          {done ? (
            <EndedBadge className="shadow-sm ring-2 ring-[#F9FAFB]" />
          ) : kind === "today" ? (
            <span className="shrink-0 rounded-lg border border-orange-400 bg-orange-50 px-2.5 py-1 text-[16px] font-extrabold leading-none text-orange-700 shadow-sm ring-2 ring-[#F9FAFB]">
              오늘
            </span>
          ) : kind === "tomorrow" ? (
            <span className="shrink-0 rounded-lg border border-[#3182F6] bg-[#E8F3FF] px-2.5 py-1 text-[16px] font-extrabold leading-none text-[#1B64DA] shadow-sm ring-2 ring-[#F9FAFB]">
              하루전
            </span>
          ) : null}
          <ListCardAlertBadges badges={topShareBadges} floating={false} />
        </div>
      ) : null}
      {renderCard(card)}
    </div>
  );
}
