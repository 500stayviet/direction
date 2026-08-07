"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { StickyActionBar } from "@/components/StickyActionBar";
import { PropertyEditor } from "@/components/PropertyEditor";
import { createEmptyProperty } from "@/lib/constants";
import { getPropertyValidationError } from "@/lib/propertyValidation";
import { upsertListedProperty } from "@/lib/storage";
import type { ListedProperty, Property } from "@/lib/types";

export default function NewPropertyPage() {
  const router = useRouter();
  const [property, setProperty] = useState<Property>(() => createEmptyProperty());

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const error = getPropertyValidationError(property);
    if (error) {
      alert(error);
      return;
    }
    const now = new Date().toISOString();
    const saved: ListedProperty = {
      ...property,
      address: property.address.trim(),
      createdAt: now,
      updatedAt: now,
    };
    try {
      await upsertListedProperty(saved);
      router.push(`/properties/${saved.id}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "매물 저장에 실패했습니다.");
    }
  };

  return (
    <main>
      <PageHeader
        title="매물 추가"
        backHref="/properties"
        subtitle="방문 일정과 같은 매물 정보로 등록해요"
      />

      <form
        id="property-create-form"
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
        />
      </form>

      <StickyActionBar>
        <Button type="submit" form="property-create-form" fullWidth size="lg">
          등록하기
        </Button>
      </StickyActionBar>
    </main>
  );
}
