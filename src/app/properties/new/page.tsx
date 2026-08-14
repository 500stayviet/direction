"use client";

import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { StickyActionBar } from "@/components/StickyActionBar";
import { PropertyEditor } from "@/components/PropertyEditor";
import { DuplicatePropertyModal } from "@/components/DuplicatePropertyModal";
import { RequiredFieldWarnModal } from "@/components/RequiredFieldWarnModal";
import { SaveCompleteModal } from "@/components/SaveCompleteModal";
import { createEmptyProperty } from "@/lib/constants";
import { findPropertyBySameAddressRoom } from "@/lib/duplicateEntity";
import {
  getMissingRequiredFields,
  getFieldErrorMessage,
  type PropertyFieldKey,
} from "@/lib/propertyValidation";
import { upsertListedProperty } from "@/lib/storage";
import { usePropertiesList } from "@/hooks/useEntityList";
import type { ListedProperty, Property } from "@/lib/types";

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
  const [savedId, setSavedId] = useState<string | null>(null);
  const warnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      setSavedId(saved.id);
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
        property.roomNo ?? "",
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
      />

      <form
        id="property-create-form"
        noValidate
        onSubmit={handleSubmit}
        className="space-y-3 pb-2"
      >
        {/* 방문 일정의 1번 매물과 동일한 폼 */}
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
          if (savedId) router.push(`/properties/${savedId}`);
        }}
      />
    </main>
  );
}
