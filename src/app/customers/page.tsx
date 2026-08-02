"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { PhoneLink } from "@/components/PhoneLink";
import { CustomerSearchInput } from "@/components/CustomerSearchInput";
import { StickyActionBar } from "@/components/StickyActionBar";
import {
  getCustomerBudgetLabel,
  getCustomerMoveInLabel,
  matchesBudgetSearch,
  matchesPhoneSearch,
} from "@/lib/format";
import { formatSavedDate } from "@/lib/date";
import { getContractDeadlineLabel } from "@/lib/deadline";
import { getCustomers, upsertCustomer } from "@/lib/storage";
import type { Customer } from "@/lib/types";

export default function CustomerListPage() {
  const [query, setQuery] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [pendingId, setPendingId] = useState<string | null>(null);

  useEffect(() => {
    void getCustomers().then(setCustomers);
  }, []);

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
    return [...list].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [customers, query]);

  const pendingCustomer = pendingId
    ? customers.find((c) => c.id === pendingId)
    : undefined;
  const pendingDone = Boolean(pendingCustomer?.contractCompleted);

  const confirmToggleComplete = async () => {
    if (!pendingCustomer) return;
    const next = await upsertCustomer({
      ...pendingCustomer,
      contractCompleted: !pendingDone,
      updatedAt: new Date().toISOString(),
    });
    setCustomers(next);
    setPendingId(null);
  };

  return (
    <main>
      <PageHeader
        title="손님 리스트"
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
                ? "등록된 손님이 없습니다. 아래 버튼으로 추가해 주세요."
                : "검색 결과가 없습니다."}
            </p>
          </Card>
        ) : (
          <div className="space-y-2">
            {filtered.map((c) => {
              const saved = formatSavedDate(c.createdAt);
              const updated = formatSavedDate(c.updatedAt);
              const done = Boolean(c.contractCompleted);
              const deadlineLabel = done ? null : getContractDeadlineLabel(c);

              return (
                <Card
                  key={c.id}
                  className={[
                    "mb-2 !p-3",
                    done
                      ? "!bg-gray-200 !border-gray-300 shadow-none text-gray-500"
                      : deadlineLabel
                        ? "!border-amber-200 bg-amber-50/40"
                        : "",
                  ].join(" ")}
                >
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <p
                      className={[
                        "text-[13px] font-bold",
                        done ? "text-gray-500" : "text-[#3182F6]",
                      ].join(" ")}
                    >
                      {saved || "-"}
                    </p>
                    <p
                      className={[
                        "text-[11px] font-medium",
                        done ? "text-gray-500" : "text-gray-400",
                      ].join(" ")}
                    >
                      수정 {updated || "-"}
                    </p>
                  </div>
                  {deadlineLabel && (
                    <p className="mb-1.5 inline-flex rounded-lg bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                      {deadlineLabel}
                    </p>
                  )}

                  <Link href={`/customers/${c.id}`} className="block">
                    <p
                      className={[
                        "text-lg font-bold",
                        done ? "text-gray-600" : "text-gray-900",
                      ].join(" ")}
                    >
                      {c.name}
                    </p>
                  </Link>
                  <div className="mt-1">
                    <PhoneLink
                      phone={c.phone}
                      className={done ? "!text-gray-500" : undefined}
                    />
                  </div>
                  <Link href={`/customers/${c.id}`} className="block">
                    <p
                      className={[
                        "mt-2 text-sm",
                        done ? "text-gray-500" : "text-gray-600",
                      ].join(" ")}
                    >
                      {c.dealType} · {getCustomerBudgetLabel(c)}
                    </p>
                  </Link>

                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <p
                      className={[
                        "min-w-0 text-xs",
                        done ? "text-gray-500" : "text-gray-400",
                      ].join(" ")}
                    >
                      희망입주 {getCustomerMoveInLabel(c)}
                    </p>
                    <button
                      type="button"
                      onClick={() => setPendingId(c.id)}
                      className={[
                        "inline-flex shrink-0 items-center rounded-lg px-2.5 py-1 text-[11px] font-bold active:scale-95 transition-all duration-150",
                        done
                          ? "bg-gray-300 text-gray-600"
                          : "bg-emerald-500 text-white",
                      ].join(" ")}
                    >
                      {done ? "완료됨" : "완료처리"}
                    </button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <StickyActionBar>
        <Link href="/customers/new">
          <Button fullWidth size="lg">
            손님 추가하기
          </Button>
        </Link>
      </StickyActionBar>

      <Modal
        open={Boolean(pendingId)}
        onClose={() => setPendingId(null)}
        title={
          pendingDone
            ? "완료처리를 취소할까요?"
            : "완료처리 할까요?"
        }
        description={
          pendingCustomer
            ? pendingDone
              ? `${pendingCustomer.name} 손님을 진행 중 상태로 되돌립니다.`
              : `${pendingCustomer.name} 손님을 완료처리 상태로 표시합니다.`
            : pendingDone
              ? "진행 중 상태로 되돌립니다."
              : "해당 손님을 완료처리 상태로 표시합니다."
        }
      >
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => setPendingId(null)}>
            아니오
          </Button>
          <Button onClick={confirmToggleComplete}>예</Button>
        </div>
      </Modal>
    </main>
  );
}
