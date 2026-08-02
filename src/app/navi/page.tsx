"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { todayISO } from "@/lib/date";
import { formatVisitDateTime } from "@/lib/format";
import { parseSeoulAddress } from "@/lib/seoulRegions";
import { getCustomerById, getSchedules } from "@/lib/storage";
import type { Schedule } from "@/lib/types";

type SortMode = "created" | "visit";

function scheduleTitle(
  schedule: Schedule,
  customerNames: Record<string, string>
): string {
  if (schedule.guestName?.trim()) return schedule.guestName.trim();
  if (schedule.customerId) {
    const name = customerNames[schedule.customerId];
    if (name) return name;
  }
  return "손님 미지정";
}

/** 매물 주소에서 선택한 동만 모음. 방문 약속 시간 순 · 쉼표 구분 */
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

function formatCreatedAt(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${m}/${day} ${hh}:${mm}`;
}

function visitStamp(schedule: Schedule): string {
  const date = schedule.visitDate || "9999-12-31";
  const time = schedule.visitTime || "00:00";
  return `${date}T${time}`;
}

function sortSchedules(list: Schedule[], mode: SortMode): Schedule[] {
  const items = [...list];
  if (mode === "created") {
    return items.sort((a, b) =>
      (b.createdAt || "").localeCompare(a.createdAt || "")
    );
  }

  const today = todayISO();
  return items.sort((a, b) => {
    const aDate = a.visitDate || "";
    const bDate = b.visitDate || "";
    const aPast = Boolean(aDate && aDate < today);
    const bPast = Boolean(bDate && bDate < today);
    if (aPast !== bPast) return aPast ? 1 : -1;

    const cmp = visitStamp(a).localeCompare(visitStamp(b));
    // 다가오는 일정: 빠른 순 / 지난 일정: 최근이 위
    return aPast ? -cmp : cmp;
  });
}

export default function NaviEntryPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [customerNames, setCustomerNames] = useState<Record<string, string>>(
    {}
  );
  const [sortMode, setSortMode] = useState<SortMode>("visit");

  useEffect(() => {
    void (async () => {
      const list = await getSchedules();
      setSchedules(list);
      const names: Record<string, string> = {};
      await Promise.all(
        list.map(async (s) => {
          if (!s.customerId || names[s.customerId]) return;
          const c = await getCustomerById(s.customerId);
          if (c?.name) names[s.customerId] = c.name;
        })
      );
      setCustomerNames(names);
    })();
  }, []);

  const sorted = useMemo(
    () => sortSchedules(schedules, sortMode),
    [schedules, sortMode]
  );

  return (
    <main>
      <PageHeader
        title="네비 시작하기"
        backHref="/"
        subtitle="만든 방문 일정을 고르고 현장으로 이동하세요"
      />

      <div className="mb-3 grid grid-cols-2 gap-1.5 rounded-xl bg-gray-100 p-1">
        <button
          type="button"
          onClick={() => setSortMode("visit")}
          className={[
            "min-h-[40px] rounded-lg text-[13px] font-bold transition-all duration-150 active:scale-[0.98]",
            sortMode === "visit"
              ? "bg-white text-[#3182F6] shadow-sm"
              : "text-gray-500",
          ].join(" ")}
        >
          예약 날짜순
        </button>
        <button
          type="button"
          onClick={() => setSortMode("created")}
          className={[
            "min-h-[40px] rounded-lg text-[13px] font-bold transition-all duration-150 active:scale-[0.98]",
            sortMode === "created"
              ? "bg-white text-[#3182F6] shadow-sm"
              : "text-gray-500",
          ].join(" ")}
        >
          만든 날짜순
        </button>
      </div>

      <div className="space-y-2">
        {sorted.length === 0 ? (
          <Card>
            <p className="text-sm text-gray-500">
              저장된 방문 일정이 없습니다. 일정을 먼저 만들어 주세요.
            </p>
            <Link href="/schedules/new">
              <Button className="mt-3" fullWidth>
                방문 일정 만들기
              </Button>
            </Link>
          </Card>
        ) : (
          sorted.map((s) => {
            const dongs = visitDongsLabel(s);
            return (
              <Link
                key={s.id}
                href={`/schedules/${s.id}?from=navi`}
                className="block"
              >
                <Card
                  pressable
                  className="px-3.5 py-2.5 active:scale-[0.99] transition-all duration-150"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 flex-1 text-[16px] font-extrabold leading-snug tracking-tight text-[#3182F6]">
                      {formatVisitDateTime(s.visitDate, s.visitTime)}
                    </p>
                    <p className="max-w-[10rem] shrink-0 truncate text-right text-[16px] font-extrabold leading-snug text-gray-900">
                      {scheduleTitle(s, customerNames)}
                    </p>
                  </div>

                  <p className="mt-1 text-[14px] font-semibold leading-snug text-gray-700">
                    매물 {s.properties.length}곳
                    {dongs ? (
                      <>
                        <span className="mx-1.5 font-medium text-gray-300">
                          ·
                        </span>
                        <span className="font-semibold text-gray-600">
                          {dongs}
                        </span>
                      </>
                    ) : null}
                  </p>

                  <p className="mt-1 text-right text-[11px] font-medium leading-none text-gray-400">
                    {formatCreatedAt(s.createdAt)}
                  </p>
                </Card>
              </Link>
            );
          })
        )}
      </div>
    </main>
  );
}
