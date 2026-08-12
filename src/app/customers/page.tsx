"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { CustomerSearchInput } from "@/components/CustomerSearchInput";
import { CustomerListCard } from "@/components/CustomerListCard";
import { StickyActionBar } from "@/components/StickyActionBar";
import { SwipeRevealRow } from "@/components/SwipeRevealRow";
import {
  matchesBudgetSearch,
  matchesPhoneSearch,
} from "@/lib/format";
import {
  consumeCustomerSwipeNudge,
  markCustomerSwipeUsed,
} from "@/lib/customerSwipeHint";
import { deleteCustomer, upsertCustomer } from "@/lib/storage";
import { peekCurrentUser } from "@/lib/auth";
import {
  confirmForeignTeamDelete,
  confirmForeignTeamEdit,
  isForeignTeamItem,
} from "@/lib/teamActionGuard";
import {
  getTeamAlertsSnapshot,
  hasUnseenMatchForCustomer,
  listCardHighlight,
  markShareSeen,
  subscribeTeamAlerts,
} from "@/lib/teamAlerts";
import { useCustomersList } from "@/hooks/useEntityList";
import { isDemoEntityId } from "@/lib/demoSeedPayload";
import { TeamShareChip } from "@/components/SiteShareUi";
import type { Customer } from "@/lib/types";

type PendingAction = {
  id: string;
  type: "complete" | "delete";
};

export default function CustomerListPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const { items: customers, setItems: setCustomers } = useCustomersList();
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [nudgeFirstCard, setNudgeFirstCard] = useState(false);
  useSyncExternalStore(
    subscribeTeamAlerts,
    getTeamAlertsSnapshot,
    getTeamAlertsSnapshot
  );

  useEffect(() => {
    if (customers.length === 0) return;
    if (consumeCustomerSwipeNudge()) setNudgeFirstCard(true);
  }, [customers.length]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? customers.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            matchesPhoneSearch(c.phone, q) ||
            matchesBudgetSearch(c, q) ||
            (c.moveInFrom ?? "").includes(q) ||
            (c.moveInTo ?? "").includes(q) ||
            (c.moveInDate ?? "").toLowerCase().includes(q)
        )
      : customers;
    return [...list].sort((a, b) => {
      const aDone = Boolean(a.contractCompleted);
      const bDone = Boolean(b.contractCompleted);
      if (aDone !== bDone) return aDone ? 1 : -1;
      return (
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    });
  }, [customers, query]);

  const pendingCustomer = pending
    ? customers.find((c) => c.id === pending.id)
    : undefined;
  const pendingDone = Boolean(pendingCustomer?.contractCompleted);

  const closePending = () => {
    if (busy) return;
    setPending(null);
  };

  const openCustomer = (c: Customer) => {
    markShareSeen("customers", c.id);
    const scroll = hasUnseenMatchForCustomer(c.id) ? "?scrollMatch=1" : "";
    router.push(`/customers/${c.id}${scroll}`);
  };

  const myId = peekCurrentUser()?.id;

  const toggleWorkspaceShare = async (c: Customer) => {
    if (busy) return;
    if (isForeignTeamItem(c.createdBy, myId)) return;
    const prevShared = Boolean(c.workspaceShared);
    const optimistic: Customer = {
      ...c,
      workspaceShared: !prevShared,
      updatedAt: new Date().toISOString(),
    };
    setCustomers((list) =>
      list.map((item) => (item.id === c.id ? optimistic : item))
    );
    setBusy(true);
    try {
      await upsertCustomer(optimistic);
    } catch (err: unknown) {
      setCustomers((list) =>
        list.map((item) =>
          item.id === c.id ? { ...c, workspaceShared: prevShared } : item
        )
      );
      alert(err instanceof Error ? err.message : "팀 공유 변경에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const confirmPending = async () => {
    if (!pending || !pendingCustomer || busy) return;
    const myId = peekCurrentUser()?.id;
    const foreign = isForeignTeamItem(pendingCustomer.createdBy, myId);
    if (foreign) {
      const ok =
        pending.type === "delete"
          ? confirmForeignTeamDelete("고객")
          : confirmForeignTeamEdit("고객");
      if (!ok) return;
    }
    setBusy(true);
    try {
      if (pending.type === "delete") {
        await deleteCustomer(pendingCustomer.id);
        setCustomers((prev) => prev.filter((c) => c.id !== pendingCustomer.id));
      } else {
        const next = await upsertCustomer({
          ...pendingCustomer,
          contractCompleted: !pendingDone,
          updatedAt: new Date().toISOString(),
        });
        setCustomers(next);
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
        title="고객리스트"
        backHref="/"
        subtitle={`등록 ${customers.length}명`}
      />

      <div className="space-y-3 pb-4">
        <Card>
          <CustomerSearchInput
            value={query}
            onChange={setQuery}
          />
        </Card>

        {filtered.length === 0 ? (
          <Card>
            <p className="text-sm text-gray-500">
              {customers.length === 0
                ? "등록된 고객이 없습니다. 아래 버튼으로 추가해 주세요."
                : "검색 결과가 없습니다."}
            </p>
          </Card>
        ) : (
          <div className="space-y-2 overflow-visible pr-2">
            {filtered.map((c, index) => {
              const done = Boolean(c.contractCompleted);
              const showTeamChip =
                Boolean(c.workspaceId) || isDemoEntityId(c.id);
              const shared = Boolean(c.workspaceShared);
              const foreign = isForeignTeamItem(c.createdBy, myId);

              return (
                <CustomerListCard
                  key={c.id}
                  customer={c}
                  alertHighlight={listCardHighlight("customers", c.id)}
                  right={
                    showTeamChip ? (
                      <TeamShareChip
                        shared={shared}
                        done={done}
                        disabled={busy}
                        locked={foreign}
                        onToggle={() => void toggleWorkspaceShare(c)}
                      />
                    ) : null
                  }
                  renderCard={(card) => (
                    <SwipeRevealRow
                      hintNudge={nudgeFirstCard && index === 0}
                      leftActionLabel="계약완료"
                      onTap={() => openCustomer(c)}
                      onSwipeLeft={() =>
                        setPending({ id: c.id, type: "complete" })
                      }
                      onSwipeRight={() =>
                        setPending({ id: c.id, type: "delete" })
                      }
                    >
                      {card}
                    </SwipeRevealRow>
                  )}
                />
              );
            })}
          </div>
        )}
      </div>

      <StickyActionBar>
        <Link href="/customers/new">
          <Button fullWidth size="lg">
            고객등록하기
          </Button>
        </Link>
      </StickyActionBar>

      <Modal
        open={Boolean(pending)}
        onClose={closePending}
        title={
          pending?.type === "delete"
            ? "고객을 삭제할까요?"
            : pendingDone
              ? "계약완료를 취소할까요?"
              : "고객을 계약완료할까요?"
        }
        description={
          pendingCustomer
            ? pending?.type === "delete"
              ? `${pendingCustomer.name} 고객과 관련 방문 일정이 함께 삭제됩니다.`
              : pendingDone
                ? `${pendingCustomer.name} 고객을 진행 중 상태로 되돌립니다.`
                : `${pendingCustomer.name} 고객을 계약완료 처리합니다. 목록 하단으로 이동합니다.`
            : pending?.type === "delete"
              ? "관련 방문 일정도 함께 삭제됩니다."
              : "해당 고객의 계약완료 상태를 변경합니다."
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
