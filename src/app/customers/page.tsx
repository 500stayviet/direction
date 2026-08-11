"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { PhoneLink } from "@/components/PhoneLink";
import { CustomerSearchInput } from "@/components/CustomerSearchInput";
import { StickyActionBar } from "@/components/StickyActionBar";
import { SwipeRevealRow } from "@/components/SwipeRevealRow";
import { ListEdgeChips } from "@/components/ListEdgeChips";
import {
  getCustomerBudgetLabel,
  getCustomerMoveInLabel,
  matchesBudgetSearch,
  matchesPhoneSearch,
} from "@/lib/format";
import { formatSavedDate } from "@/lib/date";
import { getContractDeadlineLabel } from "@/lib/deadline";
import {
  consumeCustomerSwipeNudge,
  markCustomerSwipeUsed,
} from "@/lib/customerSwipeHint";
import { deleteCustomer, upsertCustomer } from "@/lib/storage";
import { useCustomersList } from "@/hooks/useEntityList";
import { isDemoEntityId } from "@/lib/seedDemo";
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
            matchesBudgetSearch(c, q)
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

  const toggleWorkspaceShare = async (c: Customer) => {
    if (busy) return;
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
            label="성함 / 전화번호 / 금액 검색"
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
              const saved = formatSavedDate(c.createdAt);
              const done = Boolean(c.contractCompleted);
              const deadlineLabel = done ? null : getContractDeadlineLabel(c);
              const showTeamChip =
                Boolean(c.workspaceId) || isDemoEntityId(c.id);
              const shared = Boolean(c.workspaceShared);

              return (
                <div
                  key={c.id}
                  className="relative mb-2.5 overflow-visible pb-0.5 pt-2"
                >
                  <ListEdgeChips
                    roomType={c.roomType}
                    buildingKind={c.buildingKind}
                    dealType={c.dealType}
                    moneyLabel={getCustomerBudgetLabel(c)}
                    depositMan={Math.max(
                      c.deposit ?? 0,
                      c.depositTo ?? 0
                    )}
                    done={done}
                    right={
                      showTeamChip ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            void toggleWorkspaceShare(c);
                          }}
                          className={[
                            "inline-flex shrink-0 cursor-pointer rounded-lg px-1.5 py-0.5 text-[11px] font-extrabold text-white shadow-sm transition-opacity hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60",
                            done
                              ? "bg-gray-400"
                              : shared
                                ? "bg-emerald-500"
                                : "bg-gray-500",
                          ].join(" ")}
                        >
                          {shared ? "팀 공유 중" : "팀 공유하기"}
                        </button>
                      ) : null
                    }
                  />

                  <SwipeRevealRow
                    hintNudge={nudgeFirstCard && index === 0}
                    onTap={() => router.push(`/customers/${c.id}`)}
                    onSwipeLeft={() =>
                      setPending({ id: c.id, type: "complete" })
                    }
                    onSwipeRight={() =>
                      setPending({ id: c.id, type: "delete" })
                    }
                  >
                    <Card
                      className={[
                        "relative !rounded-2xl !border !border-gray-100 !px-3 !pb-2 !pt-3 !shadow-none",
                        done
                          ? "!bg-gray-200 !border-gray-300 text-gray-500"
                          : deadlineLabel
                            ? "!border-amber-200 bg-amber-50/40"
                            : "",
                      ].join(" ")}
                    >
                      <div className="relative">
                        <div className="flex items-center justify-between gap-2">
                          <p
                            className={[
                              "min-w-0 truncate text-[11px] leading-tight",
                              done ? "text-gray-500" : "text-gray-400",
                            ].join(" ")}
                          >
                            희망입주 {getCustomerMoveInLabel(c)}
                          </p>
                          {deadlineLabel ? (
                            <p className="shrink-0 text-[11px] font-extrabold text-amber-600">
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

                        <div className="mt-4 flex items-center justify-between gap-2">
                          <p
                            className={[
                              "min-w-0 truncate text-[11px] font-bold leading-none",
                              done ? "text-gray-500" : "text-gray-500",
                            ].join(" ")}
                          >
                            {c.createdByName?.trim() || ""}
                          </p>
                          <p
                            className={[
                              "shrink-0 text-[11px] font-bold leading-none",
                              done ? "text-gray-500" : "text-gray-400",
                            ].join(" ")}
                          >
                            {saved ? `등록일 · ${saved}` : "-"}
                          </p>
                        </div>
                      </div>
                    </Card>
                  </SwipeRevealRow>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <StickyActionBar>
        <Link href="/customers/new">
          <Button fullWidth size="lg">
            고객 추가하기
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
              ? "종료를 취소할까요?"
              : "고객을 종료할까요?"
        }
        description={
          pendingCustomer
            ? pending?.type === "delete"
              ? `${pendingCustomer.name} 고객과 관련 방문 일정이 함께 삭제됩니다.`
              : pendingDone
                ? `${pendingCustomer.name} 고객을 진행 중 상태로 되돌립니다.`
                : `${pendingCustomer.name} 고객을 종료 처리합니다. 목록 하단으로 이동합니다.`
            : pending?.type === "delete"
              ? "관련 방문 일정도 함께 삭제됩니다."
              : "해당 고객의 종료 상태를 변경합니다."
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
