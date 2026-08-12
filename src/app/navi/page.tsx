"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { PhoneLink } from "@/components/PhoneLink";
import { ListEdgeChips } from "@/components/ListEdgeChips";
import { SwipeRevealRow } from "@/components/SwipeRevealRow";
import { StickyActionBar } from "@/components/StickyActionBar";
import { formatSavedDate, todayISO } from "@/lib/date";
import {
  formatVisitDateTime,
  getCustomerBudgetLabel,
} from "@/lib/format";
import {
  consumeCustomerSwipeNudge,
  markCustomerSwipeUsed,
} from "@/lib/customerSwipeHint";
import { parseSeoulAddress } from "@/lib/seoulRegions";
import { deleteSchedule, setScheduleWorkspaceShared, upsertSchedule } from "@/lib/storage";
import { peekCurrentUser } from "@/lib/auth";
import {
  confirmForeignTeamDelete,
  confirmForeignTeamEdit,
  isForeignTeamItem,
  teamSharerLabel,
} from "@/lib/teamActionGuard";
import {
  alertHighlightClass,
  getTeamAlertsSnapshot,
  listCardHighlight,
  markShareSeen,
  subscribeTeamAlerts,
} from "@/lib/teamAlerts";
import { useCustomersList, useSchedulesList } from "@/hooks/useEntityList";
import type { Customer, Schedule } from "@/lib/types";

type SortMode = "created" | "visit";

type PendingAction = {
  id: string;
  type: "complete" | "delete";
};

