"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { StickyActionBar } from "@/components/StickyActionBar";
import { PropertyBrief } from "@/components/PropertyBrief";
import { PropertyEditor } from "@/components/PropertyEditor";
import { SharePropertyModal } from "@/components/SharePropertyModal";
import { DetailHeaderButton } from "@/components/DetailHeaderButton";
import {
  SiteShareMatchingEmpty,
  TeamShareButton,
} from "@/components/SiteShareUi";
import { MatchingCustomersSection } from "@/components/MatchListPanel";
import { getCurrentUser, peekCurrentUser } from "@/lib/auth";
import { DuplicatePropertyModal } from "@/components/DuplicatePropertyModal";
import { SaveCompleteModal } from "@/components/SaveCompleteModal";
import { RequiredFieldWarnModal } from "@/components/RequiredFieldWarnModal";
import {
  getMissingRequiredFields,
  getFieldErrorMessage,
  type PropertyFieldKey,
} from "@/lib/propertyValidation";
import { findPropertyBySameAddressRoom } from "@/lib/duplicateEntity";
import { composeRestAddress } from "@/lib/propertyRoomNo";
import { groupedMatchesForProperty } from "@/lib/matchDisplay";
import {
  deleteListedProperty,
  getListedPropertyById,
  upsertListedProperty,
} from "@/lib/storage";
import {
  confirmForeignTeamDelete,
  confirmForeignTeamEdit,
  isForeignTeamItem,
} from "@/lib/teamActionGuard";
import {
  firstUnseenMatchCustomerId,
} from "@/lib/teamAlerts";
import { fetchWorkspaceStatus } from "@/lib/workspace";
import { useCustomersList, usePropertiesList } from "@/hooks/useEntityList";
import { useMatchPoolEntities } from "@/hooks/useMatchPool";
import type { ListedProperty, User } from "@/lib/types";

