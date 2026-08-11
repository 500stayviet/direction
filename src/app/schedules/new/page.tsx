"use client";

import {
  FormEvent,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { DatePicker } from "@/components/DatePicker";
import { TimePicker } from "@/components/TimePicker";
import { CustomerSearchInput } from "@/components/CustomerSearchInput";
import { PropertyEditor } from "@/components/PropertyEditor";
import { RouteSummaryCard } from "@/components/RouteSummaryCard";
import { StickyActionBar } from "@/components/StickyActionBar";
import { createEmptyProperty } from "@/lib/constants";
import { buildRouteSummary, findSmarterRouteHint } from "@/lib/distance";
import { createId } from "@/lib/id";
import {
  getCustomerById,
  touchRecentCustomer,
  upsertSchedule,
} from "@/lib/storage";
import { useCustomersList } from "@/hooks/useEntityList";
import type { Customer, Property, Schedule } from "@/lib/types";
import { PhoneLink } from "@/components/PhoneLink";
import {
  formatPhone,
  getCustomerBudgetLines,
  matchesBudgetSearch,
  matchesPhoneSearch,
} from "@/lib/format";
import {
  findPropertiesValidationIssue,
  type PropertyFieldKey,
} from "@/lib/propertyValidation";
import { addMinutesToHHmm, cascadeArriveTimes, sortPropertiesByArriveTime, swapPropertySlots } from "@/lib/arriveTime";
import { Modal } from "@/components/ui/Modal";

type CustomerMode = "search" | "guest" | "selected";

function ScheduleCreateInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const presetCustomerId = searchParams.get("customerId");

  const [query, setQuery] = useState("");
  const { items: customers } = useCustomersList();
  const [mode, setMode] = useState<CustomerMode>("search");
  const [selected, setSelected] = useState<Customer | null>(null);
  const [guestName, setGuestName] = useState("");
  const [visitDate, setVisitDate] = useState("");
  const [visitTime, setVisitTime] = useState("");
  const [properties, setProperties] = useState<Property[]>([
    createEmptyProperty(),
    createEmptyProperty(),
  ]);
  const [validationFocus, setValidationFocus] = useState<{
    index: number;
    focusField: PropertyFieldKey;
    message: string;
  } | null>(null);
  const [warnOpen, setWarnOpen] = useState(false);
  const warnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applyCustomerDealType = (customer: Customer) => {
    setSelected(customer);
    setMode("selected");
    setGuestName("");
    setProperties((prev) =>
      prev.map((p) => ({
        ...p,
        dealType: customer.dealType,
        roomType: customer.roomType ?? p.roomType ?? "원룸",
        deposit: p.deposit || customer.deposit || 0,
        monthlyRent:
          customer.dealType === "매매"
            ? undefined
            : p.monthlyRent ?? customer.monthlyRent,
      }))
    );
  };

  useEffect(() => {
    if (!presetCustomerId) return;
    void (async () => {
      const found = await getCustomerById(presetCustomerId);
      if (found) applyCustomerDealType(found);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetCustomerId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return customers
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
            matchesPhoneSearch(c.phone, q) ||
            matchesBudgetSearch(c, q)
      )
      .slice(0, 8);
  }, [customers, query]);

  const routeSummary = useMemo(
    () => buildRouteSummary(properties),
    [properties]
  );
  const smartHint = useMemo(
    () => findSmarterRouteHint(properties, routeSummary),
    [properties, routeSummary]
  );

  const updateProperty = (index: number, next: Property) => {
    setProperties((prev) => {
      const prevItem = prev[index];
      const replaced = prev.map((p, i) => (i === index ? next : p));
      const cascaded = cascadeArriveTimes(
        replaced,
        index,
        prevItem?.arriveTime ?? "",
        next.arriveTime ?? ""
      );
      if ((prevItem?.arriveTime ?? "") !== (next.arriveTime ?? "")) {
        return sortPropertiesByArriveTime(cascaded);
      }
      return cascaded;
    });
  };

  const swapProperty = (fromIndex: number, toIndex: number) => {
    setProperties((prev) => swapPropertySlots(prev, fromIndex, toIndex));
  };

  const addProperty = () => {
    if (properties.length >= 6) return;
    const empty = createEmptyProperty();
    const last = properties[properties.length - 1];
    const arriveTime = last?.arriveTime
      ? addMinutesToHHmm(last.arriveTime, 30)
      : "";
    setProperties((prev) => [
      ...prev,
      {
        ...(selected
          ? {
              ...empty,
              dealType: selected.dealType,
              roomType: selected.roomType ?? empty.roomType,
              deposit: selected.deposit || 0,
              monthlyRent:
                selected.dealType === "매매"
                  ? undefined
                  : selected.monthlyRent,
            }
          : empty),
        arriveTime,
      },
    ]);
  };

  const removeProperty = (index: number) => {
    if (properties.length <= 1) return;
    setProperties((prev) => prev.filter((_, i) => i !== index));
  };

  const resetCustomer = () => {
    setSelected(null);
    setGuestName("");
    setMode("search");
    setQuery("");
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (mode === "guest") {
      if (!guestName.trim()) {
        alert("성함을 입력해 주세요.");
        return;
      }
    } else if (!selected) {
      alert("고객을 선택하거나 고객없음을 눌러 성함을 입력해 주세요.");
      return;
    }

    if (!visitDate) {
      alert("방문 일자를 선택해 주세요.");
      return;
    }
    if (!visitTime) {
      alert("만나는 시간을 선택해 주세요.");
      return;
    }
    const propertyIssue = findPropertiesValidationIssue(properties);
    if (propertyIssue) {
      setValidationFocus({
        index: propertyIssue.index,
        focusField: propertyIssue.focusField,
        message: propertyIssue.message,
      });
      if (warnTimer.current) clearTimeout(warnTimer.current);
      // 스크롤 후 경고 모달
      warnTimer.current = setTimeout(() => setWarnOpen(true), 350);
      return;
    }
    setValidationFocus(null);
    setWarnOpen(false);

    const now = new Date().toISOString();
    const schedule: Schedule = {
      id: createId("sch"),
      customerId: selected?.id,
      guestName: mode === "guest" ? guestName.trim() : undefined,
      visitDate: visitDate || now.slice(0, 10),
      visitTime: visitTime || undefined,
      properties,
      routeSummary: buildRouteSummary(properties),
      createdAt: now,
      updatedAt: now,
    };
    try {
      await upsertSchedule(schedule);
      if (selected) await touchRecentCustomer(selected.id);
      router.push(`/schedules/${schedule.id}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "일정 저장에 실패했습니다.");
    }
  };

  return (
    <main className="relative">
      <PageHeader
        title="방문 일정 만들기"
        backHref="/"
        subtitle="고객 선택 후 매물 동선을 구성하세요"
      />

      <form
        id="schedule-create-form"
        onSubmit={handleSubmit}
        className="space-y-3 overscroll-y-contain pb-2"
      >
        <Card className="space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <p className="font-bold text-gray-900">고객 불러오기</p>
            {mode === "selected" ? (
              <Button
                type="button"
                variant="secondary"
                onClick={resetCustomer}
              >
                변경하기
              </Button>
            ) : (
              <label className="flex items-center gap-2 active:scale-95 transition-all duration-150">
                <input
                  type="checkbox"
                  checked={mode === "guest"}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setMode("guest");
                      setSelected(null);
                      setQuery("");
                    } else {
                      resetCustomer();
                    }
                  }}
                  className="h-5 w-5 accent-[#3182F6]"
                />
                <span className="text-[14px] font-semibold text-gray-700">
                  고객없음
                </span>
              </label>
            )}
          </div>

          {mode === "selected" && selected ? (
            <div className="rounded-2xl border border-[#3182F6]/25 bg-blue-50/40 px-3.5 py-3 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-[17px] font-bold tracking-tight text-gray-900">
                      {selected.name}
                    </p>
                    <span className="shrink-0 rounded-md bg-[#3182F6] px-1.5 py-0.5 text-[10px] font-bold text-white">
                      선택됨
                    </span>
                  </div>
                  <PhoneLink
                    phone={selected.phone}
                    className="mt-0.5 !text-[14px]"
                    showIcon={false}
                  />
                </div>
                <div className="shrink-0 space-y-1 text-right">
                  <p className="text-[17px] font-extrabold text-[#3182F6]">
                    {selected.dealType}
                  </p>
                  <p className="text-[16px] font-bold text-emerald-600">
                    {selected.roomType ?? "-"}
                  </p>
                </div>
              </div>
              <div className="mt-2.5 space-y-0.5 text-right">
                {getCustomerBudgetLines(selected).map((line) => (
                  <p
                    key={line}
                    className="text-[17px] font-extrabold tracking-tight text-gray-900"
                  >
                    {line.startsWith("월세") ? (
                      <span className="text-orange-600">{line}</span>
                    ) : (
                      <span className="text-[#1a4fa0]">{line}</span>
                    )}
                  </p>
                ))}
              </div>
            </div>
          ) : mode === "guest" ? (
            <Input
              label="성함"
              required
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="홍길동"
            />
          ) : (
            <>
              <CustomerSearchInput value={query} onChange={setQuery} />
              <div className="space-y-1.5">
                {!query.trim() ? (
                  <p className="py-2 text-sm text-gray-500">
                    성함 또는 전화번호를 검색하면 고객이 나타납니다.
                  </p>
                ) : filtered.length === 0 ? (
                  <p className="py-2 text-sm text-gray-500">
                    검색 결과가 없습니다. 고객없음을 체크하면 성함만 입력할 수
                    있어요.
                  </p>
                ) : (
                  filtered.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => applyCustomerDealType(c)}
                      className="w-full rounded-2xl border border-gray-100 bg-white px-3.5 py-3 text-left shadow-sm active:scale-[0.99] transition-all duration-150 hover:border-blue-100"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[17px] font-bold tracking-tight text-gray-900">
                            {c.name}
                          </p>
                          <p className="mt-0.5 text-[14px] font-semibold text-[#3182F6]">
                            {formatPhone(c.phone)}
                          </p>
                        </div>
                        <div className="shrink-0 space-y-1 text-right">
                          <p className="text-[17px] font-extrabold text-[#3182F6]">
                            {c.dealType}
                          </p>
                          <p className="text-[16px] font-bold text-emerald-600">
                            {c.roomType ?? "-"}
                          </p>
                        </div>
                      </div>
                      <div className="mt-2.5 space-y-0.5 text-right">
                        {getCustomerBudgetLines(c).map((line) => (
                          <p
                            key={line}
                            className="text-[17px] font-extrabold tracking-tight"
                          >
                            {line.startsWith("월세") ? (
                              <span className="text-orange-600">{line}</span>
                            ) : (
                              <span className="text-[#1a4fa0]">{line}</span>
                            )}
                          </p>
                        ))}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </>
          )}
          <div className="grid grid-cols-1 gap-2">
            <DatePicker
              label="방문 일자"
              required
              value={visitDate}
              onChange={setVisitDate}
            />
            <TimePicker
              label="만나는 시간"
              required
              value={visitTime}
              onChange={setVisitTime}
            />
          </div>
        </Card>

        <div className="space-y-6">
          {properties.map((property, index) => (
            <div key={property.id} className="space-y-2">
              {index > 0 && (
                <div
                  className="mx-1 border-t-2 border-dashed border-gray-200"
                  aria-hidden
                />
              )}
              <PropertyEditor
                index={index}
                property={property}
                onChange={(next) => updateProperty(index, next)}
                canRemove={properties.length > 1}
                onRemove={() => removeProperty(index)}
                propertyCount={properties.length}
                allProperties={properties}
                onSwapWith={(target) => swapProperty(index, target)}
                enableLoad
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
          <Card className="border-amber-100 bg-amber-50">
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
          onClick={addProperty}
          disabled={properties.length >= 6}
        >
          + 매물 추가
        </Button>
      </form>

      <StickyActionBar aboveTab>
        <Button type="submit" form="schedule-create-form" fullWidth size="lg">
          방문 일정 저장하기
        </Button>
      </StickyActionBar>

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

export default function NewSchedulePage() {
  return (
    <Suspense
      fallback={
        <main className="py-20 text-center text-gray-500">불러오는 중...</main>
      }
    >
      <ScheduleCreateInner />
    </Suspense>
  );
}
