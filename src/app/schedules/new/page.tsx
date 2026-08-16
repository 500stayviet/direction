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
import { CustomerListCard } from "@/components/CustomerListCard";
import { CustomerBrief } from "@/components/CustomerBrief";
import { PropertyEditor } from "@/components/PropertyEditor";
import { RouteSummaryCard } from "@/components/RouteSummaryCard";
import { StickyActionBar } from "@/components/StickyActionBar";
import { TeamShareFormField } from "@/components/TeamShareFormField";
import { CircleCheck } from "@/components/ui/CircleCheck";
import {
  createEmptyProperty,
  MAX_SCHEDULE_PROPERTIES,
} from "@/lib/constants";
import { buildRouteSummary, findSmarterRouteHint } from "@/lib/distance";
import { createId } from "@/lib/id";
import {
  getCustomerById,
  touchRecentCustomer,
  upsertSchedule,
} from "@/lib/storage";
import { useCustomersList, usePropertiesList } from "@/hooks/useEntityList";
import type { Customer, ListedProperty, Property, Schedule } from "@/lib/types";
import {
  matchesBudgetSearch,
  matchesPhoneSearch,
} from "@/lib/format";
import {
  findPropertiesValidationIssue,
  type PropertyFieldKey,
} from "@/lib/propertyValidation";
import { addMinutesToHHmm, cascadeArriveTimes, sortPropertiesByArriveTime, swapPropertySlots } from "@/lib/arriveTime";
import { Modal } from "@/components/ui/Modal";
import { RequiredFieldWarnModal } from "@/components/RequiredFieldWarnModal";
import { MatchingPropertyPickModal } from "@/components/MatchingPropertyPickModal";
import { listedToScheduleProperty } from "@/components/PropertyLoadPicker";

type ScheduleFocus =
  | { target: "customer"; message: string }
  | { target: "guestName"; message: string }
  | { target: "visitDate"; message: string }
  | { target: "visitTime"; message: string }
  | {
      target: "property";
      index: number;
      focusField: PropertyFieldKey;
      message: string;
    };

type CustomerMode = "search" | "guest" | "selected";

function ScheduleCreateInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const presetCustomerId = searchParams.get("customerId");

  const [query, setQuery] = useState("");
  const { items: customers } = useCustomersList();
  const { items: listedProperties } = usePropertiesList();
  const [mode, setMode] = useState<CustomerMode>("search");
  const [pickOpen, setPickOpen] = useState(false);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [guestName, setGuestName] = useState("");
  const [visitDate, setVisitDate] = useState("");
  const [visitTime, setVisitTime] = useState("");
  const [properties, setProperties] = useState<Property[]>([
    createEmptyProperty(),
    createEmptyProperty(),
  ]);
  const [workspaceShared, setWorkspaceShared] = useState(false);
  const [validationFocus, setValidationFocus] = useState<ScheduleFocus | null>(
    null
  );
  const [warnOpen, setWarnOpen] = useState(false);
  const [customerDetailOpen, setCustomerDetailOpen] = useState(false);
  const warnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const customerRef = useRef<HTMLDivElement | null>(null);
  const guestNameRef = useRef<HTMLDivElement | null>(null);
  const visitDateRef = useRef<HTMLDivElement | null>(null);
  const visitTimeRef = useRef<HTMLDivElement | null>(null);

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
      if (!found) return;
      applyCustomerDealType(found);
      setPickOpen(true);
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

  const applyPickedProperties = (picked: ListedProperty[]) => {
    setPickOpen(false);
    if (picked.length === 0) return;
    setProperties(picked.map(listedToScheduleProperty));
  };

  const addProperty = () => {
    if (properties.length >= MAX_SCHEDULE_PROPERTIES) return;
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

  useEffect(() => {
    if (!validationFocus) return;
    const el =
      validationFocus.target === "customer"
        ? customerRef.current
        : validationFocus.target === "guestName"
          ? guestNameRef.current
          : validationFocus.target === "visitDate"
            ? visitDateRef.current
            : validationFocus.target === "visitTime"
              ? visitTimeRef.current
              : null;
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [validationFocus]);

  const showWarn = (focus: ScheduleFocus) => {
    setValidationFocus(focus);
    if (warnTimer.current) clearTimeout(warnTimer.current);
    warnTimer.current = setTimeout(() => setWarnOpen(true), 350);
  };

  const resetCustomer = () => {
    setSelected(null);
    setGuestName("");
    setMode("search");
    setQuery("");
    setCustomerDetailOpen(false);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (mode === "guest") {
      if (!guestName.trim()) {
        showWarn({
          target: "guestName",
          message: "성함 칸 입력은 필수입니다.",
        });
        return;
      }
    } else if (!selected) {
      showWarn({
        target: "customer",
        message: "고객을 선택하거나 고객없음을 눌러 성함을 입력해 주세요.",
      });
      return;
    }

    if (!visitDate) {
      showWarn({
        target: "visitDate",
        message: "방문 일자 칸 입력은 필수입니다.",
      });
      return;
    }
    if (!visitTime) {
      showWarn({
        target: "visitTime",
        message: "만나는 시간 칸 입력은 필수입니다.",
      });
      return;
    }
    const propertyIssue = findPropertiesValidationIssue(properties);
    if (propertyIssue) {
      showWarn({
        target: "property",
        index: propertyIssue.index,
        focusField: propertyIssue.focusField,
        message: propertyIssue.message,
      });
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
      workspaceShared,
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
        onBack={pickOpen ? () => setPickOpen(false) : undefined}
        backHref={
          presetCustomerId ? `/customers/${presetCustomerId}` : "/"
        }
        subtitle="고객 선택 후 매물 동선을 구성하세요"
      />

      <form
        id="schedule-create-form"
        noValidate
        onSubmit={handleSubmit}
        className="space-y-2.5 overscroll-y-contain pb-2"
      >
        <div className="space-y-3">
          <div ref={customerRef}>
          <Card
            className={[
              "space-y-2.5 !overflow-visible",
              validationFocus?.target === "customer"
                ? "!border-red-500 !bg-red-50"
                : "",
            ].join(" ")}
          >
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
                  <CircleCheck
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
                  />
                  <span className="text-[14px] font-semibold text-gray-700">
                    고객없음
                  </span>
                </label>
              )}
            </div>

            {mode === "guest" ? (
              <div ref={guestNameRef}>
                <Input
                  label="성함"
                  required
                  invalid={validationFocus?.target === "guestName"}
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="홍길동"
                />
              </div>
            ) : mode !== "selected" ? (
              <>
                <CustomerSearchInput value={query} onChange={setQuery} />
                {query.trim() && filtered.length === 0 ? (
                  <p className="py-1 text-sm text-gray-500">
                    검색 결과가 없습니다. 고객없음을 체크하면 성함만 입력할 수
                    있어요.
                  </p>
                ) : null}
              </>
            ) : null}
          </Card>
          </div>

          {mode === "selected" && selected ? (
            <div
              role="button"
              tabIndex={0}
              onClick={() => setCustomerDetailOpen(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setCustomerDetailOpen(true);
                }
              }}
              className="cursor-pointer overflow-visible pr-2 active:scale-[0.99] transition-all duration-150"
            >
              <CustomerListCard customer={selected} />
            </div>
          ) : null}

          {mode === "search" && filtered.length > 0 ? (
            <div className="space-y-2 overflow-visible pr-2">
              {filtered.map((c) => (
                <div
                  key={c.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => applyCustomerDealType(c)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      applyCustomerDealType(c);
                    }
                  }}
                  className="cursor-pointer active:scale-[0.99] transition-all duration-150"
                >
                  <CustomerListCard customer={c} />
                </div>
              ))}
            </div>
          ) : null}

          <Card className="space-y-2.5">
            <div className="grid grid-cols-1 gap-2">
              <div ref={visitDateRef}>
                <DatePicker
                  label="방문 일자"
                  required
                  invalid={validationFocus?.target === "visitDate"}
                  value={visitDate}
                  onChange={setVisitDate}
                />
              </div>
              <div ref={visitTimeRef}>
                <TimePicker
                  label="만나는 시간"
                  required
                  invalid={validationFocus?.target === "visitTime"}
                  value={visitTime}
                  onChange={setVisitTime}
                />
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          {properties.map((property, index) => (
            <div key={property.id} className="space-y-1.5">
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
                showTeamShare={false}
                validationActive={
                  validationFocus?.target === "property" &&
                  validationFocus.index === index
                }
                focusField={
                  validationFocus?.target === "property" &&
                  validationFocus.index === index
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
          disabled={properties.length >= MAX_SCHEDULE_PROPERTIES}
        >
          + 매물 추가
        </Button>

        <TeamShareFormField
          value={workspaceShared}
          onChange={setWorkspaceShared}
        />
      </form>

      <StickyActionBar aboveTab>
        <Button type="submit" form="schedule-create-form" fullWidth size="lg">
          방문일정 생성하기
        </Button>
      </StickyActionBar>

      <Modal
        open={customerDetailOpen && Boolean(selected)}
        onClose={() => setCustomerDetailOpen(false)}
        title="고객 정보"
        description="조회만 가능합니다"
        showClose
        className="max-h-[min(85vh,640px)] overflow-y-auto"
      >
        {selected ? <CustomerBrief customer={selected} /> : null}
        <Button
          fullWidth
          variant="secondary"
          className="mt-4"
          onClick={() => setCustomerDetailOpen(false)}
        >
          닫기
        </Button>
      </Modal>

      <MatchingPropertyPickModal
        open={pickOpen}
        customer={selected}
        properties={listedProperties}
        onClose={() => setPickOpen(false)}
        onConfirm={applyPickedProperties}
      />

      <RequiredFieldWarnModal
        open={warnOpen}
        message={validationFocus?.message}
        onClose={() => setWarnOpen(false)}
      />
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
