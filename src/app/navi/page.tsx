"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ListScrollShareTarget } from "@/components/ListScrollShareTarget";
import { PrefetchHref } from "@/components/PrefetchHref";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { SwipeRevealRow } from "@/components/SwipeRevealRow";
import { StickyActionBar } from "@/components/StickyActionBar";
import { NaviListCard, scheduleTitle } from "@/components/NaviListCard";
import { isScheduleEnded, todayISO } from "@/lib/date";
import { consumeListSwipeNudge } from "@/lib/customerSwipeHint";
import { deleteSchedule, setScheduleWorkspaceShared, upsertSchedule } from "@/lib/storage";
import { peekCurrentUser } from "@/lib/auth";
import {
  confirmForeignTeamDelete,
  confirmForeignTeamEdit,
  isForeignTeamItem,
} from "@/lib/teamActionGuard";
import {
  getTeamAlertsSnapshot,
  isShareUnseen,
  markShareSeen,
  subscribeTeamAlerts,
} from "@/lib/teamAlerts";
import {
  isEntityListEmptyConfirmed,
  showEntityListLoading,
  useCustomersList,
  useSchedulesList,
} from "@/hooks/useEntityList";
import { TeamShareChip } from "@/components/SiteShareUi";
import { isDemoEntityId } from "@/lib/demoSeedPayload";
import type { Customer, Schedule } from "@/lib/types";

type SortMode = "created" | "visit";

type PendingAction = {
  id: string;
  type: "complete" | "delete";
};

function visitStamp(schedule: Schedule): string {
  const date = schedule.visitDate || "9999-12-31";
  const time = schedule.visitTime || "00:00";
  return `${date}T${time}`;
}

function sortSchedules(list: Schedule[], mode: SortMode): Schedule[] {
  const items = [...list];
  const byDone = (a: Schedule, b: Schedule) => {
    const aDone = isScheduleEnded(a);
    const bDone = isScheduleEnded(b);
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
  const { items: schedules, status, setItems: setSchedules } =
    useSchedulesList();
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
    if (consumeListSwipeNudge("navi")) setNudgeFirstCard(true);
  }, [schedules.length]);

  const sorted = useMemo(
    () => sortSchedules(schedules, sortMode),
    [schedules, sortMode]
  );

  const pendingSchedule = pending
    ? schedules.find((s) => s.id === pending.id)
    : undefined;
  const pendingName = pendingSchedule
    ? scheduleTitle(pendingSchedule, customers)
    : "";

  const closePending = () => {
    if (busy) return;
    setPending(null);
  };

  const myId = peekCurrentUser()?.id;

  const toggleTeamShare = async (s: Schedule) => {
    if (busy) return;
    if (isDemoEntityId(s.id)) return;
    if (isForeignTeamItem(s.createdBy, myId)) return;
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
          visitCompleted: true,
          updatedAt: new Date().toISOString(),
        });
        setSchedules(next);
      }
      setNudgeFirstCard(false);
      setPending(null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "처리에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="-mx-4 min-h-dvh bg-[#F9FAFB] px-4 pb-4">
      <ListScrollShareTarget idPrefix="list-navi" />
      <PageHeader
        title="네비 시작하기"
        backHref="/"
        titleTone="navi"
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
        {showEntityListLoading(status, schedules.length) ? (
          <Card>
            <p className="text-sm text-gray-400">불러오는 중…</p>
          </Card>
        ) : sorted.length === 0 ? (
          <Card>
            <p className="text-sm text-gray-500">
              {isEntityListEmptyConfirmed(status, schedules.length)
                ? "저장된 방문 일정이 없습니다. 아래 버튼으로 만들어 주세요."
                : "표시할 일정이 없습니다."}
            </p>
          </Card>
        ) : (
          sorted.map((s, index) => {
            const done = isScheduleEnded(s);
            const href = `/schedules/${s.id}?from=navi`;
            const showTeamChip =
              Boolean(s.workspaceId) && !isDemoEntityId(s.id);
            return (
              <div key={s.id} id={`list-navi-${s.id}`}>
                <PrefetchHref href={href} />
                <NaviListCard
                  schedule={s}
                  customers={customers}
                  viewerId={myId}
                  right={
                    showTeamChip ? (
                      <TeamShareChip
                        shared={Boolean(s.workspaceShared)}
                        done={done}
                        disabled={busy}
                        locked={isForeignTeamItem(s.createdBy, myId)}
                        tone="quiet"
                        onToggle={() => void toggleTeamShare(s)}
                      />
                    ) : null
                  }
                  renderCard={(card) => (
                    <SwipeRevealRow
                      hintNudge={nudgeFirstCard && index === 0}
                      leftActionLabel={done ? "복구/수정" : "종료"}
                      onTap={() => {
                        if (isShareUnseen("navi", s.id)) {
                          markShareSeen("navi", s.id);
                        }
                        router.push(href);
                      }}
                      onSwipeLeft={() => {
                        if (done) {
                          markShareSeen("navi", s.id);
                          router.push(`${href}${href.includes("?") ? "&" : "?"}restore=1`);
                          return;
                        }
                        setPending({ id: s.id, type: "complete" });
                      }}
                      onSwipeRight={() =>
                        setPending({ id: s.id, type: "delete" })
                      }
                    >
                      {card}
                    </SwipeRevealRow>
                  )}
                />
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
            : "일정을 종료할까요?"
        }
        description={
          pendingSchedule
            ? pending?.type === "delete"
              ? `${pendingName} 방문 일정을 삭제합니다.`
              : `${pendingName} 일정을 종료 처리합니다. 목록 하단으로 이동합니다.`
            : pending?.type === "delete"
              ? "이 방문 일정을 삭제합니다."
              : "이 일정을 종료 처리합니다."
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
