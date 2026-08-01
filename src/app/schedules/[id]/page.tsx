"use client";

import { FormEvent, Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DatePicker } from "@/components/DatePicker";
import { TimePicker } from "@/components/TimePicker";
import { PropertyEditor } from "@/components/PropertyEditor";
import { PropertyBrief } from "@/components/PropertyBrief";
import { RouteSummaryCard } from "@/components/RouteSummaryCard";
import { PhoneLink } from "@/components/PhoneLink";
import { StickyActionBar } from "@/components/StickyActionBar";
import { Modal } from "@/components/ui/Modal";
import { createEmptyProperty } from "@/lib/constants";
import { addMinutesToHHmm, cascadeArriveTimes } from "@/lib/arriveTime";
import { buildRouteSummary, findSmarterRouteHint } from "@/lib/distance";
import {
  getCustomerById,
  getScheduleById,
  upsertSchedule,
} from "@/lib/storage";
import { formatVisitDateTime, getCustomerBudgetLabel } from "@/lib/format";
import {
  findPropertiesValidationIssue,
  type PropertyFieldKey,
} from "@/lib/propertyValidation";
import type { Customer, Property, Schedule } from "@/lib/types";

function ScheduleDetailInner() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const fromNavi = searchParams.get("from") === "navi";
  const router = useRouter();
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [editing, setEditing] = useState(false);
  const [visitDate, setVisitDate] = useState("");
  const [visitTime, setVisitTime] = useState("");
  const [properties, setProperties] = useState<Property[]>([]);
  const [validationFocus, setValidationFocus] = useState<{
    index: number;
    focusField: PropertyFieldKey;
    message: string;
  } | null>(null);
  const [warnOpen, setWarnOpen] = useState(false);
  const warnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const found = await getScheduleById(params.id);
      if (cancelled) return;
      if (!found) {
        router.replace("/");
        return;
      }
      setSchedule(found);
      setVisitDate(found.visitDate ?? "");
      setVisitTime(found.visitTime ?? "");
      setProperties(found.properties);
      if (found.customerId) {
        setCustomer((await getCustomerById(found.customerId)) ?? null);
      } else {
        setCustomer(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.id, router]);

  const routeSummary = useMemo(
    () => (editing ? buildRouteSummary(properties) : schedule?.routeSummary ?? []),
    [editing, properties, schedule]
  );
  const smartHint = useMemo(
    () => findSmarterRouteHint(properties, routeSummary),
    [properties, routeSummary]
  );

  if (!schedule) {
    return (
      <main className="py-20 text-center text-gray-500">불러오는 중...</main>
    );
  }

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    const propertyIssue = findPropertiesValidationIssue(properties);
    if (propertyIssue) {
      setValidationFocus({
        index: propertyIssue.index,
        focusField: propertyIssue.focusField,
        message: propertyIssue.message,
      });
      if (warnTimer.current) clearTimeout(warnTimer.current);
      warnTimer.current = setTimeout(() => setWarnOpen(true), 350);
      return;
    }
    setValidationFocus(null);
    setWarnOpen(false);
    const next: Schedule = {
      ...schedule,
      visitDate,
      visitTime,
      properties,
      routeSummary: buildRouteSummary(properties),
      updatedAt: new Date().toISOString(),
    };
    await upsertSchedule(next);
    setSchedule(next);
    setEditing(false);
  };

  return (
    <main>
      <PageHeader
        title={editing ? "일정 수정" : "방문 일정"}
        backHref={
          fromNavi
            ? "/navi"
            : customer
              ? `/customers/${customer.id}`
              : "/schedules/new"
        }
        right={
          <Button
            variant={editing ? "secondary" : "outline"}
            onClick={() => {
              if (editing) {
                setVisitDate(schedule.visitDate ?? "");
                setVisitTime(schedule.visitTime ?? "");
                setProperties(schedule.properties);
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
          <form
            id="schedule-edit-form"
            onSubmit={handleSave}
            className="space-y-4 pb-2"
          >
            <Card className="space-y-2">
              <DatePicker
                label="방문 일자"
                value={visitDate}
                onChange={setVisitDate}
              />
              <TimePicker
                label="만나는 시간"
                value={visitTime}
                onChange={setVisitTime}
              />
            </Card>
            <div className="space-y-6">
              {properties.map((property, index) => (
                <div key={property.id} className="space-y-3">
                  {index > 0 && (
                    <div
                      className="mx-1 border-t-2 border-dashed border-gray-200"
                      aria-hidden
                    />
                  )}
                  <PropertyEditor
                    index={index}
                    property={property}
                    onChange={(next) =>
                      setProperties((prev) => {
                        const prevItem = prev[index];
                        const replaced = prev.map((p, i) =>
                          i === index ? next : p
                        );
                        return cascadeArriveTimes(
                          replaced,
                          index,
                          prevItem?.arriveTime ?? "",
                          next.arriveTime ?? ""
                        );
                      })
                    }
                    enableLoad
                    canRemove={properties.length > 1}
                    onRemove={() =>
                      setProperties((prev) =>
                        prev.filter((_, i) => i !== index)
                      )
                    }
                    validationActive={validationFocus?.index === index}
                    focusField={
                      validationFocus?.index === index
                        ? validationFocus.focusField
                        : undefined
                    }
                  />
                  {routeSummary[index] && (
                    <RouteSummaryCard summary={routeSummary[index]} />
                  )}
                </div>
              ))}
            </div>
            {smartHint && (
              <Card className="bg-amber-50 border-amber-100">
                <p className="text-sm font-semibold text-amber-800">
                  💡 스마트 루트 추천
                </p>
                <p className="mt-1 text-sm text-amber-900">{smartHint}</p>
              </Card>
            )}
            <Button
              type="button"
              variant="outline"
              fullWidth
              onClick={() =>
                setProperties((prev) => {
                  const last = prev[prev.length - 1];
                  const arriveTime = last?.arriveTime
                    ? addMinutesToHHmm(last.arriveTime, 30)
                    : "";
                  return [
                    ...prev,
                    { ...createEmptyProperty(), arriveTime },
                  ];
                })
              }
              disabled={properties.length >= 6}
            >
              + 매물 추가
            </Button>
          </form>
          <StickyActionBar>
            <Button
              type="submit"
              form="schedule-edit-form"
              fullWidth
              size="lg"
            >
              변경사항 저장
            </Button>
          </StickyActionBar>
        </>
      ) : (
        <div className="space-y-3">
          <Card className="!overflow-hidden !p-0">
            <div className="bg-[#3182F6] px-4 py-3.5 text-white">
              <p className="text-[11px] font-semibold tracking-wide text-white/75">
                방문 시간
              </p>
              <p className="mt-0.5 text-[22px] font-extrabold tracking-tight">
                {formatVisitDateTime(schedule.visitDate, schedule.visitTime)}
              </p>
            </div>
            <div className="space-y-2 px-4 py-3.5">
              {customer ? (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <p className="min-w-0 truncate text-[20px] font-extrabold tracking-tight text-gray-900">
                      {customer.name}
                    </p>
                    <PhoneLink
                      phone={customer.phone}
                      className="!shrink-0 !rounded-xl !bg-[#E8F8F1] !px-3 !py-2 !text-[16px] !font-extrabold !text-[#03B26C]"
                    />
                  </div>
                  <p className="text-[13px] font-semibold text-gray-500">
                    {customer.roomType ?? "-"} · {customer.dealType} ·{" "}
                    {getCustomerBudgetLabel(customer)}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-[20px] font-extrabold tracking-tight text-gray-900">
                    {schedule.guestName || "이름 없음"}
                  </p>
                  <p className="text-[13px] font-medium text-gray-500">
                    고객없음 · 성함만 등록
                  </p>
                </>
              )}
            </div>
          </Card>

          {schedule.properties.map((property, index) => (
            <div key={property.id} className="space-y-3">
              <PropertyBrief index={index} property={property} />
              {schedule.routeSummary[index] && (
                <RouteSummaryCard summary={schedule.routeSummary[index]} />
              )}
            </div>
          ))}

          <div className="space-y-2 pt-1">
            <Link href={`/navi/${schedule.id}`}>
              <Button fullWidth size="lg">
                원터치 네비게이션 시작
              </Button>
            </Link>
            <p className="px-1 text-center text-[12px] text-gray-500">
              매물 카드의 📞 전화 · 📍 주소로 바로 연결됩니다
            </p>
          </div>
        </div>
      )}

      <Modal
        open={warnOpen}
        onClose={() => setWarnOpen(false)}
        position="center"
        dense
        title="필수 항목 미입력"
        description={validationFocus?.message}
      >
        <div className="rounded-2xl border-2 border-red-400 bg-red-50 px-4 py-3">
          <p className="text-[15px] font-bold text-red-700">
            빨간 테두리 칸을 입력해 주세요.
          </p>
          <p className="mt-1 text-[13px] font-medium text-red-600/90">
            입력하면 테두리가 바로 사라집니다.
          </p>
        </div>
        <Button
          fullWidth
          className="mt-3 !bg-red-500 hover:!bg-red-600"
          onClick={() => setWarnOpen(false)}
        >
          확인
        </Button>
      </Modal>
    </main>
  );
}

export default function ScheduleDetailPage() {
  return (
    <Suspense
      fallback={
        <main className="py-20 text-center text-gray-500">불러오는 중...</main>
      }
    >
      <ScheduleDetailInner />
    </Suspense>
  );
}