function scheduleTitle(
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

function schedulePhone(
  schedule: Schedule,
  customers: Record<string, Customer>
): string {
  if (schedule.customerId) {
    return customers[schedule.customerId]?.phone?.trim() || "";
  }
  return "";
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

function visitStamp(schedule: Schedule): string {
  const date = schedule.visitDate || "9999-12-31";
  const time = schedule.visitTime || "00:00";
  return `${date}T${time}`;
}

function sortSchedules(list: Schedule[], mode: SortMode): Schedule[] {
  const items = [...list];
  const byDone = (a: Schedule, b: Schedule) => {
    const aDone = Boolean(a.visitCompleted);
    const bDone = Boolean(b.visitCompleted);
    if (aDone !== bDone) return aDone ? 1 : -1;
    return 0;
  };

  if (mode === "created") {
    return items.sort((a, b) => {
      const done = byDone(a, b);
      if (done !== 0) return done;
      return (b.createdAt || "").localeCompare(a.createdAt || "");
    });
  }

  const today = todayISO();
  return items.sort((a, b) => {
    const done = byDone(a, b);
    if (done !== 0) return done;

    const aDate = a.visitDate || "";
    const bDate = b.visitDate || "";
    const aPast = Boolean(aDate && aDate < today);
    const bPast = Boolean(bDate && bDate < today);
    if (aPast !== bPast) return aPast ? 1 : -1;

    const cmp = visitStamp(a).localeCompare(visitStamp(b));
    return aPast ? -cmp : cmp;
  });
}

export default function NaviEntryPage() {
  const router = useRouter();
  const { items: schedules, setItems: setSchedules } = useSchedulesList();
  const { items: customerList } = useCustomersList();
  const customers = useMemo(() => {
    const map: Record<string, Customer> = {};
    for (const c of customerList) map[c.id] = c;
    return map;
  }, [customerList]);
  const [sortMode, setSortMode] = useState<SortMode>("visit");
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [nudgeFirstCard, setNudgeFirstCard] = useState(false);
  useSyncExternalStore(
    subscribeTeamAlerts,
    getTeamAlertsSnapshot,
    getTeamAlertsSnapshot
  );

  useEffect(() => {
    if (schedules.length === 0) return;
    if (consumeCustomerSwipeNudge()) setNudgeFirstCard(true);
  }, [schedules.length]);

  const sorted = useMemo(
    () => sortSchedules(schedules, sortMode),
    [schedules, sortMode]
  );

  const pendingSchedule = pending
    ? schedules.find((s) => s.id === pending.id)
    : undefined;
  const pendingDone = Boolean(pendingSchedule?.visitCompleted);
  const pendingName = pendingSchedule
    ? scheduleTitle(pendingSchedule, customers)
    : "";

  const closePending = () => {
    if (busy) return;
    setPending(null);
  };

  const toggleTeamShare = async (s: Schedule) => {
    if (busy) return;
    const prevShared = Boolean(s.workspaceShared);
    const nextShared = !prevShared;
    setSchedules((prev) =>
      prev.map((item) =>
        item.id === s.id
          ? { ...item, workspaceShared: nextShared }
          : item
      )
    );
    setBusy(true);
    try {
      const updated = await setScheduleWorkspaceShared(s.id, nextShared);
      if (updated) {
        setSchedules((prev) =>
          prev.map((item) => (item.id === updated.id ? updated : item))
        );
      }
    } catch (err: unknown) {
      setSchedules((prev) =>
        prev.map((item) =>
          item.id === s.id
            ? { ...item, workspaceShared: prevShared }
            : item
        )
      );
      alert(err instanceof Error ? err.message : "팀 공유 변경에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const confirmPending = async () => {
    if (!pending || !pendingSchedule || busy) return;
    const myId = peekCurrentUser()?.id;
    const foreign = isForeignTeamItem(pendingSchedule.createdBy, myId);
    if (foreign) {
      const ok =
        pending.type === "delete"
          ? confirmForeignTeamDelete("네비")
          : confirmForeignTeamEdit("네비");
      if (!ok) return;
    }
    setBusy(true);
    try {
      if (pending.type === "delete") {
        await deleteSchedule(pendingSchedule.id);
        setSchedules((prev) =>
          prev.filter((s) => s.id !== pendingSchedule.id)
        );
      } else {
        const next = await upsertSchedule({
          ...pendingSchedule,
          visitCompleted: !pendingDone,
          updatedAt: new Date().toISOString(),
        });
        setSchedules(next);
      }
      markCustomerSwipeUsed();
      setNudgeFirstCard(false);
      setPending(null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "처리에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

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
          생성 날짜순
        </button>
      </div>

      <div className="space-y-2 overflow-visible pr-2">
        {sorted.length === 0 ? (
          <Card>
            <p className="text-sm text-gray-500">
              저장된 방문 일정이 없습니다. 아래 버튼으로 만들어 주세요.
            </p>
          </Card>
        ) : (
          sorted.map((s, index) => {
            const dongs = visitDongsLabel(s);
            const name = scheduleTitle(s, customers);
            const phone = schedulePhone(s, customers);
            const customer = s.customerId ? customers[s.customerId] : null;
            const saved = formatSavedDate(s.createdAt);
            const done = Boolean(s.visitCompleted);
            const propertyLine = [
              `매물 ${s.properties.length}곳`,
              dongs || null,
            ]
              .filter(Boolean)
              .join(" · ");

            return (
              <div
                key={s.id}
                className="relative mb-2.5 overflow-visible pb-0.5 pt-2"
              >
                <ListEdgeChips
                  roomType={customer?.roomType}
                  buildingKind={customer?.buildingKind}
                  dealType={customer?.dealType}
                  moneyLabel={
                    customer ? getCustomerBudgetLabel(customer) : null
                  }
                  depositMan={
                    customer
                      ? Math.max(customer.deposit ?? 0, customer.depositTo ?? 0)
                      : null
                  }
                  done={done}
                  right={
                    <button
                      type="button"
                      disabled={busy}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        void toggleTeamShare(s);
                      }}
                      className={[
                        "inline-flex shrink-0 cursor-pointer rounded-lg px-1.5 py-0.5 text-[11px] font-extrabold text-white shadow-sm transition-opacity hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60",
                        done
                          ? "bg-gray-400"
                          : s.workspaceShared
                            ? "bg-emerald-500"
                            : "bg-gray-500",
                      ].join(" ")}
                    >
                      {s.workspaceShared ? "팀 공유 중" : "팀 공유하기"}
                    </button>
                  }
                />

                <SwipeRevealRow
                  hintNudge={nudgeFirstCard && index === 0}
                  onTap={() => {
                    markShareSeen("navi", s.id);
                    router.push(`/schedules/${s.id}?from=navi`);
                  }}
                  onSwipeLeft={() =>
                    setPending({ id: s.id, type: "complete" })
                  }
                  onSwipeRight={() =>
                    setPending({ id: s.id, type: "delete" })
                  }
                >
                  <Card
                    className={[
                      "relative !rounded-2xl !border-2 !px-3 !pb-2.5 !pt-3 !shadow-none",
                      alertHighlightClass(
                        done ? null : listCardHighlight("navi", s.id),
                        done
                      ),
                    ].join(" ")}
                  >
                    <div className="relative">
                      <p
                        className={[
                          "min-w-0 text-[15px] font-extrabold leading-snug tracking-tight",
                          done ? "text-gray-500" : "text-[#3182F6]",
                        ].join(" ")}
                      >
                        {formatVisitDateTime(s.visitDate, s.visitTime)}
                      </p>

                      <div className="mt-2 flex items-center justify-between gap-3">
                        <p
                          className={[
                            "min-w-0 flex-1 truncate text-[20px] font-extrabold tracking-tight leading-none",
                            done ? "text-gray-600" : "text-gray-900",
                          ].join(" ")}
                        >
                          {name}
                        </p>
                        {phone ? (
                          <PhoneLink
                            phone={phone}
                            className={[
                              "relative z-[1] !shrink-0 !text-[16px] !font-extrabold",
                              done ? "!text-gray-500" : "",
                            ].join(" ")}
                          />
                        ) : (
                          <span className="shrink-0 text-[13px] font-semibold text-gray-300">
                            번호 없음
                          </span>
                        )}
                      </div>

                      <div className="mt-3">
                        <p
                          className={[
                            "min-w-0 truncate text-[13px] font-semibold leading-snug",
                            done ? "text-gray-500" : "text-gray-600",
                          ].join(" ")}
                        >
                          {propertyLine}
                        </p>
                        <div className="mt-3 flex items-center justify-between gap-2">
                          <p className="min-w-0 truncate text-[11px] font-bold leading-none text-gray-500">
                            {teamSharerLabel(
                              s.createdByName,
                              s.createdBy,
                              peekCurrentUser()?.id
                            )}
                          </p>
                          <p className="shrink-0 text-[11px] font-bold leading-none text-gray-400">
                            {saved ? `등록일 · ${saved}` : "-"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </Card>
                </SwipeRevealRow>
              </div>
            );
          })
        )}
      </div>

      <StickyActionBar>
        <Link href="/schedules/new">
          <Button fullWidth size="lg">
            방문 일정 만들기
          </Button>
        </Link>
      </StickyActionBar>

      <Modal
        open={Boolean(pending)}
        onClose={closePending}
        title={
          pending?.type === "delete"
            ? "일정을 삭제할까요?"
            : pendingDone
              ? "종료를 취소할까요?"
              : "일정을 종료할까요?"
        }
        description={
          pendingSchedule
            ? pending?.type === "delete"
              ? `${pendingName} 방문 일정을 삭제합니다.`
              : pendingDone
                ? `${pendingName} 일정을 진행 중 상태로 되돌립니다.`
                : `${pendingName} 일정을 종료 처리합니다. 목록 하단으로 이동합니다.`
            : pending?.type === "delete"
              ? "이 방문 일정을 삭제합니다."
              : "일정의 종료 상태를 변경합니다."
        }
      >
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="secondary"
            disabled={busy}
            onClick={closePending}
          >
            아니오
          </Button>
          <Button
            disabled={busy}
            className={
              pending?.type === "delete"
                ? "!bg-red-500 hover:!bg-red-600"
                : undefined
            }
            onClick={() => void confirmPending()}
          >
            {busy ? "처리 중…" : "예"}
          </Button>
        </div>
      </Modal>
    </main>
  );
}
