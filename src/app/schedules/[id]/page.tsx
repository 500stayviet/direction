"use client";

import { FormEvent, Suspense, useEffect, useMemo, useRef, useState } from "react";
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
import { ListEdgeChips } from "@/components/ListEdgeChips";
import { Modal } from "@/components/ui/Modal";
import { SharePropertyModal } from "@/components/SharePropertyModal";
import { createEmptyProperty } from "@/lib/constants";
import { addMinutesToHHmm, cascadeArriveTimes, sortPropertiesByArriveTime, swapPropertySlots } from "@/lib/arriveTime";
import { getCurrentUser } from "@/lib/auth";
import { buildRouteSummary, findSmarterRouteHint } from "@/lib/distance";
import {
  deleteSchedule,
  getCustomerById,
  getScheduleById,
  setScheduleWorkspaceShared,
  upsertSchedule,
} from "@/lib/storage";
import { fetchWorkspaceStatus } from "@/lib/workspace";
import {
  formatVisitDateTime,
  getCustomerBudgetLabel,
  getCustomerLoanLabel,
  getCustomerMoveInLabel,
  getCustomerParkingLabel,
} from "@/lib/format";
import {
  findPropertiesValidationIssue,
  type PropertyFieldKey,
} from "@/lib/propertyValidation";
import type { Customer, Property, Schedule, User } from "@/lib/types";

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
  const [deleting, setDeleting] = useState(false);
  const [visitDate, setVisitDate] = useState("");
  const [visitTime, setVisitTime] = useState("");
  const [properties, setProperties] = useState<Property[]>([]);
  const [validationFocus, setValidationFocus] = useState<{
    index: number;
    focusField: PropertyFieldKey;
    message: string;
  } | null>(null);
  const [warnOpen, setWarnOpen] = useState(false);
  const [customerDetailOpen, setCustomerDetailOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [hasTeammates, setHasTeammates] = useState(false);
  const [workspaceShareBusy, setWorkspaceShareBusy] = useState(false);
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
      setHasTeammates(Boolean(ws && ws.memberCount > 1));
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

  if (!schedule) {
    return (
      <main className="py-20 text-center text-gray-500">불러오는 중...</main>
    );
  }

  const handleDelete = () => {
    if (!window.confirm("이 방문 일정을 삭제할까요?")) return;
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
          <div className="flex items-center gap-1.5">
            {!editing &&
            (schedule.id.startsWith("demo_sch_") ||
              hasTeammates ||
              schedule.workspaceShared) ? (
              <Button
                disabled={
                  workspaceShareBusy ||
                  (!schedule.id.startsWith("demo_sch_") &&
                    !hasTeammates &&
                    !schedule.workspaceShared)
                }
                onClick={() => {
                  void (async () => {
                    if (!schedule || workspaceShareBusy) return;
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
                className={
                  schedule?.workspaceShared
                    ? "!border-2 !border-violet-500 !bg-white !px-2.5 !text-[13px] !font-bold !text-violet-600 hover:!bg-violet-50"
                    : "!border-2 !border-gray-400 !bg-white !px-2.5 !text-[13px] !font-bold !text-gray-600 hover:!bg-gray-50"
                }
              >
                {schedule?.workspaceShared ? "팀 공유 중" : "팀 공유하기"}
              </Button>
            ) : null}
            {!editing ? (
              <Button
                onClick={() => setShareOpen(true)}
                className="!border-2 !border-sky-400 !bg-white !px-2.5 !text-[13px] !font-bold !text-sky-600 hover:!bg-sky-50"
              >
                공유하기
              </Button>
            ) : null}
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
          <div className="relative pt-3">
            <div className="absolute inset-x-4 top-3 z-10 -translate-y-1/2">
              <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-[#3182F6] px-3 py-1.5 text-[12px] font-extrabold text-white shadow-[0_4px_12px_rgba(49,130,246,0.3)] ring-2 ring-[#F9FAFB]">
                <span className="shrink-0 text-white/80">방문 시간</span>
                <span className="truncate tracking-tight">
                  {formatVisitDateTime(schedule.visitDate, schedule.visitTime)}
                </span>
              </span>
            </div>
            <Card className="!overflow-visible space-y-2.5 pt-5">
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
                  <div className="rounded-xl bg-[#F9FAFB]">
                    <button
                      type="button"
                      onClick={() => setCustomerDetailOpen((v) => !v)}
                      className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left active:scale-[0.99] transition-all duration-150"
                      aria-expanded={customerDetailOpen}
                    >
                      <span className="text-[13px] font-bold text-gray-600">
                        입주·대출·주차 등
                      </span>
                      <span className="text-[12px] font-bold text-[#3182F6]">
                        {customerDetailOpen
                          ? "상세정보 접기"
                          : "상세정보 펼치기"}
                      </span>
                    </button>
                    {customerDetailOpen ? (
                      <div className="grid grid-cols-2 gap-x-3 gap-y-2 border-t border-gray-100 px-3 py-2.5">
                        <CustomerMeta
                          label="입주"
                          value={getCustomerMoveInLabel(customer)}
                        />
                        <CustomerMeta
                          label="대출"
                          value={getCustomerLoanLabel(customer)}
                        />
                        <CustomerMeta
                          label="주차"
                          value={getCustomerParkingLabel(customer)}
                        />
                        <CustomerMeta
                          label="애완동물"
                          value={customer.petAllowed ?? "-"}
                        />
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
              className="space-y-3 scroll-mt-20"
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

      <SharePropertyModal
        open={shareOpen}
        properties={shareProperties}
        agent={agent}
        onClose={() => setShareOpen(false)}
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
