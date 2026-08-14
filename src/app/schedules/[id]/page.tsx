"use client";

import { FormEvent, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { CircleCheck } from "@/components/ui/CircleCheck";
import { DatePicker } from "@/components/DatePicker";
import { TimePicker } from "@/components/TimePicker";
import { CustomerSearchInput } from "@/components/CustomerSearchInput";
import { CustomerListCard } from "@/components/CustomerListCard";
import { CustomerBrief } from "@/components/CustomerBrief";
import { CustomerPreferredLocationBlock } from "@/components/CustomerPreferredLocationBlock";
import { PropertyEditor } from "@/components/PropertyEditor";
import { PropertyBrief } from "@/components/PropertyBrief";
import { RouteSummaryCard } from "@/components/RouteSummaryCard";
import { PhoneLink } from "@/components/PhoneLink";
import { StickyActionBar } from "@/components/StickyActionBar";
import { ListEdgeChips } from "@/components/ListEdgeChips";
import { Modal } from "@/components/ui/Modal";
import { RequiredFieldWarnModal } from "@/components/RequiredFieldWarnModal";
import { SaveCompleteModal } from "@/components/SaveCompleteModal";
import { SharePropertyModal } from "@/components/SharePropertyModal";
import { DetailHeaderButton } from "@/components/DetailHeaderButton";
import { TeamShareButton } from "@/components/SiteShareUi";
import { createEmptyProperty, MAX_SCHEDULE_PROPERTIES } from "@/lib/constants";
import { addMinutesToHHmm, cascadeArriveTimes, sortPropertiesByArriveTime, swapPropertySlots } from "@/lib/arriveTime";
import { getCurrentUser, peekCurrentUser } from "@/lib/auth";
import { buildRouteSummary, findSmarterRouteHint } from "@/lib/distance";
import {
  deleteSchedule,
  getCustomerById,
  getScheduleById,
  setScheduleWorkspaceShared,
  touchRecentCustomer,
  upsertSchedule,
} from "@/lib/storage";
import { useCustomersList } from "@/hooks/useEntityList";
import {
  confirmForeignTeamDelete,
  confirmForeignTeamEdit,
  isForeignTeamItem,
} from "@/lib/teamActionGuard";
import { fetchWorkspaceStatus } from "@/lib/workspace";
import {
  formatVisitDateTime,
  getCustomerBudgetLabel,
  getCustomerLoanLabel,
  getCustomerMoveInLabel,
  getCustomerParkingLabel,
  yesNoLabel,
  matchesBudgetSearch,
  matchesPhoneSearch,
} from "@/lib/format";
import {
  findPropertiesValidationIssue,
  type PropertyFieldKey,
} from "@/lib/propertyValidation";
import type { Customer, Property, Schedule, User } from "@/lib/types";

type CustomerMode = "search" | "guest" | "selected";

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

/** 매물 1개 일정: 네비게이션 시작 후 이 시간이 지나면 완료 문구로 전환 */
const SINGLE_NAV_DONE_MS = 30 * 60 * 1000;

function singleNavStartedKey(scheduleId: string) {
  return `schedule_nav_started:${scheduleId}`;
}

function CustomerMeta({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold leading-none text-gray-400">
        {label}
      </p>
      <p className="mt-1 truncate text-[13px] font-bold leading-snug text-gray-900">
        {value}
      </p>
    </div>
  );
}

function ScheduleDetailInner() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const fromNavi = searchParams.get("from") === "navi";
  const router = useRouter();
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [editing, setEditing] = useState(false);
  const [customerMode, setCustomerMode] = useState<CustomerMode>("selected");
  const [guestName, setGuestName] = useState("");
  const [customerQuery, setCustomerQuery] = useState("");
  const { items: customers } = useCustomersList();
  const [deleting, setDeleting] = useState(false);
  const [visitDate, setVisitDate] = useState("");
  const [visitTime, setVisitTime] = useState("");
  const [properties, setProperties] = useState<Property[]>([]);
  const [validationFocus, setValidationFocus] = useState<ScheduleFocus | null>(
    null
  );
  const [warnOpen, setWarnOpen] = useState(false);
  const customerPickRef = useRef<HTMLDivElement | null>(null);
  const guestNameRef = useRef<HTMLDivElement | null>(null);
  const visitDateRef = useRef<HTMLDivElement | null>(null);
  const visitTimeRef = useRef<HTMLDivElement | null>(null);
  const [customerDetailOpen, setCustomerDetailOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [hasTeammates, setHasTeammates] = useState(false);
  const [workspaceShareBusy, setWorkspaceShareBusy] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);
  const [agent, setAgent] = useState<User | null>(null);
  /** -1: 시작 전, 0..n-1: 현재 포커스 매물(시간순) */
  const [navStep, setNavStep] = useState(-1);
  /** 매물 1개: 시작 시각 기준 30분 경과 여부 */
  const [singleNavDone, setSingleNavDone] = useState(false);
  const [navModalOpen, setNavModalOpen] = useState(false);
  /** 모달에 표시 중인 단계(시간순 인덱스) */
  const [navAnnounceStep, setNavAnnounceStep] = useState<number | null>(null);
  const propertyRefs = useRef<(HTMLDivElement | null)[]>([]);
  const warnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navModalTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const singleNavDoneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const closeNavModal = () => {
    if (navModalTimer.current) {
      clearTimeout(navModalTimer.current);
      navModalTimer.current = null;
    }
    setNavModalOpen(false);
    setNavAnnounceStep(null);
  };

  const openNavAnnounce = (step: number) => {
    if (navModalTimer.current) clearTimeout(navModalTimer.current);
    setNavAnnounceStep(step);
    setNavModalOpen(true);
    navModalTimer.current = setTimeout(() => {
      setNavModalOpen(false);
      setNavAnnounceStep(null);
      navModalTimer.current = null;
    }, 1000);
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [found, me, ws] = await Promise.all([
        getScheduleById(params.id),
        getCurrentUser(),
        fetchWorkspaceStatus(),
      ]);
      if (cancelled) return;
      if (!found) {
        router.replace("/");
        return;
      }
      setAgent(me);
      setHasTeammates(
        Boolean(
          ws.ok && ws.workspace && (ws.workspace.memberCount ?? 0) > 1
        )
      );
      setSchedule(found);
      setVisitDate(found.visitDate ?? "");
      setVisitTime(found.visitTime ?? "");
      setProperties(found.properties);

      // 매물 1개: 이전에 네비게이션 시작한 시각이 있으면 복원 (30분 후 완료)
      if (singleNavDoneTimer.current) {
        clearTimeout(singleNavDoneTimer.current);
        singleNavDoneTimer.current = null;
      }
      const isSingle = found.properties.length === 1;
      let startedAt: number | null = null;
      try {
        const raw = localStorage.getItem(singleNavStartedKey(found.id));
        const n = raw ? Number(raw) : NaN;
        if (Number.isFinite(n) && n > 0) startedAt = n;
      } catch {
        /* ignore */
      }
      if (isSingle && startedAt != null) {
        const elapsed = Date.now() - startedAt;
        setNavStep(0);
        if (elapsed >= SINGLE_NAV_DONE_MS) {
          setSingleNavDone(true);
        } else {
          setSingleNavDone(false);
          singleNavDoneTimer.current = setTimeout(() => {
            setSingleNavDone(true);
            singleNavDoneTimer.current = null;
          }, SINGLE_NAV_DONE_MS - elapsed);
        }
      } else {
        setNavStep(-1);
        setSingleNavDone(false);
      }

      if (found.customerId) {
        setCustomer((await getCustomerById(found.customerId)) ?? null);
      } else {
        setCustomer(null);
      }
    })();
    return () => {
      cancelled = true;
      if (navModalTimer.current) clearTimeout(navModalTimer.current);
      if (singleNavDoneTimer.current) clearTimeout(singleNavDoneTimer.current);
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
  const shareProperties = useMemo(() => {
    return editing || !schedule ? properties : schedule.properties;
  }, [editing, properties, schedule]);

  const filteredCustomers = useMemo(() => {
    const q = customerQuery.trim().toLowerCase();
    if (!q) return [];
    return customers
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          matchesPhoneSearch(c.phone, q) ||
          matchesBudgetSearch(c, q)
      )
      .slice(0, 8);
  }, [customers, customerQuery]);

  const applyCustomer = (next: Customer) => {
    setCustomer(next);
    setCustomerMode("selected");
    setGuestName("");
    setProperties((prev) =>
      prev.map((p) => ({
        ...p,
        dealType: next.dealType,
        roomType: next.roomType ?? p.roomType ?? "원룸",
        deposit: p.deposit || next.deposit || 0,
        monthlyRent:
          next.dealType === "매매"
            ? undefined
            : p.monthlyRent ?? next.monthlyRent,
      }))
    );
  };

  const resetCustomerPick = () => {
    setCustomer(null);
    setGuestName("");
    setCustomerMode("search");
    setCustomerQuery("");
    setCustomerDetailOpen(false);
  };

  const restoreCustomerFromSchedule = (s: Schedule) => {
    setGuestName(s.guestName ?? "");
    setCustomerQuery("");
    setCustomerDetailOpen(false);
    if (s.customerId) {
      setCustomerMode("selected");
      void getCustomerById(s.customerId).then((found) => {
        setCustomer(found ?? null);
        setCustomerMode(found ? "selected" : s.guestName ? "guest" : "search");
      });
    } else {
      setCustomer(null);
      setCustomerMode(s.guestName ? "guest" : "search");
    }
  };

  /** 방문 약속 시간 순 매물 인덱스 */
  const navOrder = useMemo(() => {
    const list = schedule?.properties ?? [];
    return list
      .map((p, i) => ({
        i,
        t: p.arriveTime?.trim() || "99:99",
      }))
      .sort((a, b) => a.t.localeCompare(b.t))
      .map((x) => x.i);
  }, [schedule?.properties]);

  useEffect(() => {
    if (!validationFocus) return;
    const el =
      validationFocus.target === "customer"
        ? customerPickRef.current
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

  if (!schedule) {
    return (
      <main className="py-20 text-center text-gray-500">불러오는 중...</main>
    );
  }

  const myId = peekCurrentUser()?.id ?? agent?.id;
  const isForeign = isForeignTeamItem(schedule.createdBy, myId);

  const handleDelete = () => {
    if (!window.confirm("이 방문 일정을 삭제할까요?")) return;
    if (isForeign && !confirmForeignTeamDelete("네비")) {
      return;
    }
    setDeleting(true);
    const back =
      fromNavi
        ? "/navi"
        : customer
          ? `/customers/${customer.id}`
          : "/schedules/new";
    void deleteSchedule(schedule.id)
      .then(() => router.replace(back))
      .catch((err: unknown) => {
        alert(err instanceof Error ? err.message : "삭제에 실패했습니다.");
        setDeleting(false);
      });
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (customerMode === "guest") {
      if (!guestName.trim()) {
        showWarn({
          target: "guestName",
          message: "성함 칸 입력은 필수입니다.",
        });
        return;
      }
    } else if (!customer) {
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
    const next: Schedule = {
      ...schedule,
      customerId: customerMode === "selected" ? customer?.id : undefined,
      guestName: customerMode === "guest" ? guestName.trim() : undefined,
      visitDate,
      visitTime,
      properties,
      routeSummary: buildRouteSummary(properties),
      updatedAt: new Date().toISOString(),
    };
    await upsertSchedule(next);
    if (customerMode === "selected" && customer) {
      await touchRecentCustomer(customer.id);
    }
    setSchedule(next);
    setEditing(false);
    setSavedOpen(true);
  };

  const handleViewSwap = async (fromIndex: number, toIndex: number) => {
    if (!schedule || fromIndex === toIndex) return;
    const nextProperties = swapPropertySlots(
      schedule.properties,
      fromIndex,
      toIndex
    );
    const next: Schedule = {
      ...schedule,
      properties: nextProperties,
      routeSummary: buildRouteSummary(nextProperties),
      updatedAt: new Date().toISOString(),
    };
    setSchedule(next);
    setProperties(nextProperties);
    try {
      await upsertSchedule(next);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "순서 변경에 실패했습니다.");
    }
  };

  const cancelEditing = () => {
    if (!schedule) return;
    setVisitDate(schedule.visitDate ?? "");
    setVisitTime(schedule.visitTime ?? "");
    setProperties(schedule.properties);
    restoreCustomerFromSchedule(schedule);
    setEditing(false);
  };

  return (
    <main>
      <PageHeader
        title={editing ? "일정 수정" : "방문 일정"}
        titlePlacement="below"
        backHref={
          editing
            ? undefined
            : fromNavi
              ? "/navi"
              : customer
                ? `/customers/${customer.id}`
                : "/schedules/new"
        }
        onBack={editing ? cancelEditing : undefined}
        right={
          <>
            {!editing &&
            (schedule.id.startsWith("demo_sch_") ||
              hasTeammates ||
              schedule.workspaceShared) ? (
              <TeamShareButton
                active={Boolean(schedule.workspaceShared)}
                disabled={
                  workspaceShareBusy ||
                  (!schedule.id.startsWith("demo_sch_") &&
                    !hasTeammates &&
                    !schedule.workspaceShared)
                }
                locked={isForeign}
                onToggle={() => {
                  void (async () => {
                    if (!schedule || workspaceShareBusy || isForeign) return;
                    const isDemo = schedule.id.startsWith("demo_sch_");
                    if (!isDemo && !hasTeammates && !schedule.workspaceShared) {
                      return;
                    }
                    const prevShared = Boolean(schedule.workspaceShared);
                    const nextShared = !prevShared;
                    setSchedule({
                      ...schedule,
                      workspaceShared: nextShared,
                      updatedAt: new Date().toISOString(),
                    });
                    setWorkspaceShareBusy(true);
                    try {
                      const updated = await setScheduleWorkspaceShared(
                        schedule.id,
                        nextShared
                      );
                      if (updated) setSchedule(updated);
                    } catch (err) {
                      setSchedule({
                        ...schedule,
                        workspaceShared: prevShared,
                      });
                      alert(
                        err instanceof Error
                          ? err.message
                          : "팀 공유 변경에 실패했습니다."
                      );
                    } finally {
                      setWorkspaceShareBusy(false);
                    }
                  })();
                }}
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
                  return;
                }
                const myId = peekCurrentUser()?.id ?? agent?.id;
                if (
                  isForeignTeamItem(schedule.createdBy, myId) &&
                  !confirmForeignTeamEdit("네비")
                ) {
                  return;
                }
                setGuestName(schedule.guestName ?? "");
                setCustomerQuery("");
                setCustomerDetailOpen(false);
                setCustomerMode(
                  customer
                    ? "selected"
                    : schedule.guestName
                      ? "guest"
                      : "search"
                );
                setEditing(true);
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
            id="schedule-edit-form"
            noValidate
            onSubmit={handleSave}
            className="space-y-3 pb-2"
          >
            <div ref={customerPickRef}>
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
                {customerMode === "selected" ? (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={resetCustomerPick}
                  >
                    변경하기
                  </Button>
                ) : (
                  <label className="flex items-center gap-2 active:scale-95 transition-all duration-150">
                    <CircleCheck
                      checked={customerMode === "guest"}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setCustomerMode("guest");
                          setCustomer(null);
                          setCustomerQuery("");
                        } else {
                          resetCustomerPick();
                        }
                      }}
                    />
                    <span className="text-[14px] font-semibold text-gray-700">
                      고객없음
                    </span>
                  </label>
                )}
              </div>
              {customerMode === "guest" ? (
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
              ) : customerMode !== "selected" ? (
                <>
                  <CustomerSearchInput
                    value={customerQuery}
                    onChange={setCustomerQuery}
                  />
                  {customerQuery.trim() && filteredCustomers.length === 0 ? (
                    <p className="py-1 text-sm text-gray-500">
                      검색 결과가 없습니다. 고객없음을 체크하면 성함만 입력할 수
                      있어요.
                    </p>
                  ) : null}
                </>
              ) : null}
            </Card>
            </div>

            {customerMode === "selected" && customer ? (
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
                <CustomerListCard customer={customer} />
              </div>
            ) : null}

            {customerMode === "search" && filteredCustomers.length > 0 ? (
              <div className="space-y-2 overflow-visible pr-2">
                {filteredCustomers.map((c) => (
                  <div
                    key={c.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => applyCustomer(c)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        applyCustomer(c);
                      }
                    }}
                    className="cursor-pointer active:scale-[0.99] transition-all duration-150"
                  >
                    <CustomerListCard customer={c} />
                  </div>
                ))}
              </div>
            ) : null}

            <Card className="space-y-2">
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
            </Card>
            <div className="space-y-4">
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
                    onChange={(next) =>
                      setProperties((prev) => {
                        const prevItem = prev[index];
                        const replaced = prev.map((p, i) =>
                          i === index ? next : p
                        );
                        const cascaded = cascadeArriveTimes(
                          replaced,
                          index,
                          prevItem?.arriveTime ?? "",
                          next.arriveTime ?? ""
                        );
                        if (
                          (prevItem?.arriveTime ?? "") !==
                          (next.arriveTime ?? "")
                        ) {
                          return sortPropertiesByArriveTime(cascaded);
                        }
                        return cascaded;
                      })
                    }
                    enableLoad
                    canRemove={properties.length > 1}
                    onRemove={() =>
                      setProperties((prev) =>
                        prev.filter((_, i) => i !== index)
                      )
                    }
                    propertyCount={properties.length}
                    allProperties={properties}
                    onSwapWith={(target) =>
                      setProperties((prev) =>
                        swapPropertySlots(prev, index, target)
                      )
                    }
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
                  if (prev.length >= MAX_SCHEDULE_PROPERTIES) return prev;
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
              disabled={properties.length >= MAX_SCHEDULE_PROPERTIES}
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
        <div className="space-y-2.5">
          <div className="relative pt-2">
            <div className="absolute inset-x-4 top-2 z-10 -translate-y-1/2">
              <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-[#3182F6] px-3 py-1 text-[12px] font-extrabold text-white shadow-[0_4px_12px_rgba(49,130,246,0.3)] ring-2 ring-[#F9FAFB]">
                <span className="shrink-0 text-white/80">방문 시간</span>
                <span className="truncate tracking-tight">
                  {formatVisitDateTime(schedule.visitDate, schedule.visitTime)}
                </span>
              </span>
            </div>
            <Card className="!overflow-visible space-y-2 !px-3 !pb-3 !pt-4">
              {customer ? (
                <>
                  <ListEdgeChips
                    placement="inline"
                    roomType={customer.roomType}
                    buildingKind={customer.buildingKind}
                    dealType={customer.dealType}
                    moneyLabel={getCustomerBudgetLabel(customer)}
                    depositMan={Math.max(
                      customer.deposit ?? 0,
                      customer.depositTo ?? 0
                    )}
                  />
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[20px] font-extrabold tracking-tight text-gray-900">
                        {customer.name}
                      </p>
                      {customer.nonOccupancy ? (
                        <p className="mt-1 text-[12px] font-semibold text-gray-500">
                          비입주
                        </p>
                      ) : null}
                    </div>
                    <PhoneLink
                      phone={customer.phone}
                      className="!shrink-0 !rounded-xl !bg-[#E8F8F1] !px-2.5 !py-1.5 !text-[14px] !font-extrabold !text-[#03B26C]"
                    />
                  </div>
                  {(customer.preferredDongs?.length ?? 0) > 0 ||
                  (customer.roomType === "토지" &&
                    customer.landCategory?.trim()) ? (
                    <div className="space-y-1.5 rounded-xl bg-[#F9FAFB] px-2.5 py-2">
                      <CustomerPreferredLocationBlock customer={customer} />
                      {customer.roomType === "토지" &&
                      customer.landCategory?.trim() ? (
                        <CustomerMeta
                          label="지목"
                          value={customer.landCategory.trim()}
                        />
                      ) : null}
                    </div>
                  ) : null}
                  <div className="rounded-xl bg-[#F9FAFB]">
                    <button
                      type="button"
                      onClick={() => setCustomerDetailOpen((v) => !v)}
                      className="flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left active:scale-[0.99] transition-all duration-150"
                      aria-expanded={customerDetailOpen}
                    >
                      <span className="text-[13px] font-bold text-gray-600">
                        입주희망·대출·보증보험·주차 등
                      </span>
                      <span className="text-[12px] font-bold text-[#3182F6]">
                        {customerDetailOpen
                          ? "상세정보 접기"
                          : "상세정보 펼치기"}
                      </span>
                    </button>
                    {customerDetailOpen ? (
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-gray-100 px-2.5 py-2">
                        <CustomerMeta
                          label="입주희망"
                          value={getCustomerMoveInLabel(customer)}
                        />
                        {!(
                          customer.roomType === "상가" ||
                          customer.roomType === "사무실" ||
                          customer.roomType === "토지" ||
                          customer.roomType === "건물"
                        ) ? (
                          <>
                            <CustomerMeta
                              label="대출"
                              value={getCustomerLoanLabel(customer)}
                            />
                            <CustomerMeta
                              label="보증보험"
                              value={yesNoLabel(customer.insuranceNeeded)}
                            />
                          </>
                        ) : null}
                        {customer.roomType !== "토지" &&
                        customer.roomType !== "건물" ? (
                          <CustomerMeta
                            label="주차"
                            value={getCustomerParkingLabel(customer)}
                          />
                        ) : null}
                        {customer.roomType !== "토지" ? (
                          <CustomerMeta
                            label="엘리베이터"
                            value={yesNoLabel(customer.elevatorNeeded)}
                          />
                        ) : null}
                        {customer.notes?.trim() ? (
                          <div className="col-span-2 min-w-0">
                            <p className="text-[11px] font-semibold leading-none text-gray-400">
                              메모
                            </p>
                            <p className="mt-1 line-clamp-3 text-[13px] font-medium leading-snug text-gray-800">
                              {customer.notes}
                            </p>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
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
            </Card>
          </div>

          {schedule.properties.map((property, index) => (
            <div
              key={property.id}
              ref={(el) => {
                propertyRefs.current[index] = el;
              }}
              className="space-y-2 scroll-mt-20"
            >
              <PropertyBrief
                index={index}
                property={property}
                allProperties={schedule.properties}
                onSwapWith={(target) =>
                  void handleViewSwap(index, target)
                }
              />
              {schedule.routeSummary[index] && (
                <RouteSummaryCard summary={schedule.routeSummary[index]} />
              )}
            </div>
          ))}

          <StickyActionBar>
            {(() => {
              const total = schedule.properties.length;
              const isSingle = total === 1;
              const finished = isSingle
                ? singleNavDone
                : total === 0 || navStep >= navOrder.length - 1;
              const label = finished
                ? "오늘도 수고하셨습니다"
                : navStep < 0
                  ? "네비게이션 시작"
                  : isSingle
                    ? "주소로 이동하세요"
                    : "다음 일정 시작하기";

              const goToNavStep = (next: number) => {
                setNavStep(next);
                const targetIndex = navOrder[next];
                propertyRefs.current[targetIndex]?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                });
                openNavAnnounce(next);
              };

              return (
                <Button
                  fullWidth
                  size="lg"
                  disabled={finished}
                  className={
                    finished
                      ? "!bg-gray-300 !text-gray-600 hover:!bg-gray-300"
                      : ""
                  }
                  onClick={() => {
                    if (finished || total === 0) return;

                    if (isSingle) {
                      // 최초 시작 시각 기록 → 약 30분 후 완료 문구
                      if (!singleNavDone && navStep < 0) {
                        const startedAt = Date.now();
                        try {
                          localStorage.setItem(
                            singleNavStartedKey(schedule.id),
                            String(startedAt)
                          );
                        } catch {
                          /* ignore */
                        }
                        if (singleNavDoneTimer.current) {
                          clearTimeout(singleNavDoneTimer.current);
                        }
                        singleNavDoneTimer.current = setTimeout(() => {
                          setSingleNavDone(true);
                          singleNavDoneTimer.current = null;
                        }, SINGLE_NAV_DONE_MS);
                      }
                      goToNavStep(0);
                      return;
                    }

                    const next = navStep + 1;
                    if (next >= navOrder.length) return;
                    goToNavStep(next);
                  }}
                >
                  {label}
                </Button>
              );
            })()}
          </StickyActionBar>
        </div>
      )}

      <Modal
        open={navModalOpen && navAnnounceStep != null}
        onClose={closeNavModal}
        position="center"
        dense
        className="!bg-[#E8F3FF] ring-1 ring-inset ring-[#3182F6]/25"
      >
        <div className="flex flex-col items-center gap-3 py-1 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#3182F6] text-[16px] text-white">
            ▶
          </span>
          <p className="text-[20px] font-extrabold tracking-tight text-[#1B64DA]">
            {navAnnounceStep != null
              ? `${navAnnounceStep + 1}번 매물입니다.`
              : "매물 안내"}
          </p>
          <p className="text-[12px] font-medium text-[#3182F6]/75">
            원터치 네비게이션으로 이동하세요
          </p>
          <button
            type="button"
            onClick={closeNavModal}
            className="mt-1 w-full rounded-xl bg-white px-4 py-3 text-[15px] font-bold text-[#1B64DA] shadow-sm ring-1 ring-inset ring-[#3182F6]/20"
          >
            닫기
          </button>
        </div>
      </Modal>

      <Modal
        open={editing && customerDetailOpen && Boolean(customer)}
        onClose={() => setCustomerDetailOpen(false)}
        title="고객 정보"
        description="조회만 가능합니다"
        showClose
        className="max-h-[min(85vh,640px)] overflow-y-auto"
      >
        {customer ? <CustomerBrief customer={customer} /> : null}
        <Button
          fullWidth
          variant="secondary"
          className="mt-4"
          onClick={() => setCustomerDetailOpen(false)}
        >
          닫기
        </Button>
      </Modal>

      <RequiredFieldWarnModal
        open={warnOpen}
        message={validationFocus?.message}
        onClose={() => setWarnOpen(false)}
      />

      <SharePropertyModal
        open={shareOpen}
        properties={shareProperties}
        agent={agent}
        onClose={() => setShareOpen(false)}
      />
      <SaveCompleteModal
        open={savedOpen}
        onClose={() => setSavedOpen(false)}
      />
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
