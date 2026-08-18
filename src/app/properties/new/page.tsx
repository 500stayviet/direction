"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { DetailHeaderButton } from "@/components/DetailHeaderButton";
import { StickyActionBar } from "@/components/StickyActionBar";
import { PropertyEditor } from "@/components/PropertyEditor";
import { BlankFormModal } from "@/components/BlankFormModal";
import { DuplicatePropertyModal } from "@/components/DuplicatePropertyModal";
import { RequiredFieldWarnModal } from "@/components/RequiredFieldWarnModal";
import { SaveCompleteModal } from "@/components/SaveCompleteModal";
import { getCurrentUser, peekCurrentUser } from "@/lib/auth";
import { createEmptyProperty } from "@/lib/constants";
import { findPropertyBySameAddressRoom } from "@/lib/duplicateEntity";
import { composeRestAddress } from "@/lib/propertyRoomNo";
import {
  getMissingRequiredFields,
  getFieldErrorMessage,
  type PropertyFieldKey,
} from "@/lib/propertyValidation";
import { upsertListedProperty } from "@/lib/storage";
import { usePropertiesList } from "@/hooks/useEntityList";
import type { ListedProperty, Property, User } from "@/lib/types";

export default function NewPropertyPage() {
  const router = useRouter();
  const { items: listed } = usePropertiesList();
  const [property, setProperty] = useState<Property>(() => createEmptyProperty());
  const [dupOpen, setDupOpen] = useState(false);
  const [validationActive, setValidationActive] = useState(false);
  const [focusField, setFocusField] = useState<PropertyFieldKey | undefined>();
  const [warnOpen, setWarnOpen] = useState(false);
  const [warnMessage, setWarnMessage] = useState("");
  const [savedOpen, setSavedOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [agent, setAgent] = useState<User | null>(() => peekCurrentUser());
  const warnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getCurrentUser().then((u) => {
      if (!cancelled) setAgent(u);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const saveProperty = async () => {
    const now = new Date().toISOString();
    const saved: ListedProperty = {
      ...property,
      address: property.address.trim(),
      createdAt: now,
      updatedAt: now,
    };
    try {
      await upsertListedProperty(saved);
      setSavedOpen(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : "매물 저장에 실패했습니다.");
    }
  };

  const handleSubmit = async (e: FormEvent) => {
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

  const goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.replace("/properties");
  };

  return (
    <main>
      <PageHeader
        title="매물 등록"
        onBack={goBack}
        subtitle="방문 일정과 같은 매물 정보로 등록해요"
        right={
          <DetailHeaderButton tone="form" onClick={() => setFormOpen(true)}>
            매물등록 양식
          </DetailHeaderButton>
        }
      />

      <form
        id="property-create-form"
        noValidate
        onSubmit={handleSubmit}
        className="space-y-3 pb-2"
      >
        <PropertyEditor
          index={0}
          property={property}
          onChange={setProperty}
          showTitle={false}
          showArriveTime={false}
          enableIntake
          validationActive={validationActive}
          focusField={focusField}
        />
      </form>

      <StickyActionBar>
        <Button type="submit" form="property-create-form" fullWidth size="lg">
          매물등록하기
        </Button>
      </StickyActionBar>

      <BlankFormModal
        open={formOpen}
        kind="property"
        agent={agent}
        onClose={() => setFormOpen(false)}
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
        message="등록이 완료되었습니다"
        onClose={() => {
          setSavedOpen(false);
          router.replace("/properties");
        }}
      />
    </main>
  );
}
