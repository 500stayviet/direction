"use client";

import { useState, type ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { PropertyBrief } from "@/components/PropertyBrief";
import { PhoneLink } from "@/components/PhoneLink";
import {
  displayRoomType,
  needsRoomBathCounts,
  normalizeRoomType,
} from "@/lib/constants";
import {
  formatDepositRent,
  getCustomerBudgetLabel,
  getCustomerLoanLabel,
  getCustomerMoveInLabel,
  getCustomerParkingLabel,
} from "@/lib/format";
import { deleteCustomer, deleteListedProperty, getListedProperties } from "@/lib/storage";
import { peekCurrentUser } from "@/lib/auth";
import {
  foreignTeamDeleteMessage,
  isForeignTeamItem,
} from "@/lib/teamActionGuard";
import type { Customer, ListedProperty } from "@/lib/types";

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
      className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-[15px] font-bold text-gray-500 transition-colors hover:bg-red-50 hover:text-red-500"
    >
      ×
    </button>
  );
}

function CustomerDetailBody({ c }: { c: Customer }) {
  return (
    <div className="max-h-[60vh] space-y-0 overflow-y-auto">
      <InfoRow label="고객명">{c.name}</InfoRow>
      <InfoRow label="전화">
        <PhoneLink phone={c.phone} />
      </InfoRow>
      <InfoRow label="매물 유형">
        {displayRoomType(c.roomType, c.buildingKind)}
      </InfoRow>
      {needsRoomBathCounts(normalizeRoomType(c.roomType) ?? c.roomType) && (
        <InfoRow label="방 · 화장실">
          방{" "}
          {(normalizeRoomType(c.roomType) ?? c.roomType) === "투룸"
            ? 2
            : c.roomCount ?? "-"}
          개 · 화장실 {c.bathroomCount ?? 1}개
        </InfoRow>
      )}
      <InfoRow label="희망거래">
        {c.dealType}
        {c.nonOccupancy ? " · 비입주" : ""}
      </InfoRow>
      <InfoRow label="금액">{getCustomerBudgetLabel(c)}</InfoRow>
      <InfoRow label="입주">{getCustomerMoveInLabel(c)}</InfoRow>
      {!(
        c.roomType === "상가" ||
        c.roomType === "사무실" ||
        c.roomType === "토지" ||
        c.roomType === "건물"
      ) && <InfoRow label="대출">{getCustomerLoanLabel(c)}</InfoRow>}
      {c.roomType !== "토지" && c.roomType !== "건물" && (
        <InfoRow label="주차">{getCustomerParkingLabel(c)}</InfoRow>
      )}
      {c.roomType !== "토지" && c.roomType !== "건물" && (
        <InfoRow label="애완동물">{c.petAllowed ?? "-"}</InfoRow>
      )}
      {c.notes ? (
        <InfoRow label="메모">
          <span className="whitespace-pre-wrap font-medium text-gray-800">
            {c.notes}
          </span>
        </InfoRow>
      ) : null}
    </div>
  );
}

function InfoRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 border-b border-gray-100 py-2.5 last:border-b-0">
      <span className="w-[72px] shrink-0 pt-0.5 text-[13px] font-semibold text-gray-400">
        {label}
      </span>
      <div className="min-w-0 flex-1 text-[15px] font-semibold leading-snug text-gray-900">
        {children}
      </div>
    </div>
  );
}

export function MatchingPropertiesSection({
  title,
  listHint,
  titleRight,
  items,
  emptyText,
  onRemoved,
}: {
  title: string;
  listHint?: string;
  titleRight?: React.ReactNode;
  items: ListedProperty[];
  emptyText: ReactNode;
  onRemoved: (id: string) => void;
}) {
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
          const address = p.address.trim() || "주소 미입력";
          const room = p.roomNo.trim();
          const money = formatDepositRent(p.dealType, p.deposit, p.monthlyRent);
          return (
            <div key={p.id} className="relative mb-1.5">
              <CloseXButton onClick={() => setPendingDelete(p)} />
              <button
                type="button"
                className="w-full text-left"
                onClick={() => setPreview(p)}
              >
                <Card pressable className="!p-3 !pr-10">
                  <p className="text-[12px] font-bold text-gray-400">
                    {displayRoomType(p.roomType, p.buildingKind)} · {p.dealType}
                    {p.hasPartnerAgency && p.partnerAgency?.name?.trim()
                      ? ` · ${p.partnerAgency.name.trim()}`
                      : ""}
                  </p>
                  <p className="mt-0.5 truncate text-[15px] font-bold text-gray-900">
                    {address}
                    {room ? (
                      <span className="ml-1.5 text-[13px] font-semibold text-gray-400">
                        {room}
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-[13px] font-semibold text-gray-600">
                    {money}
                  </p>
                </Card>
              </button>
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
            <PropertyBrief index={0} property={preview} />
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
}: {
  title: string;
  listHint?: string;
  titleRight?: React.ReactNode;
  items: Customer[];
  emptyText: ReactNode;
  onRemoved: (id: string) => void;
}) {
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
        items.map((c) => (
          <div key={c.id} className="relative mb-1.5">
            <CloseXButton onClick={() => setPendingDelete(c)} />
            <button
              type="button"
              className="w-full text-left"
              onClick={() => setPreview(c)}
            >
              <Card pressable className="!p-3 !pr-10">
                <p className="text-[12px] font-bold text-gray-400">
                  {displayRoomType(c.roomType, c.buildingKind)} · {c.dealType}
                  {needsRoomBathCounts(
                    normalizeRoomType(c.roomType) ?? c.roomType
                  )
                    ? ` · 방 ${
                        (normalizeRoomType(c.roomType) ?? c.roomType) === "투룸"
                          ? 2
                          : c.roomCount ?? "-"
                      }`
                    : ""}
                </p>
                <p className="mt-0.5 truncate text-[15px] font-bold text-gray-900">
                  {c.name}
                </p>
                <p className="mt-0.5 text-[13px] font-semibold text-gray-600">
                  {getCustomerBudgetLabel(c)} · 입주 {getCustomerMoveInLabel(c)}
                </p>
              </Card>
            </button>
          </div>
        ))
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
        {preview ? <CustomerDetailBody c={preview} /> : null}
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
