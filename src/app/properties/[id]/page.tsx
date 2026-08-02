"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { StickyActionBar } from "@/components/StickyActionBar";
import { PropertyBrief } from "@/components/PropertyBrief";
import { PropertyEditor } from "@/components/PropertyEditor";
import { SharePropertyModal } from "@/components/SharePropertyModal";
import { getCurrentUser } from "@/lib/auth";
import { getPropertyValidationError } from "@/lib/propertyValidation";
import {
  deleteListedProperty,
  getListedPropertyById,
  upsertListedProperty,
} from "@/lib/storage";
import type { ListedProperty, User } from "@/lib/types";

export default function PropertyDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [property, setProperty] = useState<ListedProperty | null>(null);
  const [editing, setEditing] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [agent, setAgent] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  return (
    <main>
      <PageHeader
        title={editing ? "매물 정보 수정" : "매물 정보"}
        backHref="/properties"
        right={
          <div className="flex items-center gap-1.5">
            {!editing ? (
              <Button
                variant="outline"
                onClick={() => setShareOpen(true)}
                className="!px-2.5 !text-[13px]"
              >
                공유하기
              </Button>
            ) : null}
            <Button
              variant={editing ? "secondary" : "outline"}
              onClick={() => {
                if (editing) {
                  void getListedPropertyById(params.id).then((found) => {
                    if (found) setProperty(found);
                  });
                }
                setEditing((v) => !v);
              }}
              className="!px-2.5 !text-[13px]"
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
        <div className="pb-4">
          <PropertyBrief index={0} property={property} />
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
