"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { PhoneLink } from "@/components/PhoneLink";
import { StickyActionBar } from "@/components/StickyActionBar";
import { SwipeRevealRow } from "@/components/SwipeRevealRow";
import { ListEdgeChips } from "@/components/ListEdgeChips";
import { formatDepositRent, formatMoveInRange } from "@/lib/format";
import { formatSavedDate } from "@/lib/date";
import {
  consumeCustomerSwipeNudge,
  markCustomerSwipeUsed,
} from "@/lib/customerSwipeHint";
import { deleteListedProperty, upsertListedProperty } from "@/lib/storage";
import { peekCurrentUser } from "@/lib/auth";
import {
  confirmForeignTeamDelete,
  confirmForeignTeamEdit,
  isForeignTeamItem,
} from "@/lib/teamActionGuard";
import { usePropertiesList } from "@/hooks/useEntityList";
import { isDemoEntityId } from "@/lib/seedDemo";
import type { ListedProperty } from "@/lib/types";

type PendingAction = {
  id: string;
  type: "complete" | "delete";
};

function getPropertyListContact(p: ListedProperty): {
  label: string;
  phone: string;
} | null {
  if (p.hasPartnerAgency) {
    const partner = p.partnerAgency?.phone?.trim();
    if (partner) {
      const name = p.partnerAgency?.name?.trim();
      return { label: name || "협력부동산", phone: partner };
    }
  }
  const landlord = p.landlordPhone?.trim();
  if (landlord) return { label: "임대인", phone: landlord };
  const tenant = p.tenantPhone?.trim();
  if (tenant) return { label: "임차인", phone: tenant };
  return null;
}

