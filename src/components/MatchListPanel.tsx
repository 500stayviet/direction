"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { PropertyBrief } from "@/components/PropertyBrief";
import { CustomerBrief } from "@/components/CustomerBrief";
import { PropertyListCard } from "@/components/PropertyListCard";
import { CustomerListCard } from "@/components/CustomerListCard";
import { deleteCustomer, deleteListedProperty, getListedProperties } from "@/lib/storage";
import { peekCurrentUser } from "@/lib/auth";
import {
  foreignTeamDeleteMessage,
  isForeignTeamItem,
} from "@/lib/teamActionGuard";
import {
  getTeamAlertsSnapshot,
  isMatchUnseen,
  markMatchSeen,
  subscribeTeamAlerts,
} from "@/lib/teamAlerts";
import type { Customer, ListedProperty } from "@/lib/types";

function useAlertsTick() {
  return useSyncExternalStore(
    subscribeTeamAlerts,
    getTeamAlertsSnapshot,
    getTeamAlertsSnapshot
  );
}

function CloseXButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label="삭제"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      className="absolute right-2 bottom-2 z-20 flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-[15px] font-bold text-gray-500 shadow-sm transition-colors hover:bg-red-50 hover:text-red-500"
    >
      ×
    </button>
  );
}

export function MatchingPropertiesSection({
  title,
  listHint,
  titleRight,
  items,
  emptyText,
  onRemoved,
  customerId,
}: {
  title: string;
  listHint?: string;
  titleRight?: React.ReactNode;
  items: ListedProperty[];
  emptyText: ReactNode;
  onRemoved: (id: string) => void;
  /** 매칭 알람 앵커(고객 id) */
  customerId?: string;
}) {
  useAlertsTick();
  const [preview, setPreview] = useState<ListedProperty | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ListedProperty | null>(
    null
  );
  const [busy, setBusy] = useState(false);

  const confirmDelete = async () => {
    if (!pendingDelete || busy) return;
    const target = pendingDelete;
    setBusy(true);
    onRemoved(target.id);
    if (preview?.id === target.id) setPreview(null);
    setPendingDelete(null);
    try {
      await deleteListedProperty(target.id);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "삭제에 실패했습니다.");
      try {
        await getListedProperties();
      } catch {
        /* ignore */
      }
    } finally {
      setBusy(false);
    }
  };

  const openPreview = (p: ListedProperty) => {
    if (customerId) markMatchSeen(customerId, p.id, "customer");
    setPreview(p);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 px-1">
        <p className="min-w-0 text-sm font-bold text-gray-700">
          {title}
          {items.length > 0 ? ` ${items.length}건` : ""}
          {listHint ? ` ${listHint}` : ""}
        </p>
        {titleRight ? <div className="shrink-0">{titleRight}</div> : null}
      </div>
      {items.length === 0 ? (
        <Card className="!p-3">
          <div className="text-sm leading-relaxed text-gray-500">{emptyText}</div>
        </Card>
      ) : (
        items.map((p) => {
          const matchNew =
            Boolean(customerId) && isMatchUnseen(customerId!, p.id, "customer");
          return (
            <div
              key={p.id}
              id={customerId ? `match-property-${p.id}` : undefined}
              className="relative"
            >
              <CloseXButton onClick={() => setPendingDelete(p)} />
              <PropertyListCard
                property={p}
                className="!mb-1.5"
                showSavedDate={false}
                showAgencyBadge
                alertHighlight={matchNew ? "match" : null}
                renderCard={(card) => (
                  <button
                    type="button"
                    className="w-full cursor-pointer text-left transition-transform duration-150 active:scale-[0.98]"
                    onClick={() => openPreview(p)}
                  >
                    {card}
                  </button>
                )}
              />
            </div>
          );
        })
      )}

      <Modal
        open={Boolean(preview)}
        title="매물 상세"
        onClose={() => setPreview(null)}
        position="center"
        dense
        showClose
        className="max-h-[85vh] overflow-hidden"
      >
        {preview ? (
          <div className="max-h-[55vh] overflow-y-auto">
            <PropertyBrief
              index={0}
              property={preview}
              showTitle={false}
              showArriveTime={false}
            />
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(pendingDelete)}
        title="매물 삭제"
        description={
          pendingDelete &&
          isForeignTeamItem(pendingDelete.createdBy, peekCurrentUser()?.id)
            ? foreignTeamDeleteMessage("매물")
            : "삭제하시겠습니까? 조건에 맞는 매물 리스트에서 영구적으로 제외됩니다."
        }
        onClose={() => {
          if (!busy) setPendingDelete(null);
        }}
        position="center"
        dense
      >
        <div className="flex gap-2">
          <Button
            fullWidth
            variant="secondary"
            disabled={busy}
            onClick={() => setPendingDelete(null)}
          >
            취소
          </Button>
          <Button
            fullWidth
            disabled={busy}
            className="!bg-red-500 hover:!bg-red-600"
            onClick={() => void confirmDelete()}
          >
            {busy ? "삭제 중…" : "삭제"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

export function MatchingCustomersSection({
  title,
  listHint,
  titleRight,
  items,
  emptyText,
  onRemoved,
  propertyId,
}: {
  title: string;
  listHint?: string;
  titleRight?: React.ReactNode;
  items: Customer[];
  emptyText: ReactNode;
  onRemoved: (id: string) => void;
  /** 매칭 알람 앵커(매물 id) */
  propertyId?: string;
}) {
  useAlertsTick();
  const [preview, setPreview] = useState<Customer | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Customer | null>(null);
  const [busy, setBusy] = useState(false);

  const confirmDelete = async () => {
    if (!pendingDelete || busy) return;
    setBusy(true);
    try {
      await deleteCustomer(pendingDelete.id);
      onRemoved(pendingDelete.id);
      if (preview?.id === pendingDelete.id) setPreview(null);
      setPendingDelete(null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "삭제에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const openPreview = (c: Customer) => {
    if (propertyId) markMatchSeen(c.id, propertyId, "property");
    setPreview(c);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 px-1">
        <p className="min-w-0 text-sm font-bold text-gray-700">
          {title}
          {items.length > 0 ? ` ${items.length}건` : ""}
          {listHint ? ` ${listHint}` : ""}
        </p>
        {titleRight ? <div className="shrink-0">{titleRight}</div> : null}
      </div>
      {items.length === 0 ? (
        <Card className="!p-3">
          <div className="text-sm leading-relaxed text-gray-500">{emptyText}</div>
        </Card>
      ) : (
        items.map((c) => {
          const matchNew =
            Boolean(propertyId) && isMatchUnseen(c.id, propertyId!, "property");
          return (
            <div
              key={c.id}
              id={propertyId ? `match-customer-${c.id}` : undefined}
              className="relative"
            >
              <CloseXButton onClick={() => setPendingDelete(c)} />
              <CustomerListCard
                customer={c}
                className="!mb-1.5"
                showDeadline={false}
                showSavedDate={false}
                alertHighlight={matchNew ? "match" : null}
                renderCard={(card) => (
                  <button
                    type="button"
                    className="w-full cursor-pointer text-left transition-transform duration-150 active:scale-[0.98]"
                    onClick={() => openPreview(c)}
                  >
                    {card}
                  </button>
                )}
              />
            </div>
          );
        })
      )}

      <Modal
        open={Boolean(preview)}
        title="고객 상세"
        onClose={() => setPreview(null)}
        position="center"
        dense
        showClose
        className="max-h-[85vh] overflow-hidden"
      >
        {preview ? (
          <div className="max-h-[55vh] overflow-y-auto">
            <CustomerBrief customer={preview} />
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(pendingDelete)}
        title="고객 삭제"
        description={
          pendingDelete &&
          isForeignTeamItem(pendingDelete.createdBy, peekCurrentUser()?.id)
            ? foreignTeamDeleteMessage("고객")
            : "삭제하시겠습니까? 고객 리스트에서도 제외됩니다."
        }
        onClose={() => {
          if (!busy) setPendingDelete(null);
        }}
        position="center"
        dense
      >
        <div className="flex gap-2">
          <Button
            fullWidth
            variant="secondary"
            disabled={busy}
            onClick={() => setPendingDelete(null)}
          >
            취소
          </Button>
          <Button
            fullWidth
            disabled={busy}
            className="!bg-red-500 hover:!bg-red-600"
            onClick={() => void confirmDelete()}
          >
            {busy ? "삭제 중…" : "삭제"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