export default function PropertyDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [property, setProperty] = useState<ListedProperty | null>(null);
  const { items: customers, setItems: setCustomers } = useCustomersList();
  const { items: listed } = usePropertiesList();
  const [editing, setEditing] = useState(false);
  const [restoreMode, setRestoreMode] = useState(false);
  const restoreStarted = useRef(false);
  const [dupOpen, setDupOpen] = useState(false);
  const [validationActive, setValidationActive] = useState(false);
  const [focusField, setFocusField] = useState<PropertyFieldKey | undefined>();
  const [warnOpen, setWarnOpen] = useState(false);
  const [warnMessage, setWarnMessage] = useState("");
  const warnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [agent, setAgent] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);
  const [hasTeammates, setHasTeammates] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [found, me, ws] = await Promise.all([
        getListedPropertyById(params.id),
        getCurrentUser(),
        fetchWorkspaceStatus(),
      ]);
      if (cancelled) return;
      if (!found) {
        router.replace("/properties");
        return;
      }
      setHasTeammates(
        Boolean(ws.ok && ws.workspace && (ws.workspace.memberCount ?? 0) > 1)
      );
      setProperty(found);
      setAgent(me);
    })();
    return () => {
      cancelled = true;
    };
  }, [params.id, router]);

  useEffect(() => {
    if (!property || restoreStarted.current) return;
    if (searchParams.get("restore") !== "1") return;
    restoreStarted.current = true;
    const myId = peekCurrentUser()?.id ?? agent?.id;
    if (
      isForeignTeamItem(property.createdBy, myId) &&
      !confirmForeignTeamEdit("매물")
    ) {
      router.replace(`/properties/${property.id}`);
      return;
    }
    if (!property.moveInVacant && !property.moveInNegotiable) {
      setProperty({
        ...property,
        moveInFrom: "",
        moveInTo: "",
        moveInSingle: false,
        moveInDate: "",
      });
    }
    setRestoreMode(true);
    setValidationActive(true);
    setEditing(true);
  }, [property, searchParams, router, agent?.id]);

  const myId = peekCurrentUser()?.id ?? agent?.id;
  const matchPool = useMatchPoolEntities(myId);
  const customersForMatch = matchPool.customers ?? customers;

  const matches = useMemo(
    () =>
      property
        ? groupedMatchesForProperty(property, customersForMatch, myId)
        : { own: [], partner: [] },
    [property, customersForMatch, myId]
  );

  useEffect(() => {
    if (!property || editing) return;
    const wantScroll = searchParams.get("scrollMatch") === "1";
    const ownId = firstUnseenMatchCustomerId(
      property.id,
      matches.own.map((c) => c.id)
    );
    const partnerId = firstUnseenMatchCustomerId(
      property.id,
      matches.partner.map((c) => c.id),
      true
    );
    if (!wantScroll && !ownId && !partnerId) return;
    const targetId =
      ownId ??
      partnerId ??
      (wantScroll ? matches.own[0]?.id ?? matches.partner[0]?.id : null);
    if (!targetId) return;
    const t = window.setTimeout(() => {
      document
        .getElementById(`match-customer-${targetId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 150);
    return () => window.clearTimeout(t);
  }, [property, editing, matches.own, matches.partner, searchParams]);

  if (!property) {
    return (
      <main className="py-20 text-center text-gray-500">불러오는 중...</main>
    );
  }

  const isForeign = isForeignTeamItem(property.createdBy, myId);

  const saveProperty = async () => {
    const next: ListedProperty = {
      ...property,
      address: property.address.trim(),
      contractCompleted: restoreMode ? false : property.contractCompleted,
      updatedAt: new Date().toISOString(),
    };
    await upsertListedProperty(next);
    setProperty(next);
    setRestoreMode(false);
    setEditing(false);
    setSavedOpen(true);
    if (searchParams.get("restore") === "1") {
      router.replace(`/properties/${property.id}`);
    }
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    const missing = getMissingRequiredFields(property);
    if (missing.length > 0) {
      const field = missing[0];
      setValidationActive(true);
      setFocusField(field);
      setWarnMessage(getFieldErrorMessage(field, property));
      if (warnTimer.current) clearTimeout(warnTimer.current);
      warnTimer.current = setTimeout(() => setWarnOpen(true), 350);
      return;
    }
    setValidationActive(false);
    setWarnOpen(false);
    if (
      findPropertyBySameAddressRoom(
        property.address,
        composeRestAddress(property.buildingName, property.roomNo),
        listed,
        property.id
      )
    ) {
      setDupOpen(true);
      return;
    }
    await saveProperty();
  };

  const handleDelete = () => {
    if (!window.confirm("이 매물을 삭제할까요?")) return;
    if (isForeign && !confirmForeignTeamDelete("매물")) return;
    setDeleting(true);
    void deleteListedProperty(property.id)
      .then(() => router.replace("/properties"))
      .catch((err: unknown) => {
        alert(err instanceof Error ? err.message : "삭제에 실패했습니다.");
        setDeleting(false);
      });
  };

  const startEditing = () => {
    if (isForeign && !confirmForeignTeamEdit("매물")) return;
    setRestoreMode(false);
    setEditing(true);
  };

  const cancelEditing = () => {
    restoreStarted.current = true;
    setRestoreMode(false);
    void getListedPropertyById(params.id).then((found) => {
      if (found) setProperty(found);
    });
    setEditing(false);
    setValidationActive(false);
    if (searchParams.get("restore") === "1") {
      router.replace(`/properties/${params.id}`);
    }
  };

  const toggleTeamShare = async () => {
    if (!property || shareBusy || isForeign || !hasTeammates) return;
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
  const showTeamShare = !editing && hasTeammates;

  return (
    <main>
      <PageHeader
        title={editing ? "매물 정보 수정" : "매물 정보"}
        titlePlacement="below"
        backHref={editing ? undefined : "/properties"}
        onBack={
          editing
            ? () => {
                cancelEditing();
              }
            : undefined
        }
        right={
          <>
            {showTeamShare ? (
              <TeamShareButton
                active={teamOn}
                disabled={shareBusy}
                locked={isForeign}
                onToggle={() => void toggleTeamShare()}
              />
            ) : null}
            {!editing ? (
              <DetailHeaderButton
                tone="share"
                onClick={() => setShareOpen(true)}
              >
                공유하기
              </DetailHeaderButton>
            ) : null}
            <DetailHeaderButton
              tone={editing ? "cancel" : "edit"}
              onClick={() => {
                if (editing) {
                  cancelEditing();
                } else {
                  startEditing();
                }
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
        <>
          <form
            id="property-edit-form"
            noValidate
            onSubmit={handleSave}
            className="pb-2"
          >
            <PropertyEditor
              index={0}
              showTitle={false}
              showArriveTime={false}
              enableIntake
              property={property}
              validationActive={validationActive}
              focusField={focusField}
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
          <PropertyBrief
            index={0}
            property={property}
            showTitle={false}
            showArriveTime={false}
          />

          <div className="space-y-3">
            <p className="px-1 text-sm font-bold text-gray-800">
              조건에 맞는 고객
            </p>
            <MatchingCustomersSection
              title="내 고객"
              listHint="(내 고객리스트)"
              items={matches.own}
              propertyId={property.id}
              emptyText="조건에 맞는 내 고객이 없습니다."
              onRemoved={(id) =>
                setCustomers((prev) => prev.filter((c) => c.id !== id))
              }
            />
            <MatchingCustomersSection
              title="현장동선내 공유 고객"
              items={matches.partner}
              propertyId={property.id}
              matchKind="partner"
              emptyText={<SiteShareMatchingEmpty kind="customer" />}
              onRemoved={(id) =>
                setCustomers((prev) => prev.filter((c) => c.id !== id))
              }
            />
          </div>
        </div>
      )}

      <SharePropertyModal
        open={shareOpen}
        properties={[property]}
        agent={agent}
        onClose={() => setShareOpen(false)}
      />

      <DuplicatePropertyModal
        open={dupOpen}
        onCancel={() => setDupOpen(false)}
        onConfirm={() => {
          setDupOpen(false);
          void saveProperty();
        }}
      />
      <RequiredFieldWarnModal
        open={warnOpen}
        message={warnMessage}
        onClose={() => setWarnOpen(false)}
      />
      <SaveCompleteModal
        open={savedOpen}
        onClose={() => setSavedOpen(false)}
      />
    </main>
  );
}
