"use client";

import { Fragment, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PrefetchHref } from "@/components/PrefetchHref";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { StickyActionBar } from "@/components/StickyActionBar";
import { SwipeRevealRow } from "@/components/SwipeRevealRow";
import { PropertyListCard } from "@/components/PropertyListCard";
import { ListSearchInput } from "@/components/CustomerSearchInput";
import { consumeListSwipeNudge } from "@/lib/customerSwipeHint";
import { deleteListedProperty, upsertListedProperty } from "@/lib/storage";
import { peekCurrentUser } from "@/lib/auth";
import {
  confirmForeignTeamDelete,
  confirmForeignTeamEdit,
  isForeignTeamItem,
} from "@/lib/teamActionGuard";
import {
  getTeamAlertsSnapshot,
  hasUnseenMatchForProperty,
  markShareSeen,
  subscribeTeamAlerts,
} from "@/lib/teamAlerts";
import { usePropertiesList } from "@/hooks/useEntityList";
import { isDemoEntityId } from "@/lib/demoSeedPayload";
import { TeamShareChip } from "@/components/SiteShareUi";
import type { ListedProperty } from "@/lib/types";

type PendingAction = {
  id: string;
  type: "complete" | "delete";
};

export default function PropertyListPage() {
  const router = useRouter();
  const { items: properties, loading, setItems: setProperties } = usePropertiesList();
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [nudgeFirstCard, setNudgeFirstCard] = useState(false);
  useSyncExternalStore(
    subscribeTeamAlerts,
    getTeamAlertsSnapshot,
    getTeamAlertsSnapshot
  );

  useEffect(() => {
    if (properties.length === 0) return;
    if (consumeListSwipeNudge("properties")) setNudgeFirstCard(true);
  }, [properties.length]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? properties.filter(
          (p) =>
            p.address.toLowerCase().includes(q) ||
            p.roomNo.toLowerCase().includes(q) ||
            (p.buildingName ?? "").toLowerCase().includes(q) ||
            (p.roomType ?? "").includes(q) ||
            (p.dealType ?? "").includes(q) ||
            (p.moveInFrom ?? "").includes(q) ||
            (p.moveInTo ?? "").includes(q) ||
            (p.moveInDate ?? "").toLowerCase().includes(q)
        )
      : properties;
    return [...list].sort((a, b) => {
      const aDone = Boolean(a.contractCompleted);
      const bDone = Boolean(b.contractCompleted);
      if (aDone !== bDone) return aDone ? 1 : -1;
      return (
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    });
  }, [properties, query]);

  const pendingProperty = pending
    ? properties.find((p) => p.id === pending.id)
    : undefined;

  const closePending = () => {
    if (busy) return;
    setPending(null);
  };

  const propertyHref = (p: ListedProperty) => {
    const scroll = hasUnseenMatchForProperty(p.id) ? "?scrollMatch=1" : "";
    return `/properties/${p.id}${scroll}`;
  };

  const openProperty = (p: ListedProperty) => {
    markShareSeen("properties", p.id);
    router.push(propertyHref(p));
  };

  const myId = peekCurrentUser()?.id;

  const toggleTeamShare = async (p: ListedProperty) => {
    if (busy) return;
    if (isForeignTeamItem(p.createdBy, myId)) return;
    const prevShared = Boolean(p.workspaceShared);
    const optimistic: ListedProperty = {
      ...p,
      workspaceShared: !prevShared,
      updatedAt: new Date().toISOString(),
    };
    setProperties((list) =>
      list.map((item) => (item.id === p.id ? optimistic : item))
    );
    setBusy(true);
    try {
      await upsertListedProperty(optimistic);
    } catch (err: unknown) {
      setProperties((list) =>
        list.map((item) =>
          item.id === p.id ? { ...p, workspaceShared: prevShared } : item
        )
      );
      alert(err instanceof Error ? err.message : "팀 공유 변경에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const confirmPending = async () => {
    if (!pending || !pendingProperty || busy) return;
    const myId = peekCurrentUser()?.id;
    const foreign = isForeignTeamItem(pendingProperty.createdBy, myId);
    if (foreign) {
      const ok =
        pending.type === "delete"
          ? confirmForeignTeamDelete("매물")
          : confirmForeignTeamEdit("매물");
      if (!ok) return;
    }
    setBusy(true);
    try {
      if (pending.type === "delete") {
        await deleteListedProperty(pendingProperty.id);
        setProperties((prev) =>
          prev.filter((p) => p.id !== pendingProperty.id)
        );
      } else {
        const next = await upsertListedProperty({
          ...pendingProperty,
          contractCompleted: true,
          updatedAt: new Date().toISOString(),
        });
        setProperties(next);
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
      <PageHeader
        title="매물 리스트"
        backHref="/"
        subtitle={
          loading && properties.length === 0
            ? "불러오는 중…"
            : `등록 ${properties.length}건`
        }
      />

      <div className="space-y-2 pb-4">
        <ListSearchInput
          value={query}
          onChange={setQuery}
          placeholder="주소 · 호실 · 유형"
          aria-label="매물 검색"
          className="min-h-[44px] rounded-full border-gray-300 bg-white px-4 shadow-none"
        />

        {loading && properties.length === 0 ? (
          <Card>
            <p className="text-sm text-gray-400">불러오는 중…</p>
          </Card>
        ) : filtered.length === 0 ? (
          <Card>
            <p className="text-sm text-gray-500">
              {properties.length === 0
                ? "등록된 매물이 없습니다. 아래 버튼으로 추가해 주세요."
                : "검색 결과가 없습니다."}
            </p>
          </Card>
        ) : (
          <div className="space-y-2 overflow-visible pr-2">
            {filtered.map((p, index) => {
              const done = Boolean(p.contractCompleted);
              const showTeamChip =
                Boolean(p.workspaceId) || isDemoEntityId(p.id);
              const teamOn = Boolean(p.workspaceShared);
              const foreign = isForeignTeamItem(p.createdBy, myId);

              return (
                <Fragment key={p.id}>
                <PrefetchHref href={propertyHref(p)} />
                <PropertyListCard
                  property={p}
                  viewerId={myId}
                  right={
                    showTeamChip ? (
                      <TeamShareChip
                        shared={teamOn}
                        done={done}
                        disabled={busy}
                        locked={foreign}
                        tone="quiet"
                        onToggle={() => void toggleTeamShare(p)}
                      />
                    ) : null
                  }
                  renderCard={(card) => (
                    <SwipeRevealRow
                      hintNudge={nudgeFirstCard && index === 0}
                      leftActionLabel={done ? "복구/수정" : "계약완료"}
                      onTap={() => openProperty(p)}
                      onSwipeLeft={() => {
                        if (done) {
                          markShareSeen("properties", p.id);
                          router.push(`/properties/${p.id}?restore=1`);
                          return;
                        }
                        setPending({ id: p.id, type: "complete" });
                      }}
                      onSwipeRight={() =>
                        setPending({ id: p.id, type: "delete" })
                      }
                    >
                      {card}
                    </SwipeRevealRow>
                  )}
                />
                </Fragment>
              );
            })}
          </div>
        )}
      </div>

      <StickyActionBar>
        <Link href="/properties/new">
          <Button fullWidth size="lg">
            매물등록하기
          </Button>
        </Link>
      </StickyActionBar>

      <Modal
        open={Boolean(pending)}
        onClose={closePending}
        title={
          pending?.type === "delete"
            ? "매물을 삭제할까요?"
            : "매물을 계약완료할까요?"
        }
        description={
          pendingProperty
            ? pending?.type === "delete"
              ? `${pendingProperty.address.trim() || "이 매물"}을(를) 삭제합니다.`
              : `${pendingProperty.address.trim() || "이 매물"}을(를) 계약완료 처리합니다. 목록 하단으로 이동합니다.`
            : pending?.type === "delete"
              ? "선택한 매물을 삭제합니다."
              : "해당 매물을 계약완료 처리합니다."
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
