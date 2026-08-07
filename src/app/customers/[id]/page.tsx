"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CustomerForm } from "@/components/CustomerForm";
import { PhoneLink } from "@/components/PhoneLink";
import { StickyActionBar } from "@/components/StickyActionBar";
import {
  deleteCustomer,
  getCustomerById,
  getSchedulesByCustomer,
  touchRecentCustomer,
  upsertCustomer,
} from "@/lib/storage";
import {
  formatVisitDateTime,
  getCustomerBudgetLabel,
  getCustomerLoanLabel,
  getCustomerMoveInLabel,
  getCustomerParkingLabel,
} from "@/lib/format";
import { displayRoomType } from "@/lib/constants";
import type { Customer, Schedule } from "@/lib/types";

function InfoRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 border-b border-gray-100 py-2.5 last:border-b-0">
      <span className="w-[72px] shrink-0 pt-0.5 text-[13px] font-semibold text-gray-400">
        {label}
      </span>
      <div className="min-w-0 flex-1 text-[15px] font-semibold leading-snug text-gray-900">
        {children}
      </div>
    </div>
  );
}

export default function CustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const found = await getCustomerById(params.id);
      if (cancelled) return;
      if (!found) {
        router.replace("/");
        return;
      }
      setCustomer(found);
      setSchedules(await getSchedulesByCustomer(found.id));
      void touchRecentCustomer(found.id);
    })();
    return () => {
      cancelled = true;
    };
  }, [params.id, router]);

  if (!customer) {
    return (
      <main className="py-20 text-center text-gray-500">불러오는 중...</main>
    );
  }

  const handleDelete = () => {
    if (
      !window.confirm(
        "이 고객을 삭제할까요?\n관련된 방문 일정도 함께 삭제됩니다."
      )
    ) {
      return;
    }
    setDeleting(true);
    void deleteCustomer(customer.id)
      .then(() => router.replace("/customers"))
      .catch((err: unknown) => {
        alert(err instanceof Error ? err.message : "삭제에 실패했습니다.");
        setDeleting(false);
      });
  };

  return (
    <main>
      <PageHeader
        title={editing ? "고객 정보 수정" : "고객 정보"}
        backHref="/customers"
        right={
          <div className="flex items-center gap-1.5">
            <Button
              variant={editing ? "secondary" : "outline"}
              onClick={() => setEditing((v) => !v)}
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
        <CustomerForm
          initial={customer}
          submitLabel="변경사항 저장"
          onSubmit={(next) => {
            void upsertCustomer(next).then(() => {
              setCustomer(next);
              setEditing(false);
            });
          }}
        />
      ) : (
        <>
          <div className="space-y-2.5 pb-4">
            <Card className="!p-3">
              <InfoRow label="고객명">{customer.name}</InfoRow>
              <InfoRow label="전화">
                <PhoneLink phone={customer.phone} />
              </InfoRow>
              <InfoRow label="거래유형">
                {displayRoomType(customer.roomType, customer.buildingKind)}
              </InfoRow>
              <InfoRow label="거래">
                {customer.dealType}
                {customer.nonOccupancy ? " · 비입주" : ""}
              </InfoRow>
              <InfoRow label="금액">
                {getCustomerBudgetLabel(customer)}
              </InfoRow>
              <InfoRow label="입주">
                {getCustomerMoveInLabel(customer)}
              </InfoRow>
              {!(
                customer.roomType === "상가" ||
                customer.roomType === "사무실" ||
                customer.roomType === "토지" ||
                customer.roomType === "건물"
              ) && (
                <InfoRow label="대출">{getCustomerLoanLabel(customer)}</InfoRow>
              )}
              {customer.roomType !== "토지" &&
                customer.roomType !== "건물" && (
                <InfoRow label="주차">{getCustomerParkingLabel(customer)}</InfoRow>
              )}
              {customer.roomType !== "토지" &&
                customer.roomType !== "건물" && (
                  <InfoRow label="애완동물">{customer.petAllowed ?? "-"}</InfoRow>
                )}
              {customer.notes && (
                <InfoRow label="메모">
                  <span className="whitespace-pre-wrap font-medium text-gray-800">
                    {customer.notes}
                  </span>
                </InfoRow>
              )}
            </Card>

            {schedules.length > 0 && (
              <div className="space-y-1.5">
                <p className="px-1 text-sm font-bold text-gray-700">저장된 일정</p>
                {schedules.map((s) => (
                  <Link key={s.id} href={`/schedules/${s.id}`}>
                    <Card pressable className="mb-1.5 !p-3">
                      <p className="text-[15px] font-bold">
                        매물 {s.properties.length}곳 ·{" "}
                        {formatVisitDateTime(
                          s.visitDate || s.createdAt.slice(0, 10),
                          s.visitTime
                        )}
                      </p>
                      <p className="mt-0.5 text-sm text-gray-500">
                        {s.properties
                          .map((p) => p.partnerAgency.dong || p.address)
                          .filter(Boolean)
                          .join(" → ") || "주소 미입력"}
                      </p>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
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
    </main>
  );
}
