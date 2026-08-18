"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { Property, RoomType } from "@/lib/types";
import {
  INSURANCE_TYPES,
  MAINTENANCE_OPTIONS,
  PROPERTY_OPTIONS,
  EMPTY_UNIT_COUNTS,
  ROOM_TYPES,
  createEmptyProperty,
  isBuildingType,
  isLandType,
  defaultRoomBathCounts,
  needsRoomBathCounts,
  normalizeRoomType,
  skipsResidentialExtras,
} from "@/lib/constants";
import { Input, TextArea } from "@/components/ui/Input";
import { ManAmountInput } from "@/components/ManAmountInput";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { PropertyBrief } from "@/components/PropertyBrief";
import { DealTypeToggle } from "@/components/DealTypeToggle";
import { applyDealTypeToMoney } from "@/lib/dealTypeMoney";
import { LandCategoryPicker } from "@/components/LandCategoryPicker";
import { propertyNotesPlaceholder } from "@/lib/memoPlaceholders";
import { ModalChoice } from "@/components/ModalChoice";
import { OptionToggle } from "@/components/OptionToggle";
import { DatePicker } from "@/components/DatePicker";
import { DateRangePicker } from "@/components/DateRangePicker";
import { TimePicker } from "@/components/TimePicker";
import { PhoneInput } from "@/components/PhoneInput";
import {
  BuildingLandFields,
} from "@/components/BuildingLandFields";
import { SeoulAddressField } from "@/components/SeoulAddressField";
import { CircleCheck } from "@/components/ui/CircleCheck";
import { SchedulePropertySwapModal } from "@/components/SchedulePropertySwapModal";
import { formatMoveInRange, formatPhoneInput, onlyDigits } from "@/lib/format";
import { formatRoomNoHo } from "@/lib/propertyRoomNo";
import {
  applyListedToProperty,
  PropertyLoadPicker,
} from "@/components/PropertyLoadPicker";
import { SiteShareFormField } from "@/components/SiteShareUi";
import { TeamShareFormField } from "@/components/TeamShareFormField";
import {
  getMissingRequiredFields,
  type PropertyFieldKey,
} from "@/lib/propertyValidation";
import { RoomBathCountFields, RoomBathCountGrids } from "@/components/RoomBathCountFields";
import type { IntakeParseResult } from "@/lib/intakeParse";
import {
  recordIntakeSample,
  type IntakeSampleSource,
} from "@/lib/intakeSampleCollect";
import { getAccessToken } from "@/lib/auth";
import { isPlaceholderAddress } from "@/lib/seoulRegions";
import { IntakeSourceBar, type IntakeMethod } from "@/components/IntakeSourceBar";
import { IntakeResetModal } from "@/components/IntakeResetModal";
import { IntakeMessageModal, IntakeTalkModal } from "@/components/intakeLazy";
import { IntakeAiBusyOverlay } from "@/components/IntakeAiBusyOverlay";
import { useHasTeam } from "@/hooks/useHasTeam";
import { invalidLabelClass, requiredStarClass, emptyRequiredClass, invalidHintClass } from "@/lib/uiInvalid";
import { reselectHint, reselectHintClass } from "@/lib/choiceHint";

