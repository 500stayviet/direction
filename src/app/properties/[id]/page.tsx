"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { StickyActionBar } from "@/components/StickyActionBar";
import { PropertyBrief } from "@/components/PropertyBrief";
import { PropertyEditor } from "@/components/PropertyEditor";
import { getPropertyValidationError } from "@/lib/propertyValidation";
import {
  getListedPropertyById,
  upsertListedProperty,
} from "@/lib/storage";
import type { ListedProperty } from "@/lib/types";

export default function PropertyDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [property, setProperty] = useState<ListedProperty | null>(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    const found = getListedPropertyById(params.id);
    if (!found) {
      router.replace("/properties");
      return;
    }
    setProperty(found);
  }, [params.id, router]);

  if (!property) {
    return (
      <main className="py-20 text-center text-gray-500">불러오는 중...</main>
    );
  }

  const handleSave = (e: FormEvent) => {
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
    upsertListedProperty(next);
    setProperty(next);
    setEditing(false);
  };

  return (
    <main>
      <PageHeader
        title={editing ? "매물 정보 수정" : "매물 정보"}
        backHref="/properties"
        right={
          <Button
            variant={editing ? "secondary" : "outline"}
            onClick={() => {
              if (editing) {
                const found = getListedPropertyById(params.id);
                if (found) setProperty(found);
              }
              setEditing((v) => !v);
            }}
          >
            {editing ? "취소" : "수정"}
          </Button>
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
        <div className="pb-4">
          <PropertyBrief index={0} property={property} />
        </div>
      )}
    </main>
  );
}
