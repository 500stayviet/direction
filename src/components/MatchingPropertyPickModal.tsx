"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { PropertyListCard } from "@/components/PropertyListCard";
import { SiteShareMatchingEmpty } from "@/components/SiteShareUi";
import { MAX_SCHEDULE_PROPERTIES } from "@/lib/constants";
import { groupedMatchesForCustomer } from "@/lib/matchDisplay";
import { peekCurrentUser } from "@/lib/auth";
import type { Customer, ListedProperty } from "@/lib/types";

export function MatchingPropertyPickModal({
  open,
  customer,
  properties,
  onClose,
  onConfirm,
}: {
  open: boolean;
  customer: Customer | null;
  properties: ListedProperty[];
  onClose: () => void;
  onConfirm: (picked: ListedProperty[]) => void;
}) {
  const [pickedIds, setPickedIds] = useState<string[]>([]);
  const viewerId = peekCurrentUser()?.id;

  useEffect(() => {
    if (open) setPickedIds([]);
  }, [open]);

  const matches = useMemo(
    () =>
      customer
        ? groupedMatchesForCustomer(customer, properties, viewerId)
        : { own: [], partner: [] },
    [customer, properties, viewerId]
  );

  const orderOf = (id: string) => {
    const i = pickedIds.indexOf(id);
    return i >= 0 ? i + 1 : 0;
  };

  const toggle = (id: string) => {
    setPickedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_SCHEDULE_PROPERTIES) return prev;
      return [...prev, id];
    });
  };

  const close = () => {
    setPickedIds([]);
    onClose();
  };

  const confirm = () => {
    const pool = [...matches.own, ...matches.partner];
    const picked = pickedIds
      .map((id) => pool.find((p) => p.id === id))
      .filter((p): p is ListedProperty => Boolean(p));
    setPickedIds([]);
    onConfirm(picked);
  };

  return (
    <Modal
      open={open && Boolean(customer)}
      onClose={close}
      position="center"
      dense
      showClose
      title="조건에 맞는 매물 선택"
      description="고른 순서가 1번·2번 매물이 됩니다. 다시 누르면 그 번호만 해제됩니다."
      className="max-h-[min(88vh,720px)] overflow-hidden"
    >
      <div className="max-h-[min(58vh,28rem)] space-y-3 overflow-y-auto pr-0.5">
        <section className="space-y-1.5">
          <p className="px-0.5 text-sm font-bold text-gray-700">
            내 매물
            {matches.own.length > 0 ? ` ${matches.own.length}건` : ""}{" "}
            <span className="font-semibold text-gray-400">(내 매물리스트)</span>
          </p>
          {matches.own.length === 0 ? (
            <Card className="!p-3">
              <p className="text-sm leading-relaxed text-gray-500">
                조건에 맞는 내 매물이 없습니다.
              </p>
            </Card>
          ) : (
            matches.own.map((p) => {
              const order = orderOf(p.id);
              const selected = order > 0;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggle(p.id)}
                  className="relative w-full cursor-pointer text-left transition-transform duration-150 active:scale-[0.98]"
                >
                  <PropertyListCard
                    property={p}
                    viewerId={viewerId}
                    className="!mb-0"
                    showSavedDate={false}
                    showAgencyBadge
                    cardClassName={
                      selected ? "!border-emerald-400 !bg-emerald-50" : ""
                    }
                  />
                  {selected ? (
                    <span className="pointer-events-none absolute left-1/2 top-1/2 z-20 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-emerald-500 text-[28px] font-extrabold tabular-nums text-white shadow-md">
                      {order}
                    </span>
                  ) : null}
                </button>
              );
            })
          )}
        </section>

        <section className="space-y-1.5">
          <p className="px-0.5 text-sm font-bold text-gray-700">
            현장동선내 공유 매물
          </p>
          {matches.partner.length === 0 ? (
            <Card className="!p-3">
              <SiteShareMatchingEmpty kind="property" />
            </Card>
          ) : (
            matches.partner.map((p) => {
              const order = orderOf(p.id);
              const selected = order > 0;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggle(p.id)}
                  className="relative w-full cursor-pointer text-left transition-transform duration-150 active:scale-[0.98]"
                >
                  <PropertyListCard
                    property={p}
                    viewerId={viewerId}
                    className="!mb-0"
                    showSavedDate={false}
                    matchPartnerContact
                    cardClassName={
                      selected ? "!border-emerald-400 !bg-emerald-50" : ""
                    }
                  />
                  {selected ? (
                    <span className="pointer-events-none absolute left-1/2 top-1/2 z-20 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-emerald-500 text-[28px] font-extrabold tabular-nums text-white shadow-md">
                      {order}
                    </span>
                  ) : null}
                </button>
              );
            })
          )}
        </section>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button type="button" variant="secondary" fullWidth onClick={close}>
          닫기
        </Button>
        <Button
          type="button"
          fullWidth
          disabled={pickedIds.length === 0}
          onClick={confirm}
        >
          선택완료{pickedIds.length > 0 ? ` ${pickedIds.length}건` : ""}
        </Button>
      </div>
    </Modal>
  );
}