function ChipToggle({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-lg px-2.5 py-1.5 text-sm font-semibold transition-all duration-150 active:scale-95",
        active
          ? "bg-[#3182F6] text-white"
          : "bg-gray-100 text-gray-600 hover:bg-gray-200",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

const IntakePhotoPicker = dynamic(
  () =>
    import("@/components/IntakePhotoPicker").then((m) => m.IntakePhotoPicker),
  { ssr: false }
);

interface PropertyEditorProps {
  index: number;
  property: Property;
  onChange: (property: Property) => void;
  onRemove?: () => void;
  canRemove?: boolean;
  /** 매물리스트에서 불러오기 */
  enableLoad?: boolean;
  /** false면 "N번 매물" 제목 숨김 (단독 매물 추가용) */
  showTitle?: boolean;
  /** false면 매물 방문 약속 시간 숨김 */
  showArriveTime?: boolean;
  /** 저장 검증 중 — 미입력 필드 빨간 테두리 */
  validationActive?: boolean;
  /** 스크롤 이동할 첫 미입력 필드 */
  focusField?: PropertyFieldKey;
  /** false면 동 필수 제외 (방문 일정). 기본 true */
  requireDong?: boolean;
  /** 전체 매물 수 — 제목 탭으로 순서 변경할 때 사용 */
  propertyCount?: number;
  /** 순서 변경 모달에 보여줄 전체 매물 목록 */
  allProperties?: Property[];
  /** N번 매물 제목으로 다른 슬롯과 맞바꿀 때 */
  onSwapWith?: (targetIndex: number) => void;
  /** false면 팀공유 유무 숨김 (방문 일정 — 일정 단위로 공유) */
  showTeamShare?: boolean;
  /** 메시지·대화·사진으로 칸 채우기 (매물 등록/수정) */
  enableIntake?: boolean;
  /** 매물리스트에서 불러온 직후 — 빠진 필수 칸 빨간 테두리 */
  highlightLoaded?: boolean;
}

export function PropertyEditor({
  index,
  property,
  onChange,
  onRemove,
  canRemove,
  enableLoad = false,
  showTitle = true,
  showArriveTime = true,
  showTeamShare = true,
  enableIntake = false,
  validationActive = false,
  focusField,
  requireDong = true,
  propertyCount,
  allProperties,
  onSwapWith,
  highlightLoaded = false,
}: PropertyEditorProps) {
  const fieldRefs = useRef<Partial<Record<PropertyFieldKey, HTMLDivElement | null>>>(
    {}
  );
  const [moveOpen, setMoveOpen] = useState(false);
  const [filledFromIntake, setFilledFromIntake] = useState(false);
  const showMissing = filledFromIntake || highlightLoaded;
  const [lockHintOpen, setLockHintOpen] = useState(false);
  const lockedListedId = property.listedFromId?.trim() || "";
  const [resetOpen, setResetOpen] = useState(false);
  const [pendingMethod, setPendingMethod] = useState<IntakeMethod | null>(null);
  const [messageOpen, setMessageOpen] = useState(false);
  const [talkOpen, setTalkOpen] = useState(false);
  const [photoRequestId, setPhotoRequestId] = useState(0);
  const [photoError, setPhotoError] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [roomTypeOpen, setRoomTypeOpen] = useState(false);
  const applyingIntakeRef = useRef(false);
  const propertyRef = useRef(property);
  const hasTeam = useHasTeam(showTeamShare);
  useEffect(() => {
    propertyRef.current = property;
  }, [property]);

  const reorderList = allProperties ?? [];
  const canReorder =
    Boolean(onSwapWith) && (propertyCount ?? reorderList.length) > 1;

  const update = (patch: Partial<Property>) => {
    if (lockedListedId) {
      if (!("arriveTime" in patch) || Object.keys(patch).length !== 1) {
        setLockHintOpen(true);
        return;
      }
      onChange({ ...property, arriveTime: patch.arriveTime });
      return;
    }
    const next: Property = { ...property, ...patch };
    if (isBuildingType(next.roomType) || isLandType(next.roomType)) {
      next.dealType = "매매";
    }
    if (property.dealType !== next.dealType) {
      const money = applyDealTypeToMoney(
        property.dealType,
        next.dealType ?? "",
        {
          deposit: next.deposit,
          depositTo: next.deposit,
          monthlyRent: next.monthlyRent ?? 0,
          monthlyRentTo: next.monthlyRent ?? 0,
        }
      );
      next.deposit = money.deposit;
      next.monthlyRent = money.monthlyRent;
    } else if (next.dealType === "전세" || next.dealType === "매매") {
      next.monthlyRent = 0;
    }
    if (next.hasPartnerAgency) {
      next.tenantPhone = "";
      next.landlordPhone = "";
    }
    onChange(next);
  };

  const toggleList = (key: "maintenanceIncludes" | "options", value: string) => {
    const current = property[key] ?? [];
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    update({ [key]: next });
  };

  const missingFields =
    validationActive || showMissing
      ? getMissingRequiredFields(property, { requireDong })
      : [];
  const isInvalid = (key: PropertyFieldKey) => missingFields.includes(key);

  useEffect(() => {
    if (!validationActive || !focusField) return;
    const el = fieldRefs.current[focusField];
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [validationActive, focusField]);

  const setFieldRef = (key: PropertyFieldKey) => (node: HTMLDivElement | null) => {
    fieldRefs.current[key] = node;
  };

  const moveInFrom =
    property.moveInFrom ||
    (property.moveInDate && /^\d{4}-\d{2}-\d{2}$/.test(property.moveInDate)
      ? property.moveInDate
      : "");
  const moveInSingle =
    property.moveInSingle ??
    Boolean(
      property.moveInFrom &&
        property.moveInTo &&
        property.moveInFrom === property.moveInTo
    );

  const isLand = isLandType(property.roomType);
  const isBuilding = isBuildingType(property.roomType);
  const hideResidentialExtras = skipsResidentialExtras(property.roomType);

  const handleRoomTypeChange = (roomType: RoomType) => {
    const patch: Partial<Property> = { roomType };
    if (roomType === "건물") {
      patch.unitCounts = property.unitCounts ?? { ...EMPTY_UNIT_COUNTS };
      patch.rentInputMode = "합계";
      patch.dealType = "매매";
      patch.monthlyRent = 0;
      patch.roomNo = "";
      patch.moveInFrom = "";
      patch.moveInTo = "";
      patch.moveInSingle = false;
      patch.moveInDate = "";
      patch.maintenanceIncludes = [];
    }
    if (skipsResidentialExtras(roomType)) {
      patch.maintenanceIncludes = [];
      patch.options = [];
      patch.petAllowed = "무";
      patch.loanAvailable = undefined;
      patch.insuranceType = undefined;
    }
    if (roomType === "토지") {
      patch.dealType = "매매";
      patch.roomNo = "";
      patch.parkingType = "무";
      patch.parkingFee = undefined;
    } else if (
      roomType !== "건물" &&
      (isBuildingType(property.roomType) || isLandType(property.roomType))
    ) {
      patch.dealType = undefined;
    }
    if (needsRoomBathCounts(roomType)) {
      const defaults = defaultRoomBathCounts(roomType);
      patch.roomCount = defaults.roomCount;
      patch.bathroomCount = defaults.bathroomCount;
    } else {
      patch.roomCount = undefined;
      patch.bathroomCount = undefined;
    }
    update(patch);
  };

  const formHasContent = Boolean(
    showMissing ||
      onlyDigits(property.tenantPhone ?? "").length >= 9 ||
      onlyDigits(property.landlordPhone ?? "").length >= 9 ||
      (property.notes ?? "").trim() ||
      (property.deposit ?? 0) > 0 ||
      (property.roomNo ?? "").trim() ||
      !isPlaceholderAddress(property.address ?? "")
  );

  const startIntake = (method: IntakeMethod) => {
    setPhotoError("");
    if (method === "message") setMessageOpen(true);
    if (method === "talk") setTalkOpen(true);
    if (method === "photo") setPhotoRequestId((n) => n + 1);
  };

  const requestIntake = (method: IntakeMethod) => {
    if (formHasContent) {
      setPendingMethod(method);
      setResetOpen(true);
      return;
    }
    startIntake(method);
  };

  const resetPropertyDraft = () => {
    const empty = createEmptyProperty();
    onChange({
      ...empty,
      id: property.id,
    });
    setFilledFromIntake(false);
    setPhotoError("");
  };

  const applyIntakeParsed = async (parsed: IntakeParseResult) => {
    const { applyIntakeToProperty } = await import("@/lib/intakeParse");
    const next = applyIntakeToProperty(propertyRef.current, parsed);
    if (!hasTeam) next.workspaceShared = false;
    onChange(next);
    setFilledFromIntake(true);
    setMessageOpen(false);
    setTalkOpen(false);
  };

  const applyIntakeText = async (raw: string, source: IntakeSampleSource) => {
    if (applyingIntakeRef.current) return;
    applyingIntakeRef.current = true;
    setAiBusy(true);
    if (source !== "message") setMessageOpen(false);
    const started = Date.now();
    try {
      const accessToken = await getAccessToken();
      const { INTAKE_AI_MIN_WAIT_MS, resolveIntakeWithAi } = await import(
        "@/lib/intakeAiClient"
      );
      const parsed = await resolveIntakeWithAi({
        raw,
        kind: "property",
        source,
        accessToken,
      });
      const wait = Math.max(0, INTAKE_AI_MIN_WAIT_MS - (Date.now() - started));
      if (wait) await new Promise((resolve) => window.setTimeout(resolve, wait));
      void recordIntakeSample({
        raw,
        kind: "property",
        source,
        parsed,
        accessToken,
      });
      await applyIntakeParsed(parsed);
    } finally {
      setAiBusy(false);
      applyingIntakeRef.current = false;
    }
  };

  const teamShareFields = showTeamShare ? (
    <>
      <TeamShareFormField
        value={property.workspaceShared}
        onChange={(next) => update({ workspaceShared: next })}
        hasTeam={hasTeam}
      />
      <SiteShareFormField value={false} onChange={() => {}} />
    </>
  ) : null;

  if (lockedListedId) {
    return (
      <>
        <Card className="space-y-2.5 !border-2 !border-slate-300 !bg-slate-50 !p-3">
          {(showTitle || (canRemove && onRemove)) && (
            <div className="relative z-10 flex items-center justify-between gap-2">
              {showTitle ? (
                canReorder ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setMoveOpen(true);
                    }}
                    className="group relative z-10 flex min-h-[40px] items-center gap-1.5 rounded-xl px-1 py-0.5 text-left active:scale-[0.98] transition-transform"
                  >
                    <span className="text-lg font-bold text-gray-900 underline decoration-gray-300 underline-offset-4 group-hover:decoration-[#3182F6]">
                      {index + 1}번 매물
                    </span>
                    <span className="rounded-md bg-blue-50 px-1.5 py-0.5 text-[11px] font-bold text-[#3182F6]">
                      순서 변경
                    </span>
                  </button>
                ) : (
                  <h3 className="text-lg font-bold text-gray-900">
                    {index + 1}번 매물
                  </h3>
                )
              ) : (
                <span />
              )}
              {canRemove && onRemove ? (
                <Button type="button" variant="danger" onClick={onRemove}>
                  매물 삭제
                </Button>
              ) : null}
            </div>
          )}

          {canReorder ? (
            <SchedulePropertySwapModal
              open={moveOpen}
              onClose={() => setMoveOpen(false)}
              properties={reorderList.length > 0 ? reorderList : [property]}
              fromIndex={index}
              onSelect={(target) => onSwapWith?.(target)}
            />
          ) : null}

          {showArriveTime ? (
            <TimePicker
              label="방문 약속 시간"
              value={property.arriveTime ?? ""}
              onChange={(arriveTime) => update({ arriveTime })}
              timeFormat="hhmm"
            />
          ) : null}

          <button
            type="button"
            onClick={() => setLockHintOpen(true)}
            className="flex w-full items-start gap-2 rounded-xl border border-slate-300 bg-slate-200/70 px-3 py-2.5 text-left active:scale-[0.99] transition-transform"
          >
            <span
              className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-500 text-white"
              aria-hidden
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor">
                <path d="M17 9h-1V7a4 4 0 1 0-8 0v2H7a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2Zm-7-2a2 2 0 1 1 4 0v2h-4V7Zm7 12H7v-8h10v8Z" />
              </svg>
            </span>
            <span className="min-w-0">
              <span className="block text-[14px] font-extrabold text-slate-800">
                불러온 매물 · 수정할 수 없음
              </span>
              <span className="mt-0.5 block text-[12px] font-medium leading-snug text-slate-600">
                이 화면에서는 고칠 수 없습니다. 바꾸려면 매물 페이지에서 수정해
                주세요.
              </span>
            </span>
          </button>

          <div className="opacity-90">
            <PropertyBrief
              index={index}
              property={property}
              showTitle={false}
              showArriveTime={false}
              embedded
              omitEmpty
            />
          </div>
        </Card>

        <Modal
          open={lockHintOpen}
          onClose={() => setLockHintOpen(false)}
          position="center"
          dense
          title="수정할 수 없습니다"
          description="불러온 매물은 이 화면에서 고칠 수 없습니다. 내용을 바꾸려면 매물 페이지에서 수정해 주세요."
        >
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setLockHintOpen(false)}
            >
              닫기
            </Button>
            <Link href={`/properties/${lockedListedId}`} className="block">
              <Button type="button" fullWidth>
                매물 페이지로
              </Button>
            </Link>
          </div>
        </Modal>
      </>
    );
  }

  return (
    <>
    <IntakeAiBusyOverlay open={aiBusy} />
    {enableIntake ? (
      <div className="mb-3 space-y-1">
        <IntakeSourceBar onSelect={requestIntake} />
        {photoError ? (
          <p className="text-[12px] font-semibold text-red-400">{photoError}</p>
        ) : null}
        {photoRequestId > 0 ? (
          <IntakePhotoPicker
            requestId={photoRequestId}
            onBusyChange={setAiBusy}
            onText={(text) => applyIntakeText(text, "photo")}
            onError={setPhotoError}
          />
        ) : null}
      </div>
    ) : null}
    <Card
      className={[
        "space-y-2 !p-3",
        showTitle
          ? "border-2 border-gray-200 shadow-md"
          : "",
      ].join(" ")}
    >
      {enableLoad && (
        <PropertyLoadPicker
          onSelect={(listed) => {
            setFilledFromIntake(true);
            onChange(
              applyListedToProperty(
                property.id,
                listed,
                property.arriveTime ?? ""
              )
            );
          }}
        />
      )}

      {(showTitle || (canRemove && onRemove)) && (
        <div className="relative z-10 flex items-center justify-between gap-2">
          {showTitle ? (
            canReorder ? (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setMoveOpen(true);
                }}
                className="group relative z-10 flex min-h-[40px] items-center gap-1.5 rounded-xl px-1 py-0.5 text-left active:scale-[0.98] transition-transform"
              >
                <span className="text-lg font-bold text-gray-900 underline decoration-gray-300 underline-offset-4 group-hover:decoration-[#3182F6]">
                  {index + 1}번 매물
                </span>
                <span className="rounded-md bg-blue-50 px-1.5 py-0.5 text-[11px] font-bold text-[#3182F6]">
                  순서 변경
                </span>
              </button>
            ) : (
              <h3 className="text-lg font-bold text-gray-900">
                {index + 1}번 매물
              </h3>
            )
          ) : (
            <span />
          )}
          {canRemove && onRemove && (
            <Button type="button" variant="danger" onClick={onRemove}>
              매물 삭제
            </Button>
          )}
        </div>
      )}

      {canReorder ? (
        <SchedulePropertySwapModal
          open={moveOpen}
          onClose={() => setMoveOpen(false)}
          properties={reorderList.length > 0 ? reorderList : [property]}
          fromIndex={index}
          onSelect={(target) => onSwapWith?.(target)}
        />
      ) : null}

      {showArriveTime && (
        <TimePicker
          label="방문 약속 시간"
          value={property.arriveTime ?? ""}
          onChange={(arriveTime) => update({ arriveTime })}
          timeFormat="hhmm"
          placeholder="00:00"
        />
      )}

      <div className="space-y-1.5">
          <div
            ref={setFieldRef("contacts")}
            className={[
              emptyRequiredClass({
                invalid: isInvalid("contacts"),
                filled:
                  Boolean(
                    (property.tenantPhone ?? "").trim() ||
                      (property.landlordPhone ?? "").trim()
                  ) && !isInvalid("contacts"),
              }),
            ].join(" ")}
          >
            <div className="flex items-baseline justify-between gap-2">
              <p
                className={[
                  "flex min-w-0 flex-1 items-baseline gap-1 text-[13px] font-semibold",
                  isInvalid("contacts") ? invalidLabelClass : "text-gray-600",
                ].join(" ")}
              >
                <span className="shrink-0">
                  연락처
                  <span className={requiredStarClass}>*</span>
                </span>
              </p>
              <p className="shrink-0 text-right text-[11px] font-medium leading-snug text-sky-400">
                원터치 전화에 사용됩니다.
              </p>
            </div>
            {isInvalid("contacts") ? (
              <p className={`text-xs ${invalidHintClass}`}>미입력</p>
            ) : null}
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              <PhoneInput
                label="임차인 번호"
                value={formatPhoneInput(property.tenantPhone ?? "")}
                onChange={(tenantPhone) => update({ tenantPhone })}
                placeholder="예) 010-1234-5678"
                hint=""
              />
              <PhoneInput
                label="임대인 번호"
                value={formatPhoneInput(property.landlordPhone ?? "")}
                onChange={(landlordPhone) => update({ landlordPhone })}
                placeholder="예) 010-9876-5432"
                hint=""
              />
            </div>
          </div>
      </div>

      <div className="mt-2 space-y-1.5 border-t border-gray-200 pt-3">
        <div
          ref={setFieldRef("roomType")}
          className={emptyRequiredClass({
            invalid: isInvalid("roomType"),
            filled: Boolean(property.roomType) && !isInvalid("roomType"),
          })}
        >
        <div className="flex items-baseline justify-between gap-2">
          <p
            className={[
              "shrink-0 text-sm font-bold",
              isInvalid("roomType") ? invalidLabelClass : "text-gray-800",
            ].join(" ")}
          >
            매물유형
            <span className={requiredStarClass}>
              *
            </span>
          </p>
          {property.roomType ? (
            <p className={reselectHintClass}>
              {reselectHint(
                "매물유형",
                normalizeRoomType(property.roomType) ?? property.roomType
              )}
            </p>
          ) : null}
        </div>
        {isInvalid("roomType") ? (
          <p className={`text-xs ${invalidHintClass}`}>미입력</p>
        ) : null}
        <ModalChoice
          label="매물 유형"
          hideLabel
          invalid={isInvalid("roomType")}
          value={
            normalizeRoomType(property.roomType) ?? property.roomType
          }
          options={ROOM_TYPES}
          onChange={handleRoomTypeChange}
          columns={4}
          keepOpen={(type) => needsRoomBathCounts(type)}
          open={roomTypeOpen}
          onOpenChange={setRoomTypeOpen}
          extra={
            <RoomBathCountGrids
              roomType={
                normalizeRoomType(property.roomType) ?? property.roomType
              }
              roomCount={property.roomCount}
              bathroomCount={property.bathroomCount}
              invalidRoomCount={isInvalid("roomCount")}
              onChange={({ roomCount, bathroomCount }) =>
                update({ roomCount, bathroomCount })
              }
            />
          }
        />
        </div>
      <div ref={setFieldRef("roomCount")}>
        <RoomBathCountFields
          roomType={
            normalizeRoomType(property.roomType) ?? property.roomType
          }
          roomCount={property.roomCount}
          bathroomCount={property.bathroomCount}
          invalidRoomCount={isInvalid("roomCount")}
          onEdit={() => setRoomTypeOpen(true)}
          onChange={({ roomCount, bathroomCount }) =>
            update({ roomCount, bathroomCount })
          }
        />
      </div>
      </div>

      <div className="mt-2 space-y-1.5 border-t border-gray-200 pt-3">
        <p className="text-sm font-bold text-gray-800">금액 & 조건</p>
        <div className="border-b border-gray-200 pb-3">
        <div ref={setFieldRef("dealType")}>
          <DealTypeToggle
            label="거래종류"
            required
            invalid={isInvalid("dealType")}
            value={
              isBuilding || isLand ? "매매" : property.dealType ?? ""
            }
            onChange={(dealType) =>
              update({ dealType: dealType || undefined })
            }
            types={
              isBuilding || isLand ? (["매매"] as const) : undefined
            }
          />
        </div>
        </div>
        {isLand ? (
          <LandCategoryPicker
            value={property.landCategory ?? ""}
            onChange={(landCategory) => update({ landCategory })}
          />
        ) : null}
        <div
          className={
            property.dealType === "월세" && !isBuilding && !isLand
              ? "grid grid-cols-2 gap-2"
              : undefined
          }
        >
          <div ref={setFieldRef("deposit")}>
            <ManAmountInput
              label={
                property.dealType === "매매" || isBuilding || isLand
                  ? "매매가"
                  : "보증금"
              }
              invalid={isInvalid("deposit")}
              value={property.deposit || 0}
              onChange={(deposit) => update({ deposit })}
              placeholder="예) 1억 → 10000"
              required
            />
          </div>
          {property.dealType === "월세" && !isBuilding && !isLand && (
            <div>
            <Input
              label="월세"
              type="number"
              value={property.monthlyRent || ""}
              suffix="만원"
              onChange={(e) =>
                update({ monthlyRent: Number(e.target.value) || 0 })
              }
              placeholder="예) 50"
            />
            </div>
          )}
        </div>
        {!isLand && (
          <div className="grid grid-cols-2 gap-2">
            <Input
              label="관리비"
              type="number"
              inputMode="numeric"
              value={property.maintenanceFee ?? ""}
              suffix="만원"
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === "") {
                  update({
                    maintenanceFee: undefined,
                    maintenanceIncludes: [],
                  });
                  return;
                }
                const n = Number(raw);
                if (!Number.isFinite(n) || n < 0) return;
                update({
                  maintenanceFee: n,
                  ...(n > 0 ? {} : { maintenanceIncludes: [] }),
                });
              }}
              placeholder="예) 10"
            />
          </div>
        )}
        {!isLand &&
          !isBuilding &&
          !hideResidentialExtras &&
          (property.maintenanceFee ?? 0) > 0 && (
          <div>
            <p className="mb-1.5 text-[13px] font-semibold text-gray-600">
              관리비 포함 항목
            </p>
            <div className="flex flex-wrap gap-1.5">
              {MAINTENANCE_OPTIONS.map((opt) => (
                <ChipToggle
                  key={opt}
                  label={opt}
                  active={property.maintenanceIncludes.includes(opt)}
                  onClick={() => toggleList("maintenanceIncludes", opt)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-2 space-y-1.5 border-t border-gray-200 pt-3">
        <p className="text-sm font-bold text-gray-800">위치 / 현장</p>
        <div ref={setFieldRef("address")}>
          <SeoulAddressField
            required
            requireDong={requireDong}
            invalid={isInvalid("address")}
            value={property.address}
            onChange={(address) => update({ address })}
          />
        </div>
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-[12px] font-semibold leading-snug text-amber-800">
          구·동·지번이 정확하지 않으면 원터치네비 기능이 정상지원 되지
          않습니다.
        </p>
        {!isLand && !isBuilding && (
          <>
          <Input
            label="나머지주소 (건물명 동 호실)"
            value={property.roomNo}
            onChange={(e) => update({ roomNo: e.target.value })}
            onBlur={(e) => {
              const next = formatRoomNoHo(e.target.value);
              if (next !== property.roomNo) update({ roomNo: next });
            }}
            placeholder="힐스테이트 101동 101호"
          />
          <div
            ref={setFieldRef("moveIn")}
            className="border-t border-gray-200 pt-3"
          >
          <div
            className={emptyRequiredClass({
              invalid: isInvalid("moveIn"),
              filled: Boolean(moveInFrom) && !isInvalid("moveIn"),
            })}
          >
            <div className="flex items-center justify-between gap-2">
              <p
                className={[
                  "text-[13px] font-semibold",
                  isInvalid("moveIn") ? invalidLabelClass : "text-gray-600",
                ].join(" ")}
              >
                임대희망일
                <span className={requiredStarClass}>*</span>
              </p>
              <label className="flex items-center gap-2 active:scale-95 transition-all duration-150">
                <CircleCheck
                  checked={moveInSingle}
                  onChange={(e) => {
                    const on = e.target.checked;
                    const to = on ? moveInFrom : "";
                    update({
                      moveInSingle: on,
                      moveInFrom,
                      moveInTo: to,
                      moveInDate: formatMoveInRange(moveInFrom, to || undefined),
                    });
                  }}
                />
                <span className="text-[14px] font-semibold text-gray-700">
                  단일
                </span>
              </label>
            </div>
            {isInvalid("moveIn") ? (
              <p className={`text-xs ${invalidHintClass}`}>미입력</p>
            ) : null}
            {moveInSingle ? (
              <DatePicker
                label=""
                required
                invalid={isInvalid("moveIn")}
                value={moveInFrom}
                onChange={(next) =>
                  update({
                    moveInSingle: true,
                    moveInFrom: next,
                    moveInTo: next,
                    moveInDate: next ? formatMoveInRange(next, next) : "",
                  })
                }
                placeholder="임대희망일 선택"
              />
            ) : (
              <DateRangePicker
                label=""
                required
                invalid={isInvalid("moveIn")}
                from={moveInFrom}
                to={property.moveInTo || ""}
                onChange={({ from, to }) => {
                  const single = Boolean(from && (!to || from === to));
                  const end = single ? from : to;
                  update({
                    moveInSingle: single,
                    moveInFrom: from,
                    moveInTo: end,
                    moveInDate: formatMoveInRange(from, end || undefined),
                  });
                }}
              />
            )}
          </div>
          </div>
          </>
        )}
      </div>

      {isBuilding && (
        <div
          ref={setFieldRef("buildingKind")}
          className="mt-2 space-y-1.5 border-t border-gray-200 pt-3"
        >
          <BuildingLandFields
            property={property}
            onChange={update}
          />
          <div className="mt-3 space-y-1.5">
            <div ref={setFieldRef("elevator")}>
            <OptionToggle
              label="엘리베이터"
              required
              invalid={isInvalid("elevator")}
              columns={2}
              value={
                property.elevator === true
                  ? "유"
                  : property.elevator === false
                    ? "무"
                    : undefined
              }
              options={["유", "무"] as const}
              onChange={(v) =>
                update({ elevator: v === "" ? undefined : v === "유" })
              }
            />
            </div>
            <div>
              <TextArea
                label="메모"
                value={property.notes ?? ""}
                onChange={(e) => update({ notes: e.target.value })}
                placeholder={propertyNotesPlaceholder(property.roomType)}
              />
            </div>
            {teamShareFields}
          </div>
        </div>
      )}

      {isLand && (
        <div className="mt-2 space-y-1.5 border-t border-gray-200 pt-3">
          <BuildingLandFields
            property={property}
            onChange={update}
          />
          <div className="mt-3 space-y-1.5">
            <div>
              <TextArea
                label="메모"
                value={property.notes ?? ""}
                onChange={(e) => update({ notes: e.target.value })}
                placeholder={propertyNotesPlaceholder(property.roomType)}
              />
            </div>
            {teamShareFields}
          </div>
        </div>
      )}

      {!isLand && !isBuilding && (
        <div className="mt-2 space-y-1.5 border-t border-gray-200 pt-3">
          <p className="text-sm font-bold text-gray-800">기타</p>
          {!hideResidentialExtras && (
            <div>
              <p className="mb-1.5 text-[13px] font-semibold text-gray-600">
                옵션
              </p>
              <div className="flex flex-wrap gap-1.5">
                {PROPERTY_OPTIONS.map((opt) => (
                  <ChipToggle
                    key={opt}
                    label={opt}
                  active={property.options.includes(opt)}
                  onClick={() => toggleList("options", opt)}
                  />
                ))}
              </div>
            </div>
          )}
          {!hideResidentialExtras && (
            <div ref={setFieldRef("loan")}>
              <OptionToggle
                label="대출"
                required
                invalid={isInvalid("loan")}
                columns={2}
                value={
                  property.loanAvailable === "유"
                    ? "유"
                    : property.loanAvailable === "무"
                      ? "무"
                      : undefined
                }
                options={["유", "무"] as const}
                onChange={(loanAvailable) =>
                  update({ loanAvailable: loanAvailable || undefined })
                }
              />
            </div>
          )}
          {!hideResidentialExtras && (
            <div ref={setFieldRef("insurance")}>
              <OptionToggle
                label="전세보증보험 가입 가능 여부"
                required
                invalid={isInvalid("insurance")}
                columns={2}
                value={
                  property.insuranceType === "유"
                    ? "유"
                    : property.insuranceType === "무"
                      ? "무"
                      : undefined
                }
                options={INSURANCE_TYPES}
                onChange={(insuranceType) =>
                  update({ insuranceType: insuranceType || undefined })
                }
              />
            </div>
          )}
          <div ref={setFieldRef("parking")}>
            <OptionToggle
              label="주차"
              required
              invalid={isInvalid("parking")}
              columns={2}
              value={
                property.parkingType === "유"
                  ? "유"
                  : property.parkingType === "무"
                    ? "무"
                    : undefined
              }
              options={["유", "무"] as const}
              onChange={(parkingType) => {
                if (!parkingType) {
                  update({ parkingType: undefined, parkingFee: undefined });
                  return;
                }
                update({
                  parkingType,
                  parkingFeeType: "별도",
                  parkingFee:
                    parkingType === "유" ? (property.parkingFee ?? 0) : undefined,
                });
              }}
            />
          </div>
          {property.parkingType === "유" && (
            <Input
              label="주차비"
              type="number"
              inputMode="numeric"
              value={property.parkingFee || ""}
              suffix="만원"
              onChange={(e) => {
                const raw = e.target.value;
                update({
                  parkingFeeType: "별도",
                  parkingFee: raw === "" ? 0 : Number(raw) || 0,
                });
              }}
              placeholder="예) 10"
            />
          )}
          <div ref={setFieldRef("elevator")}>
          <OptionToggle
            label="엘리베이터"
            required
            invalid={isInvalid("elevator")}
            columns={2}
            value={
              property.elevator === true
                ? "유"
                : property.elevator === false
                  ? "무"
                  : undefined
            }
            options={["유", "무"] as const}
            onChange={(v) =>
              update({ elevator: v === "" ? undefined : v === "유" })
            }
          />
          </div>
          <div>
            <TextArea
              label="메모"
              value={property.notes ?? ""}
              onChange={(e) => update({ notes: e.target.value })}
              placeholder={propertyNotesPlaceholder(property.roomType)}
            />
          </div>
          {teamShareFields}
        </div>
      )}
    </Card>
    {enableIntake ? (
      <>
        <IntakeResetModal
          open={resetOpen}
          onClose={() => {
            setResetOpen(false);
            setPendingMethod(null);
          }}
          onConfirm={() => {
            const method = pendingMethod;
            setResetOpen(false);
            setPendingMethod(null);
            resetPropertyDraft();
            if (method) startIntake(method);
          }}
        />
        {messageOpen ? (
          <IntakeMessageModal
            open={messageOpen}
            busy={aiBusy}
            onClose={() => {
              if (aiBusy) return;
              setMessageOpen(false);
            }}
            onApply={(text) => void applyIntakeText(text, "message")}
          />
        ) : null}
        {talkOpen ? (
          <IntakeTalkModal
            open={talkOpen}
            kind="property"
            onClose={() => setTalkOpen(false)}
            onApply={(parsed) => void applyIntakeParsed(parsed)}
          />
        ) : null}
      </>
    ) : null}
    </>
  );
}
