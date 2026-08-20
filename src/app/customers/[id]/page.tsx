"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { CustomerForm } from "@/components/CustomerForm";
import { CustomerBrief } from "@/components/CustomerBrief";
import { StickyActionBar } from "@/components/StickyActionBar";
import { DetailHeaderButton } from "@/components/DetailHeaderButton";
import {
  SiteShareMatchingEmpty,
  TeamShareButton,
} from "@/components/SiteShareUi";
import { MatchingPropertiesSection } from "@/components/MatchListPanel";
import { SaveCompleteModal } from "@/components/SaveCompleteModal";
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
import { findMatchingPropertiesGrouped } from "@/lib/matchCustomerProperty";
import {
  firstUnseenMatchPropertyId,
  markShareSeen,
} from "@/lib/teamAlerts";
import { fetchWorkspaceStatus } from "@/lib/workspace";
import type { Customer } from "@/lib/types";

export default function CustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const { items: properties, setItems: setProperties } = usePropertiesList();
  const [editing, setEditing] = useState(false);
  const [restoreMode, setRestoreMode] = useState(false);
  const restoreStarted = useRef(false);
  const [deleting, setDeleting] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);
  const [hasTeammates, setHasTeammates] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [found, ws] = await Promise.all([
        getCustomerById(params.id),
        fetchWorkspaceStatus(),
      ]);
      if (cancelled) return;
      if (!found) {
        router.replace("/");
        return;
      }
      setHasTeammates(
        Boolean(ws.ok && ws.workspace && (ws.workspace.memberCount ?? 0) > 1)
      );
      setCustomer(found);
      markShareSeen("customers", found.id);
      void touchRecentCustomer(found.id);
    })();
    return () => {
      cancelled = true;
    };
  }, [params.id, router]);

  useEffect(() => {
    if (!customer || restoreStarted.current) return;
    if (searchParams.get("restore") !== "1") return;
    restoreStarted.current = true;
    const myId = peekCurrentUser()?.id;
    if (
      isForeignTeamItem(customer.createdBy, myId) &&
      !confirmForeignTeamEdit("고객")
    ) {
      router.replace(`/customers/${customer.id}`);
      return;
    }
    setRestoreMode(true);
    setEditing(true);
  }, [customer, searchParams, router]);

  const matches = useMemo(
    () =>
      customer
        ? findMatchingPropertiesGrouped(customer, properties)
        : { own: [], partner: [] },
    [customer, properties]
  );

  useEffect(() => {
    if (!customer || editing) return;
    const wantScroll = searchParams.get("scrollMatch") === "1";
    const firstId = firstUnseenMatchPropertyId(
      customer.id,
      matches.own.map((p) => p.id)
    );
    if (!wantScroll && !firstId) return;
    const targetId = firstId ?? matches.own[0]?.id;
    if (!targetId) return;
    const t = window.setTimeout(() => {
      document
        .getElementById(`match-property-${targetId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 120);
    return () => window.clearTimeout(t);
  }, [customer, editing, matches.own, searchParams]);

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
    setRestoreMode(false);
    setEditing(true);
  };

  const stopEditing = () => {
    setRestoreMode(false);
    setEditing(false);
    if (searchParams.get("restore") === "1") {
      router.replace(`/customers/${customer.id}`);
    }
  };

  const toggleTeamShare = async () => {
    if (!customer || shareBusy || isForeign || !hasTeammates) return;
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

  // 팀원 2명 이상일 때만 표시 (데모·이미 공유중이어도 팀 없으면 숨김)
  const showTeamShare = !editing && hasTeammates;

  return (
    <main>
      <PageHeader
        title={editing ? "고객 정보 수정" : "고객 정보"}
        titlePlacement="below"
        backHref="/customers"
        right={
          <>
            {showTeamShare ? (
              <TeamShareButton
                active={customer.workspaceShared === true}
                disabled={shareBusy}
                locked={isForeign}
                onToggle={() => void toggleTeamShare()}
              />
            ) : null}
            <DetailHeaderButton
              tone={editing ? "cancel" : "edit"}
              onClick={() => {
                if (editing) stopEditing();
                else startEditing();
              }}
            >
              {editing ? "취소" : "수정"}
            </DetailHeaderButton>
            {!editing ? (
              <DetailHeaderButton
                tone="delete"
                disabled={deleting}
                onClick={handleDelete}
              >
                {deleting ? "삭제 중…" : "삭제"}
              </DetailHeaderButton>
            ) : null}
          </>
        }
      />

      {editing ? (
        <CustomerForm
          initial={customer}
          restoreMode={restoreMode}
          submitLabel="변경사항 저장"
          onSubmit={(next) => {
            void upsertCustomer(next)
              .then(() => {
                setCustomer(next);
                setRestoreMode(false);
                setEditing(false);
                setSavedOpen(true);
                if (searchParams.get("restore") === "1") {
                  router.replace(`/customers/${customer.id}`);
                }
              })
              .catch((err: unknown) => {
                alert(
                  err instanceof Error ? err.message : "저장에 실패했습니다."
                );
              });
          }}
        />
      ) : (
        <>
          <div className="space-y-3 pb-4">
            <CustomerBrief customer={customer} />

            <div className="space-y-3">
              <p className="px-1 text-sm font-bold text-gray-800">
                조건에 맞는 매물
              </p>
              <MatchingPropertiesSection
                title="내 매물"
                listHint="(내 매물리스트)"
                items={matches.own}
                customerId={customer.id}
                emptyText="조건에 맞는 내 매물이 없습니다."
                onRemoved={(id) =>
                  setProperties((prev) => prev.filter((p) => p.id !== id))
                }
              />
              <MatchingPropertiesSection
                title="현장동선내 공유 매물"
                items={matches.partner}
                customerId={customer.id}
                matchKind="partner"
                emptyText={<SiteShareMatchingEmpty kind="property" />}
                onRemoved={(id) =>
                  setProperties((prev) => prev.filter((p) => p.id !== id))
                }
              />
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

      <SaveCompleteModal
        open={savedOpen}
        onClose={() => setSavedOpen(false)}
      />
    </main>
  );
}
