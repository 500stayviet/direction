"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CustomerForm } from "@/components/CustomerForm";
import { PhoneLink } from "@/components/PhoneLink";
import { StickyActionBar } from "@/components/StickyActionBar";
import { SiteShareDevMark, SiteShareMatchingEmpty, TeamShareButton } from "@/components/SiteShareUi";
import { MatchingPropertiesSection } from "@/components/MatchListPanel";
import {
  confirmForeignTeamDelete,
  confirmForeignTeamEdit,
  isForeignTeamItem,
} from "@/lib/teamActionGuard";
import { peekCurrentUser } from "@/lib/auth";
import {
  deleteCustomer,
  getCustomerById,
  touchRecentCustomer,
  upsertCustomer,
} from "@/lib/storage";
import { usePropertiesList } from "@/hooks/useEntityList";
import {
  getCustomerBudgetLabel,
  getCustomerLoanLabel,
  getCustomerMoveInLabel,
  getCustomerParkingLabel,
} from "@/lib/format";
import {
  displayRoomType,
  needsRoomBathCounts,
  normalizeRoomType,
} from "@/lib/constants";
import { findMatchingPropertiesGrouped } from "@/lib/matchCustomerProperty";
import type { Customer } from "@/lib/types";

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

export default function CustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const { items: properties, setItems: setProperties } = usePropertiesList();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const found = await getCustomerById(params.id);
      if (cancelled) return;
      if (!found) {
        router.replace("/");
        return;
      }
      setCustomer(found);
      void touchRecentCustomer(found.id);
    })();
    return () => {
      cancelled = true;
    };
  }, [params.id, router]);

  const matches = useMemo(
    () =>
      customer
        ? findMatchingPropertiesGrouped(customer, properties)
        : { own: [], partner: [] },
    [customer, properties]
  );

  if (!customer) {
    return (
      <main className="py-20 text-center text-gray-500">불러오는 중...</main>
    );
  }

  const myId = peekCurrentUser()?.id;
  const isForeign = isForeignTeamItem(customer.createdBy, myId);

  const handleDelete = () => {
    if (
      !window.confirm(
        "이 고객을 삭제할까요?\n관련된 방문 일정도 함께 삭제됩니다."
      )
    ) {
      return;
    }
    if (isForeign && !confirmForeignTeamDelete("고객")) return;
    setDeleting(true);
    void deleteCustomer(customer.id)
      .then(() => router.replace("/customers"))
      .catch((err: unknown) => {
        alert(err instanceof Error ? err.message : "삭제에 실패했습니다.");
        setDeleting(false);
      });
  };

  const startEditing = () => {
    if (isForeign && !confirmForeignTeamEdit("고객")) return;
    setEditing(true);
  };

  const toggleTeamShare = async () => {
    if (!customer || shareBusy) return;
    const prevShared = Boolean(customer.workspaceShared);
    const next = {
      ...customer,
      workspaceShared: !prevShared,
      updatedAt: new Date().toISOString(),
    };
    setCustomer(next);
    setShareBusy(true);
    try {
      await upsertCustomer(next);
    } catch (err: unknown) {
      setCustomer({ ...customer, workspaceShared: prevShared });
      alert(err instanceof Error ? err.message : "팀 공유 변경에 실패했습니다.");
    } finally {
      setShareBusy(false);
    }
  };

  return (
    <main>
      <PageHeader
        title={editing ? "고객 정보 수정" : "고객 정보"}
        titleAlign="left"
        backHref="/customers"
        right={
          <div className="flex items-center gap-1.5">
            {!editing ? (
              <TeamShareButton
                active={customer.workspaceShared === true}
                disabled={shareBusy}
                onToggle={() => void toggleTeamShare()}
              />
            ) : null}
            <Button
              variant={editing ? "secondary" : "outline"}
              onClick={() => {
                if (editing) setEditing(false);
                else startEditing();
              }}
              className={
                editing
                  ? "!px-2.5 !text-[13px]"
                  : "!border-2 !border-emerald-500 !bg-white !px-2.5 !text-[13px] !font-bold !text-emerald-600 hover:!bg-emerald-50"
              }
            >
              {editing ? "취소" : "수정"}
            </Button>
            {!editing ? (
              <Button
                disabled={deleting}
                onClick={handleDelete}
                className="!border-2 !border-red-500 !bg-white !px-2.5 !text-[13px] !font-bold !text-red-600 hover:!bg-red-50"
              >
                {deleting ? "삭제 중…" : "삭제"}
              </Button>
            ) : null}
          </div>
        }
      />

      {editing ? (
        <CustomerForm
          initial={customer}
          submitLabel="변경사항 저장"
          onSubmit={(next) => {
            void upsertCustomer(next).then(() => {
              setCustomer(next);
              setEditing(false);
            });
          }}
        />
      ) : (
        <>
          <div className="space-y-2.5 pb-4">
            <Card className="!p-3">
              <InfoRow label="고객명">{customer.name}</InfoRow>
              <InfoRow label="전화">
                <PhoneLink phone={customer.phone} />
              </InfoRow>
              <InfoRow label="매물 유형">
                {displayRoomType(customer.roomType, customer.buildingKind)}
              </InfoRow>
              {needsRoomBathCounts(
                normalizeRoomType(customer.roomType) ?? customer.roomType
              ) && (
                <InfoRow label="방 · 화장실">
                  방{" "}
                  {(normalizeRoomType(customer.roomType) ??
                    customer.roomType) === "투룸"
                    ? 2
                    : customer.roomCount ?? "-"}
                  개 · 화장실 {customer.bathroomCount ?? 1}개
                </InfoRow>
              )}
              <InfoRow label="희망거래">
                {customer.dealType}
                {customer.nonOccupancy ? " · 비입주" : ""}
              </InfoRow>
              <InfoRow label="금액">
                {getCustomerBudgetLabel(customer)}
              </InfoRow>
              <InfoRow label="입주">
                {getCustomerMoveInLabel(customer)}
              </InfoRow>
              {!(
                customer.roomType === "상가" ||
                customer.roomType === "사무실" ||
                customer.roomType === "토지" ||
                customer.roomType === "건물"
              ) && (
                <InfoRow label="대출">{getCustomerLoanLabel(customer)}</InfoRow>
              )}
              {customer.roomType !== "토지" &&
                customer.roomType !== "건물" && (
                  <InfoRow label="주차">
                    {getCustomerParkingLabel(customer)}
                  </InfoRow>
                )}
              {customer.roomType !== "토지" &&
                customer.roomType !== "건물" && (
                  <InfoRow label="애완동물">
                    {customer.petAllowed ?? "-"}
                  </InfoRow>
                )}
              {customer.notes && (
                <InfoRow label="메모">
                  <span className="whitespace-pre-wrap font-medium text-gray-800">
                    {customer.notes}
                  </span>
                </InfoRow>
              )}
            </Card>

            <div className="space-y-3">
              <p className="px-1 text-sm font-bold text-gray-800">
                조건에 맞는 매물
              </p>
              <MatchingPropertiesSection
                title="내 매물"
                listHint="(내 매물리스트내)"
                items={matches.own}
                emptyText="조건에 맞는 내 매물이 없습니다."
                onRemoved={(id) =>
                  setProperties((prev) => prev.filter((p) => p.id !== id))
                }
              />
              <MatchingPropertiesSection
                title="현장동선내 공유 매물"
                titleRight={<SiteShareDevMark />}
                items={matches.partner}
                emptyText={<SiteShareMatchingEmpty kind="property" />}
                onRemoved={(id) =>
                  setProperties((prev) => prev.filter((p) => p.id !== id))
                }
              />
              {matches.own.length === 0 ? (
                <Link href="/properties/new" className="inline-block px-1">
                  <span className="text-[13px] font-bold text-[#3182F6]">
                    매물 추가하기 →
                  </span>
                </Link>
              ) : null}
            </div>
          </div>

          <StickyActionBar>
            <Link href={`/schedules/new?customerId=${customer.id}`}>
              <Button fullWidth size="lg">
                이 고객으로 방문 일정 만들기
              </Button>
            </Link>
          </StickyActionBar>
        </>
      )}
    </main>
  );
}
