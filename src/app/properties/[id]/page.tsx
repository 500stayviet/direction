"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { StickyActionBar } from "@/components/StickyActionBar";
import { PropertyBrief } from "@/components/PropertyBrief";
import { PropertyEditor } from "@/components/PropertyEditor";
import { SharePropertyModal } from "@/components/SharePropertyModal";
import { SiteShareDevMark, SiteShareMatchingEmpty, TeamShareButton } from "@/components/SiteShareUi";
import { MatchingCustomersSection } from "@/components/MatchListPanel";
import { getCurrentUser } from "@/lib/auth";
import { getPropertyValidationError } from "@/lib/propertyValidation";
import { findMatchingCustomersGrouped } from "@/lib/matchCustomerProperty";
import {
  deleteListedProperty,
  getListedPropertyById,
  upsertListedProperty,
} from "@/lib/storage";
import { useCustomersList } from "@/hooks/useEntityList";
import type { ListedProperty, User } from "@/lib/types";

export default function PropertyDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [property, setProperty] = useState<ListedProperty | null>(null);
  const { items: customers, setItems: setCustomers } = useCustomersList();
  const [editing, setEditing] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [agent, setAgent] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [found, me] = await Promise.all([
        getListedPropertyById(params.id),
        getCurrentUser(),
      ]);
      if (cancelled) return;
      if (!found) {
        router.replace("/properties");
        return;
      }
      setProperty(found);
      setAgent(me);
    })();
    return () => {
      cancelled = true;
    };
  }, [params.id, router]);

  const matches = useMemo(
    () =>
      property
        ? findMatchingCustomersGrouped(property, customers)
        : { own: [], partner: [] },
    [property, customers]
  );

  if (!property) {
    return (
      <main className="py-20 text-center text-gray-500">불러오는 중...</main>
    );
  }

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    const error = getPropertyValidationError(property);
    if (error) {
      alert(error);
      return;
    }
    const next: ListedProperty = {
      ...property,
      address: property.address.trim(),
      updatedAt: new Date().toISOString(),
    };
    await upsertListedProperty(next);
    setProperty(next);
    setEditing(false);
  };

  const handleDelete = () => {
    if (!window.confirm("이 매물을 삭제할까요?")) return;
    setDeleting(true);
    void deleteListedProperty(property.id)
      .then(() => router.replace("/properties"))
      .catch((err: unknown) => {
        alert(err instanceof Error ? err.message : "삭제에 실패했습니다.");
        setDeleting(false);
      });
  };

  const cancelEditing = () => {
    void getListedPropertyById(params.id).then((found) => {
      if (found) setProperty(found);
    });
    setEditing(false);
  };

  const toggleTeamShare = async () => {
    if (!property || shareBusy) return;
    const prevShared = Boolean(property.workspaceShared);
    const next = {
      ...property,
      workspaceShared: !prevShared,
      updatedAt: new Date().toISOString(),
    };
    setProperty(next);
    setShareBusy(true);
    try {
      await upsertListedProperty(next);
    } catch (err: unknown) {
      setProperty({ ...property, workspaceShared: prevShared });
      alert(err instanceof Error ? err.message : "팀 공유 변경에 실패했습니다.");
    } finally {
      setShareBusy(false);
    }
  };

  const teamOn = property.workspaceShared === true;

  return (
    <main>
      <PageHeader
        title={editing ? "매물 정보 수정" : "매물 정보"}
        titleAlign="left"
        backHref={editing ? undefined : "/properties"}
        onBack={
          editing
            ? () => {
                cancelEditing();
              }
            : undefined
        }
        right={
          <div className="flex items-center gap-1.5">
            {!editing ? (
              <TeamShareButton
                active={teamOn}
                disabled={shareBusy}
                onToggle={() => void toggleTeamShare()}
              />
            ) : null}
            {!editing ? (
              <Button
                onClick={() => setShareOpen(true)}
                className="!border-2 !border-sky-400 !bg-white !px-2.5 !text-[13px] !font-bold !text-sky-600 hover:!bg-sky-50"
              >
                공유하기
              </Button>
            ) : null}
            <Button
              variant={editing ? "secondary" : "outline"}
              onClick={() => {
                if (editing) {
                  cancelEditing();
                } else {
                  setEditing(true);
                }
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
        <>
          <form id="property-edit-form" onSubmit={handleSave} className="pb-2">
            <PropertyEditor
              index={0}
              showTitle={false}
              showArriveTime={false}
              property={property}
              onChange={(next) =>
                setProperty({
                  ...property,
                  ...next,
                  createdAt: property.createdAt,
                  updatedAt: property.updatedAt,
                })
              }
            />
          </form>
          <StickyActionBar>
            <Button type="submit" form="property-edit-form" fullWidth size="lg">
              변경사항 저장
            </Button>
          </StickyActionBar>
        </>
      ) : (
        <div className="space-y-3 pb-4">
          <PropertyBrief index={0} property={property} />

          <div className="space-y-3">
            <p className="px-1 text-sm font-bold text-gray-800">
              조건에 맞는 고객
            </p>
            <MatchingCustomersSection
              title="내 고객"
              listHint="(내 고객리스트 내)"
              items={matches.own}
              emptyText="조건에 맞는 내 고객이 없습니다."
              onRemoved={(id) =>
                setCustomers((prev) => prev.filter((c) => c.id !== id))
              }
            />
            <MatchingCustomersSection
              title="현장동선내 공유 고객"
              titleRight={<SiteShareDevMark />}
              items={matches.partner}
              emptyText={<SiteShareMatchingEmpty kind="customer" />}
              onRemoved={(id) =>
                setCustomers((prev) => prev.filter((c) => c.id !== id))
              }
            />
            {matches.own.length === 0 ? (
              <Link href="/customers/new" className="inline-block px-1">
                <span className="text-[13px] font-bold text-[#3182F6]">
                  고객 추가하기 →
                </span>
              </Link>
            ) : null}
          </div>
        </div>
      )}

      <SharePropertyModal
        open={shareOpen}
        properties={[property]}
        agent={agent}
        onClose={() => setShareOpen(false)}
      />
    </main>
  );
}
