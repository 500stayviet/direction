"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
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
  formatOwnMatchBadgeLabel,
  formatSiteMatchBadgeLabel,
  getTeamAlertsSnapshot,
  isMatchUnseen,
  markMatchSeen,
  subscribeTeamAlerts,
  type ListCardBadge,
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
      className="relative z-20 flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-[15px] font-bold text-gray-500 shadow-sm transition-colors hover:bg-red-50 hover:text-red-500"
    >
      ×
    </button>
  );
}

function matchInlineBadge(
  matchKind: "own" | "partner",
  unseen: boolean
): ListCardBadge[] {
  if (!unseen) return [];
  return [
    {
      kind: matchKind === "partner" ? "newMatch" : "match",
      label:
        matchKind === "partner"
          ? formatSiteMatchBadgeLabel(1)
          : formatOwnMatchBadgeLabel(1),
      at: 0,
    },
  ];
}

export function MatchingPropertiesSection({
  title,
  listHint,
  titleRight,
  items,
  emptyText,
  onRemoved,
  customerId,
  matchKind = "own",
  autoOpenPreviewId,
}: {
  title: string;
  listHint?: string;
  titleRight?: React.ReactNode;
  items: ListedProperty[];
  emptyText: ReactNode;
  onRemoved: (id: string) => void;
  /** 매칭 알람 앵커(고객 id) */
  customerId?: string;
  /** own=내 리스트 매칭(파랑), partner=사이트내 공유 새매칭(노랑) */
  matchKind?: "own" | "partner";
  /** scrollMatch 등 — 해당 매물 미리보기 모달 자동 오픈 */
  autoOpenPreviewId?: string | null;
}) {
  useAlertsTick();
  const viewerId = peekCurrentUser()?.id;
  const [preview, setPreview] = useState<ListedProperty | null>(null);
  const autoOpenedRef = useRef<string | null>(null);
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
    if (customerId) {
      // 매칭 알람 해제 — 반짝이는 카드 미리보기 진입 시에만 (상세·푸시 진입만으로는 해제 안 함)
      markMatchSeen(customerId, p.id, "customer", matchKind === "partner");
    }
    setPreview(p);
  };

  useEffect(() => {
    const targetId = autoOpenPreviewId?.trim();
    if (!targetId || autoOpenedRef.current === targetId) return;
    const target = items.find((p) => p.id === targetId);
    if (!target) return;
    autoOpenedRef.current = targetId;
    if (customerId) {
      markMatchSeen(customerId, target.id, "customer", matchKind === "partner");
    }
    setPreview(target);
  }, [autoOpenPreviewId, items, customerId, matchKind]);

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
          const partner = matchKind === "partner";
          const matchNew =
            Boolean(customerId) &&
            isMatchUnseen(customerId!, p.id, "customer", partner);
          return (
            <div
              key={p.id}
              id={customerId ? `match-property-${p.id}` : undefined}
              className="relative"
            >
              <PropertyListCard
                property={p}
                viewerId={viewerId}
                className="!mb-1.5"
                showSavedDate={false}
                showAgencyBadge
                showListAlerts={false}
                inlineBadges={matchInlineBadge(matchKind, matchNew)}
                right={<CloseXButton onClick={() => setPendingDelete(p)} />}
                renderCard={(card) => (
                  <div
                    role="button"
                    tabIndex={0}
                    className="w-full cursor-pointer text-left transition-transform duration-150 active:scale-[0.98]"
                    onClick={() => openPreview(p)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openPreview(p);
                      }
                    }}
                  >
                    {card}
                  </div>
                )}
              />
            </div>
          );
        })
      )}

      <Modal
        open={Boolean(preview)}
        title="조건 매칭 · 매물"
        onClose={() => setPreview(null)}
        position="center"
        dense
        showClose
        overlayClassName="z-[70]"
        className="max-h-[85vh] overflow-hidden"
      >
        {preview ? (
          <div className="max-h-[55vh] overflow-y-auto">
            <PropertyBrief
              index={0}
              property={preview}
              showTitle={false}
              showArriveTime={false}
              matchPreview
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
  matchKind = "own",
  autoOpenPreviewId,
}: {
  title: string;
  listHint?: string;
  titleRight?: React.ReactNode;
  items: Customer[];
  emptyText: ReactNode;
  onRemoved: (id: string) => void;
  /** 매칭 알람 앵커(매물 id) */
  propertyId?: string;
  matchKind?: "own" | "partner";
  /** scrollMatch 등 — 해당 고객 미리보기 모달 자동 오픈 */
  autoOpenPreviewId?: string | null;
}) {
  useAlertsTick();
  const viewerId = peekCurrentUser()?.id;
  const [preview, setPreview] = useState<Customer | null>(null);
  const autoOpenedRef = useRef<string | null>(null);
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
    if (propertyId) {
      // 매칭 알람 해제 — 반짝이는 카드 미리보기 진입 시에만
      markMatchSeen(c.id, propertyId, "property", matchKind === "partner");
    }
    setPreview(c);
  };

  useEffect(() => {
    const targetId = autoOpenPreviewId?.trim();
    if (!targetId || autoOpenedRef.current === targetId) return;
    const target = items.find((c) => c.id === targetId);
    if (!target) return;
    autoOpenedRef.current = targetId;
    if (propertyId) {
      markMatchSeen(target.id, propertyId, "property", matchKind === "partner");
    }
    setPreview(target);
  }, [autoOpenPreviewId, items, propertyId, matchKind]);

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
          const partner = matchKind === "partner";
          const matchNew =
            Boolean(propertyId) &&
            isMatchUnseen(c.id, propertyId!, "property", partner);
          return (
            <div
              key={c.id}
              id={propertyId ? `match-customer-${c.id}` : undefined}
              className="relative"
            >
              <CustomerListCard
                customer={c}
                viewerId={viewerId}
                className="!mb-1.5"
                showDeadline={false}
                showSavedDate={false}
                showListAlerts={false}
                inlineBadges={matchInlineBadge(matchKind, matchNew)}
                right={<CloseXButton onClick={() => setPendingDelete(c)} />}
                renderCard={(card) => (
                  <div
                    role="button"
                    tabIndex={0}
                    className="w-full cursor-pointer text-left transition-transform duration-150 active:scale-[0.98]"
                    onClick={() => openPreview(c)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openPreview(c);
                      }
                    }}
                  >
                    {card}
                  </div>
                )}
              />
            </div>
          );
        })
      )}

      <Modal
        open={Boolean(preview)}
        title="조건 매칭 · 고객"
        onClose={() => setPreview(null)}
        position="center"
        dense
        showClose
        overlayClassName="z-[70]"
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
