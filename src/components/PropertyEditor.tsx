"use client";

import { useEffect, useRef, useState } from "react";
import type { Property } from "@/lib/types";
import {
  INSURANCE_TYPES,
  MAINTENANCE_OPTIONS,
  PROPERTY_OPTIONS,
} from "@/lib/constants";
import { Input, TextArea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DealTypeToggle } from "@/components/DealTypeToggle";
import { OptionToggle } from "@/components/OptionToggle";
import { DatePicker } from "@/components/DatePicker";
import { DateRangePicker } from "@/components/DateRangePicker";
import { TimePicker } from "@/components/TimePicker";
import { PhoneInput } from "@/components/PhoneInput";
import { RoomTypeSelect } from "@/components/RoomTypeSelect";
import {
  BuildingLandFields,
} from "@/components/BuildingLandFields";
import { SeoulAddressField } from "@/components/SeoulAddressField";
import { CircleCheck } from "@/components/ui/CircleCheck";
import { SchedulePropertySwapModal } from "@/components/SchedulePropertySwapModal";
import { formatMoveInRange, formatPhoneInput, onlyDigits } from "@/lib/format";
import {
  applyListedToProperty,
  PropertyLoadPicker,
} from "@/components/PropertyLoadPicker";
import { SiteShareFormField } from "@/components/SiteShareUi";
import {
  getMissingRequiredFields,
  type PropertyFieldKey,
} from "@/lib/propertyValidation";
import {
  EMPTY_UNIT_COUNTS,
  defaultRoomBathCounts,
  isBuildingType,
  isLandType,
  needsRoomBathCounts,
  normalizeRoomType,
  skipsResidentialExtras,
} from "@/lib/constants";
import type { RoomType } from "@/lib/types";
import { RoomBathCountFields } from "@/components/RoomBathCountFields";

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
}

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
        "rounded-lg px-2.5 py-1.5 text-sm font-semibold active:scale-95 transition-all duration-150",
        active
          ? "bg-[#3182F6] text-white"
          : "bg-gray-100 text-gray-600 hover:bg-gray-200",
      ].join(" ")}
    >
      {label}
    </button>
  );
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
  validationActive = false,
  focusField,
  requireDong = true,
  propertyCount,
  allProperties,
  onSwapWith,
}: PropertyEditorProps) {
  const fieldRefs = useRef<Partial<Record<PropertyFieldKey, HTMLDivElement | null>>>(
    {}
  );
  const [moveOpen, setMoveOpen] = useState(false);
  const [enterDirectContacts, setEnterDirectContacts] = useState(() => {
    return Boolean(
      onlyDigits(property.tenantPhone ?? "") ||
        onlyDigits(property.landlordPhone ?? "")
    );
  });

  const reorderList = allProperties ?? [];
  const canReorder = Boolean(onSwapWith);

  const update = (patch: Partial<Property>) => {
    const next: Property = { ...property, ...patch };
    if (isBuildingType(next.roomType) || isLandType(next.roomType)) {
      next.dealType = "매매";
      next.monthlyRent = 0;
    } else if (next.dealType === "전세" || next.dealType === "매매") {
      next.monthlyRent = 0;
    }
    onChange(next);
  };

  const updateAgency = (patch: Partial<Property["partnerAgency"]>) =>
    onChange({
      ...property,
      partnerAgency: { ...property.partnerAgency, ...patch },
    });

  const toggleList = (key: "maintenanceIncludes" | "options", value: string) => {
    const current = property[key];
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    update({ [key]: next });
  };

  const missingFields = validationActive
    ? getMissingRequiredFields(property, { requireDong })
    : [];
  const isInvalid = (key: PropertyFieldKey) => missingFields.includes(key);

  const showContactFields =
    !property.hasPartnerAgency ||
    enterDirectContacts ||
    (validationActive && isInvalid("contacts"));

  useEffect(() => {
    if (!validationActive || !focusField) return;
    if (
      property.hasPartnerAgency &&
      (focusField === "contacts" ||
        focusField === "partnerPhone" ||
        focusField === "partnerName" ||
        focusField === "partnerDong")
    ) {
      if (focusField === "contacts") setEnterDirectContacts(true);
    }
    const el = fieldRefs.current[focusField];
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [validationActive, focusField, property.hasPartnerAgency]);

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
      patch.dealType = "월세";
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

  return (
    <Card
      className={[
        "space-y-2.5",
        showTitle
          ? "border-2 border-gray-200 shadow-md"
          : "",
      ].join(" ")}
    >
      {enableLoad && (
        <PropertyLoadPicker
          onSelect={(listed) =>
            onChange(
              applyListedToProperty(
                property.id,
                listed,
                property.arriveTime ?? ""
              )
            )
          }
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
                className="group relative z-10 flex min-h-[44px] items-center gap-1.5 rounded-xl px-1 py-1 text-left active:scale-[0.98] transition-transform"
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
        />
      )}

      <div className="space-y-2">
        <p className="text-sm font-bold text-gray-800">협력 부동산</p>
        <label
          className={[
            "flex min-h-[48px] items-center gap-3 rounded-xl border px-3.5",
            "active:scale-[0.99] transition-all duration-150",
            property.hasPartnerAgency
              ? "border-emerald-300 bg-emerald-50"
              : "border-gray-200 bg-gray-50",
          ].join(" ")}
        >
          <CircleCheck
            accent="emerald"
            checked={property.hasPartnerAgency ?? false}
            onChange={(e) => {
              const on = e.target.checked;
              update({
                hasPartnerAgency: on,
                partnerAgency: on
                  ? property.partnerAgency
                  : { name: "", phone: "", dong: "" },
              });
              if (!on) setEnterDirectContacts(false);
            }}
          />
          <span className="flex-1">
            <span className="flex flex-wrap items-baseline gap-x-1.5">
              <span
                className={[
                  "text-[15px] font-bold",
                  property.hasPartnerAgency
                    ? "text-emerald-800"
                    : "text-gray-900",
                ].join(" ")}
              >
                협력 부동산 있음
              </span>
              <span className="text-[12px] font-medium text-gray-400">
                (협력부동산매물일시)
              </span>
            </span>
            <span
              className={[
                "mt-0.5 block text-xs",
                property.hasPartnerAgency
                  ? "text-emerald-700/80"
                  : "text-gray-500",
              ].join(" ")}
            >
              체크하면 상호·연락처를 입력할 수 있어요
            </span>
          </span>
        </label>
        {property.hasPartnerAgency && (
          <>
            <div ref={setFieldRef("partnerName")}>
              <Input
                label="상호명 (동 이름 포함)"
                value={property.partnerAgency.name}
                onChange={(e) => updateAgency({ name: e.target.value })}
                placeholder="OO부동산"
                hint="동 이름을 포함하면 찾기 쉬워요"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div ref={setFieldRef("partnerDong")}>
                <Input
                  label="동"
                  required={requireDong}
                  invalid={isInvalid("partnerDong")}
                  value={property.partnerAgency.dong}
                  onChange={(e) => updateAgency({ dong: e.target.value })}
                  placeholder="성내동"
                  hint={isInvalid("partnerDong") ? "미입력" : undefined}
                />
              </div>
              <div ref={setFieldRef("partnerPhone")}>
                <PhoneInput
                  label="연락처"
                  required
                  invalid={isInvalid("partnerPhone")}
                  value={formatPhoneInput(property.partnerAgency.phone)}
                  onChange={(phone) => updateAgency({ phone })}
                  placeholder="02-1234-5678"
                />
              </div>
            </div>
            <label className="flex min-h-[44px] items-center gap-3 rounded-xl border border-dashed border-gray-200 bg-white px-3.5 active:scale-[0.99] transition-all duration-150">
              <CircleCheck
                checked={enterDirectContacts}
                onChange={(e) => setEnterDirectContacts(e.target.checked)}
              />
              <span className="text-[14px] font-semibold text-gray-700">
                임차인 임대인 연락처 추가 입력 (선택)
              </span>
            </label>
          </>
        )}

        {showContactFields && (
          <div
            ref={setFieldRef("contacts")}
            className={[
              "space-y-1 rounded-xl",
              isInvalid("contacts")
                ? "border border-red-500 bg-red-50 p-2.5"
                : "",
            ].join(" ")}
          >
            <p
              className={[
                "text-[13px] font-semibold",
                isInvalid("contacts") ? "text-red-600" : "text-gray-600",
              ].join(" ")}
            >
              연락처
              {!property.hasPartnerAgency && (
                <span
                  className={
                    isInvalid("contacts")
                      ? "ml-0.5 text-red-500"
                      : "ml-0.5 text-[#3182F6]"
                  }
                >
                  *
                </span>
              )}
            </p>
            <p
              className={[
                "text-xs",
                isInvalid("contacts")
                  ? "font-semibold text-red-500"
                  : "text-gray-400",
              ].join(" ")}
            >
              {isInvalid("contacts")
                ? "미입력 · 임차인 또는 임대인 번호 필요"
                : "임차인·임대인 중 하나 이상 필수"}
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <PhoneInput
                label="임차인 번호"
                invalid={isInvalid("contacts")}
                value={formatPhoneInput(property.tenantPhone ?? "")}
                onChange={(tenantPhone) => update({ tenantPhone })}
                placeholder="010-1234-5678"
                hint=""
              />
              <PhoneInput
                label="임대인 번호"
                invalid={isInvalid("contacts")}
                value={formatPhoneInput(property.landlordPhone ?? "")}
                onChange={(landlordPhone) => update({ landlordPhone })}
                placeholder="010-1234-5678"
                hint=""
              />
            </div>
          </div>
        )}

        <div ref={setFieldRef("roomType")}>
          <RoomTypeSelect
            required
            invalid={isInvalid("roomType")}
            value={
              normalizeRoomType(property.roomType) ??
              property.roomType ??
              "원룸"
            }
            onChange={handleRoomTypeChange}
          />
        </div>

        <div ref={setFieldRef("roomCount")}>
          <RoomBathCountFields
            roomType={normalizeRoomType(property.roomType) ?? property.roomType}
            roomCount={property.roomCount}
            bathroomCount={property.bathroomCount}
            invalidRoomCount={isInvalid("roomCount")}
            onChange={({ roomCount, bathroomCount }) =>
              update({ roomCount, bathroomCount })
            }
          />
        </div>
      </div>

      <div className="mt-2 space-y-1.5 border-t border-gray-200 pt-4">
        <p className="text-sm font-bold text-gray-800">금액 & 조건</p>
        <div ref={setFieldRef("dealType")}>
          <DealTypeToggle
            label="희망거래"
            required
            invalid={isInvalid("dealType")}
            value={
              isBuilding || isLand ? "매매" : property.dealType
            }
            onChange={(dealType) => update({ dealType })}
            types={
              isBuilding || isLand ? (["매매"] as const) : undefined
            }
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div ref={setFieldRef("deposit")}>
            <Input
              label={
                property.dealType === "매매" || isBuilding || isLand
                  ? "매가 (만원)"
                  : "보증금 (만원)"
              }
              required
              invalid={isInvalid("deposit")}
              hint={isInvalid("deposit") ? "미입력" : undefined}
              type="number"
              value={property.deposit || ""}
              onChange={(e) =>
                update({ deposit: Number(e.target.value) || 0 })
              }
              placeholder="10000"
            />
          </div>
          {property.dealType === "월세" && !isBuilding && !isLand && (
            <Input
              label="월세 (만원)"
              type="number"
              value={property.monthlyRent || ""}
              onChange={(e) =>
                update({ monthlyRent: Number(e.target.value) || 0 })
              }
              placeholder="50"
            />
          )}
          {!isLand && (
            <Input
              label="관리비 (만원)"
              type="number"
              value={property.maintenanceFee || ""}
              onChange={(e) =>
                update({ maintenanceFee: Number(e.target.value) || 0 })
              }
              placeholder="10"
            />
          )}
        </div>
        {!isLand && !isBuilding && !hideResidentialExtras && (
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
        {!isLand && !isBuilding && (
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[13px] font-semibold text-gray-600">
                입주 가능일
              </p>
              <label className="flex items-center gap-2 active:scale-95 transition-all duration-150">
                <CircleCheck
                  checked={moveInSingle}
                  onChange={(e) => {
                    const on = e.target.checked;
                    const to = on ? moveInFrom : property.moveInTo || "";
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
            {moveInSingle ? (
              <DatePicker
                label=""
                value={moveInFrom}
                onChange={(next) =>
                  update({
                    moveInSingle: true,
                    moveInFrom: next,
                    moveInTo: next,
                    moveInDate: formatMoveInRange(next, next),
                  })
                }
                placeholder="입주 가능일 선택"
              />
            ) : (
              <DateRangePicker
                label=""
                from={moveInFrom}
                to={property.moveInTo || ""}
                onChange={({ from, to }) => {
                  const sameDay = Boolean(from && to && from === to);
                  update({
                    moveInSingle: sameDay,
                    moveInFrom: from,
                    moveInTo: to,
                    moveInDate: formatMoveInRange(from, to || undefined),
                  });
                }}
              />
            )}
          </div>
        )}
      </div>

      <div className="mt-2 space-y-1.5 border-t border-gray-200 pt-4">
        <p className="text-sm font-bold text-gray-800">위치 / 현장</p>
        <div ref={setFieldRef("address")}>
          <SeoulAddressField
            required
            requireDong={requireDong}
            invalid={isInvalid("address")}
            value={property.address}
            onChange={(address) => update({ address })}
            onDongChange={(dong) => {
              updateAgency({
                dong: property.partnerAgency.dong || dong,
              });
            }}
          />
        </div>
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-[12px] font-semibold leading-snug text-amber-800">
          구·동·지번 본번이 정확하지 않으면 원터치 네비 기능이 정상적으로
          지원되지 않을 수 있습니다.
        </p>
        {!isLand && !isBuilding && (
          <Input
            label="동·호실"
            value={property.roomNo}
            onChange={(e) => update({ roomNo: e.target.value })}
            placeholder="101동 1203호"
          />
        )}
        {!isLand && (
          <div className="grid grid-cols-2 gap-2">
            <label className="block space-y-1">
              <span className="text-[13px] font-semibold text-gray-600">
                1층 비밀번호
              </span>
              <input
                value={property.floorPassword ?? ""}
                onChange={(e) => update({ floorPassword: e.target.value })}
                placeholder="1234*"
                className="h-10 w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 text-[15px] text-gray-900 outline-none transition focus:border-[#3182F6] focus:bg-white focus:ring-2 focus:ring-[#3182F6]/20"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-[13px] font-semibold text-gray-600">
                호실 비밀번호
              </span>
              <input
                value={property.roomPassword ?? property.password ?? ""}
                onChange={(e) => update({ roomPassword: e.target.value })}
                placeholder="5678*"
                className="h-10 w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 text-[15px] text-gray-900 outline-none transition focus:border-[#3182F6] focus:bg-white focus:ring-2 focus:ring-[#3182F6]/20"
              />
            </label>
          </div>
        )}
      </div>

      {isBuilding && (
        <div
          ref={setFieldRef("buildingKind")}
          className="mt-2 space-y-1.5 border-t border-gray-200 pt-4"
        >
          <BuildingLandFields
            property={property}
            onChange={update}
            invalidBuildingKind={isInvalid("buildingKind")}
          />
          <div className="mt-3 space-y-1.5">
            <OptionToggle
              label="엘리베이터 유무"
              columns={2}
              value={property.elevator ? "유" : "무"}
              options={["유", "무"] as const}
              onChange={(v) => update({ elevator: v === "유" })}
            />
            <TextArea
              label="추가내용"
              value={property.notes ?? ""}
              onChange={(e) => update({ notes: e.target.value })}
              placeholder="위반건축물, 건물현황, 향, 특이사항 등"
            />
            {showTeamShare ? (
              <>
                <OptionToggle
                  label="팀공유 유무"
                  hint="팀에 공유가 필요할 때 사용하세요"
                  columns={2}
                  value={property.workspaceShared === true ? "유" : "무"}
                  options={["유", "무"] as const}
                  onChange={(v) => update({ workspaceShared: v === "유" })}
                />
                <SiteShareFormField
                  value={false}
                  onChange={() => {}}
                />
              </>
            ) : null}
          </div>
        </div>
      )}

      {isLand && (
        <div className="mt-2 space-y-1.5 border-t border-gray-200 pt-4">
          <BuildingLandFields
            property={property}
            onChange={update}
            invalidBuildingKind={isInvalid("buildingKind")}
          />
          <div className="mt-3 space-y-1.5">
            <TextArea
              label="추가내용"
              value={property.notes ?? ""}
              onChange={(e) => update({ notes: e.target.value })}
              placeholder="위반건축물, 건물현황, 향, 특이사항 등"
            />
            {showTeamShare ? (
              <>
                <OptionToggle
                  label="팀공유 유무"
                  hint="팀에 공유가 필요할 때 사용하세요"
                  columns={2}
                  value={property.workspaceShared === true ? "유" : "무"}
                  options={["유", "무"] as const}
                  onChange={(v) => update({ workspaceShared: v === "유" })}
                />
                <SiteShareFormField
                  value={false}
                  onChange={() => {}}
                />
              </>
            ) : null}
          </div>
        </div>
      )}

      {!isLand && !isBuilding && (
        <div className="mt-2 space-y-1.5 border-t border-gray-200 pt-4">
          <p className="text-sm font-bold text-gray-800">기타</p>
          {!hideResidentialExtras && (
            <div ref={setFieldRef("loan")}>
              <OptionToggle
                label="대출 유무"
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
                onChange={(loanAvailable) => update({ loanAvailable })}
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
                onChange={(insuranceType) => update({ insuranceType })}
              />
            </div>
          )}
          <div ref={setFieldRef("parking")}>
            <OptionToggle
              label="주차 유무"
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
              onChange={(parkingType) =>
                update({
                  parkingType,
                  parkingFeeType: "별도",
                  parkingFee:
                    parkingType === "유" ? (property.parkingFee ?? 0) : undefined,
                })
              }
            />
          </div>
          {property.parkingType === "유" && (
            <Input
              label="주차비 (만원/월)"
              type="number"
              inputMode="numeric"
              value={property.parkingFee ?? 0}
              onChange={(e) => {
                const raw = e.target.value;
                update({
                  parkingFeeType: "별도",
                  parkingFee: raw === "" ? 0 : Number(raw) || 0,
                });
              }}
              placeholder="0"
            />
          )}
          <OptionToggle
            label="엘리베이터 유무"
            columns={2}
            value={property.elevator ? "유" : "무"}
            options={["유", "무"] as const}
            onChange={(v) => update({ elevator: v === "유" })}
          />
          {!hideResidentialExtras && (
            <OptionToggle
              label="애완동물 유무"
              columns={2}
              value={property.petAllowed ?? "무"}
              options={["유", "무"] as const}
              onChange={(petAllowed) => update({ petAllowed })}
            />
          )}
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
          <TextArea
            label="추가내용"
            value={property.notes ?? ""}
            onChange={(e) => update({ notes: e.target.value })}
            placeholder={
              property.roomType === "상가"
                ? "권리금, 건물현황, 향, 특이사항 등"
                : property.roomType === "사무실"
                  ? "층, 건물현황, 향, 특이사항 등"
                  : "위반건축물, 건물현황, 향, 특이사항 등"
            }
          />
          {showTeamShare ? (
            <>
              <OptionToggle
                label="팀공유 유무"
                hint="팀에 공유가 필요할 때 사용하세요"
                columns={2}
                value={property.workspaceShared === true ? "유" : "무"}
                options={["유", "무"] as const}
                onChange={(v) => update({ workspaceShared: v === "유" })}
              />
              <SiteShareFormField
                value={false}
                onChange={() => {}}
              />
            </>
          ) : null}
        </div>
      )}
    </Card>
  );
}