export default function PropertyListPage() {
  const router = useRouter();
  const { items: properties, setItems: setProperties } = usePropertiesList();
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [nudgeFirstCard, setNudgeFirstCard] = useState(false);

  useEffect(() => {
    if (properties.length === 0) return;
    if (consumeCustomerSwipeNudge()) setNudgeFirstCard(true);
  }, [properties.length]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? properties.filter(
          (p) =>
            p.address.toLowerCase().includes(q) ||
            p.roomNo.toLowerCase().includes(q) ||
            (p.roomType ?? "").includes(q) ||
            p.dealType.includes(q)
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
  const pendingDone = Boolean(pendingProperty?.contractCompleted);

  const closePending = () => {
    if (busy) return;
    setPending(null);
  };

  const toggleTeamShare = async (p: ListedProperty) => {
    if (busy) return;
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
          contractCompleted: !pendingDone,
          updatedAt: new Date().toISOString(),
        });
        setProperties(next);
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
        title="매물 리스트"
        backHref="/"
        subtitle={`등록 ${properties.length}건`}
      />

      <div className="space-y-3 pb-4">
        <Card>
          <label className="block space-y-1">
            <span className="text-[13px] font-semibold text-gray-600">
              주소 / 호실 / 유형 검색
            </span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="성내동, 원룸, 전세..."
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-3 text-[16px] text-gray-900 outline-none transition focus:border-[#3182F6] focus:bg-white focus:ring-2 focus:ring-[#3182F6]/20"
            />
          </label>
        </Card>

        {filtered.length === 0 ? (
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
              const saved = formatSavedDate(p.createdAt);
              const moneyChip = formatDepositRent(
                p.dealType,
                p.deposit,
                p.monthlyRent
              );
              const address = p.address.trim() || "주소 미입력";
              const room = p.roomNo.trim();
              const contact = getPropertyListContact(p);
              const done = Boolean(p.contractCompleted);
              const showTeamChip =
                Boolean(p.workspaceId) || isDemoEntityId(p.id);
              const teamOn = Boolean(p.workspaceShared);

              return (
                <div
                  key={p.id}
                  className="relative mb-2.5 overflow-visible pb-0.5 pt-2"
                >
                  <ListEdgeChips
                    roomType={p.roomType}
                    buildingKind={p.buildingKind}
                    dealType={p.dealType}
                    moneyLabel={moneyChip}
                    depositMan={p.deposit}
                    done={done}
                    right={
                      showTeamChip ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            void toggleTeamShare(p);
                          }}
                          className={[
                            "inline-flex shrink-0 cursor-pointer rounded-lg px-1.5 py-0.5 text-[11px] font-extrabold text-white shadow-sm transition-opacity hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60",
                            done
                              ? "bg-gray-400"
                              : teamOn
                                ? "bg-emerald-500"
                                : "bg-gray-500",
                          ].join(" ")}
                        >
                          {teamOn ? "팀 공유 중" : "팀 공유하기"}
                        </button>
                      ) : null
                    }
                  />

                  <SwipeRevealRow
                    hintNudge={nudgeFirstCard && index === 0}
                    onTap={() => router.push(`/properties/${p.id}`)}
                    onSwipeLeft={() =>
                      setPending({ id: p.id, type: "complete" })
                    }
                    onSwipeRight={() =>
                      setPending({ id: p.id, type: "delete" })
                    }
                  >
                    <Card
                      className={[
                        "relative !rounded-2xl !border !border-gray-100 !px-3 !pb-2 !pt-3 !shadow-none",
                        done
                          ? "!bg-gray-200 !border-gray-300 text-gray-500"
                          : "",
                      ].join(" ")}
                    >
                      <div className="relative">
                        <p
                          className={[
                            "min-w-0 text-[11px] leading-tight",
                            done ? "text-gray-500" : "text-gray-400",
                          ].join(" ")}
                        >
                          입주가능{" "}
                          {formatMoveInRange(
                            p.moveInFrom,
                            p.moveInTo,
                            p.moveInDate
                          )}
                        </p>

                        <p
                          className={[
                            "mt-1 min-w-0 truncate text-[18px] font-extrabold tracking-tight leading-snug",
                            done ? "text-gray-600" : "text-gray-900",
                          ].join(" ")}
                        >
                          {address}
                          {room ? (
                            <span
                              className={[
                                "ml-1.5 text-[13px] font-semibold",
                                done ? "text-gray-500" : "text-gray-400",
                              ].join(" ")}
                            >
                              {room}
                            </span>
                          ) : null}
                        </p>

                        <div className="mt-1.5 flex items-center justify-end gap-2">
                          {contact ? (
                            <>
                              <span
                                className={[
                                  "shrink-0 text-[12px] font-bold",
                                  done ? "text-gray-500" : "text-gray-400",
                                ].join(" ")}
                              >
                                {contact.label}
                              </span>
                              <PhoneLink
                                phone={contact.phone}
                                className={[
                                  "relative z-[1] !shrink-0 !text-[16px] !font-extrabold",
                                  done ? "!text-gray-500" : "",
                                ].join(" ")}
                              />
                            </>
                          ) : (
                            <span className="text-[13px] font-semibold text-gray-300">
                              번호 없음
                            </span>
                          )}
                        </div>

                        <div className="mt-4 flex items-center justify-between gap-2">
                          <p
                            className={[
                              "min-w-0 truncate text-[11px] font-bold leading-none",
                              done ? "text-gray-500" : "text-gray-500",
                            ].join(" ")}
                          >
                            {p.createdByName?.trim() || ""}
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
        <Link href="/properties/new">
          <Button fullWidth size="lg">
            매물 추가하기
          </Button>
        </Link>
      </StickyActionBar>

      <Modal
        open={Boolean(pending)}
        onClose={closePending}
        title={
          pending?.type === "delete"
            ? "매물을 삭제할까요?"
            : pendingDone
              ? "종료를 취소할까요?"
              : "매물을 종료할까요?"
        }
        description={
          pendingProperty
            ? pending?.type === "delete"
              ? `${pendingProperty.address.trim() || "이 매물"}을(를) 삭제합니다.`
              : pendingDone
                ? `${pendingProperty.address.trim() || "이 매물"}을(를) 진행 중 상태로 되돌립니다.`
                : `${pendingProperty.address.trim() || "이 매물"}을(를) 종료 처리합니다. 목록 하단으로 이동합니다.`
            : pending?.type === "delete"
              ? "선택한 매물을 삭제합니다."
              : "해당 매물의 종료 상태를 변경합니다."
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
