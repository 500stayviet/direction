"use client";

import { memo } from "react";
import type { DealType, RoomType } from "@/lib/types";
import {
  BUILDING_KINDS,
  needsRoomBathCounts,
  normalizeBuildingKind,
  roomTypesForDeal,
} from "@/lib/constants";
import { customerMemoPlaceholder } from "@/lib/memoPlaceholders";
import type { CustomerFieldKey } from "@/lib/customerValidation";
import {
  AVAIL_TOGGLE,
  availFromYesNo,
  needsJeonseInsurance,
  yesNoFromAvail,
} from "@/lib/format";
import {
  isCustomerLandOrBuilding,
  type CustomerFormDraft,
  type YesNoBlank,
} from "@/lib/customerFormDraft";
import { Input, TextArea } from "@/components/ui/Input";
import { ManAmountInput } from "@/components/ManAmountInput";
import { SiteShareFormField } from "@/components/SiteShareUi";
import { TeamShareFormField } from "@/components/TeamShareFormField";
import { DealTypeToggle } from "@/components/DealTypeToggle";
import { RoomBathCountFields, RoomBathCountGrids } from "@/components/RoomBathCountFields";
import { CircleCheck } from "@/components/ui/CircleCheck";
import { ModalChoice } from "@/components/ModalChoice";
import { OptionToggle } from "@/components/OptionToggle";
import { DatePicker } from "@/components/DatePicker";
import { DateRangePicker } from "@/components/DateRangePicker";
import { PhoneInput } from "@/components/PhoneInput";
import { LandCategoryPicker } from "@/components/LandCategoryPicker";
import { PreferredLocationPicker } from "@/components/PreferredLocationPicker";
import { requiredStarClass, invalidHintClass, invalidLabelClass, controlStatusClass } from "@/lib/uiInvalid";

type FieldRef = (key: CustomerFieldKey) => (node: HTMLDivElement | null) => void;

export const CustomerFormIdentityFields = memo(function CustomerFormIdentityFields({
  name,
  phone,
  phoneNonce,
  nameInvalid,
  phoneInvalid,
  duplicateHint,
  setFieldRef,
  onNameChange,
  onPhoneChange,
}: {
  name: string;
  phone: string;
  phoneNonce: number;
  nameInvalid: boolean;
  phoneInvalid: boolean;
  duplicateHint: boolean;
  setFieldRef: FieldRef;
  onNameChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
}) {
  return (
    <>
      <div ref={setFieldRef("name")}>
        <Input
          label="고객명 또는 명칭"
          required
          invalid={nameInvalid}
          filledVariant="identity"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="예) 홍길동"
        />
      </div>
      <div ref={setFieldRef("phone")} className="space-y-1.5">
        <PhoneInput
          key={phoneNonce}
          label="고객 전화번호"
          required
          invalid={phoneInvalid}
          value={phone}
          onChange={onPhoneChange}
          placeholder="예) 010-1234-5678"
          labelRight={duplicateHint ? "동일 고객이 존재합니다" : undefined}
          hint=""
        />
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-[12px] font-semibold leading-snug text-amber-800">
          전화번호는 정확하지 않으면 원터치 전화 기능이 정상지원 되지
          않습니다.
        </p>
      </div>
    </>
  );
});

export const CustomerFormTypeMoneyFields = memo(function CustomerFormTypeMoneyFields({
  draft,
  effectiveDealType,
  isLandOrBuilding,
  isInvalid,
  setFieldRef,
  roomTypeOpen,
  onRoomTypeOpenChange,
  onRoomType,
  onDealType,
  onPatch,
}: {
  draft: Pick<
    CustomerFormDraft,
    | "roomType"
    | "buildingKind"
    | "roomCount"
    | "bathroomCount"
    | "deposit"
    | "depositTo"
    | "depositSingle"
    | "monthlyRent"
    | "monthlyRentTo"
    | "monthlyRentSingle"
    | "landCategory"
  >;
  effectiveDealType: DealType | "";
  isLandOrBuilding: boolean;
  isInvalid: (key: CustomerFieldKey) => boolean;
  setFieldRef: FieldRef;
  roomTypeOpen: boolean;
  onRoomTypeOpenChange: (open: boolean) => void;
  onRoomType: (next: RoomType) => void;
  onDealType: (next: DealType | "") => void;
  onPatch: (patch: Partial<CustomerFormDraft>) => void;
}) {
  const {
    roomType,
    buildingKind,
    roomCount,
    bathroomCount,
    deposit,
    depositTo,
    depositSingle,
    monthlyRent,
    monthlyRentTo,
    monthlyRentSingle,
    landCategory,
  } = draft;

  return (
    <>
      <div ref={setFieldRef("roomType")}>
        <ModalChoice
          label="매물 유형"
          required
          invalid={isInvalid("roomType")}
          value={roomType || undefined}
          options={roomTypesForDeal(effectiveDealType)}
          onChange={onRoomType}
          columns={4}
          keepOpen={(type) => needsRoomBathCounts(type)}
          open={roomTypeOpen}
          onOpenChange={onRoomTypeOpenChange}
          extra={
            <RoomBathCountGrids
              roomType={roomType}
              roomCount={roomCount}
              bathroomCount={bathroomCount}
              invalidRoomCount={isInvalid("roomCount")}
              onChange={({ roomCount: nextRooms, bathroomCount: nextBaths }) => {
                onPatch({ roomCount: nextRooms, bathroomCount: nextBaths });
              }}
            />
          }
        />
      </div>

      {roomType === "건물" ? (
        <div ref={setFieldRef("buildingKind")}>
          <ModalChoice
            label="건물 종류"
            required
            invalid={isInvalid("buildingKind")}
            value={
              normalizeBuildingKind(buildingKind) ??
              (buildingKind || undefined)
            }
            options={BUILDING_KINDS}
            onChange={(next) => onPatch({ buildingKind: next })}
            columns={1}
          />
        </div>
      ) : null}

      {roomType === "토지" ? (
        <LandCategoryPicker
          value={landCategory}
          onChange={(next) => onPatch({ landCategory: next })}
        />
      ) : null}

      <div ref={setFieldRef("roomCount")}>
        <RoomBathCountFields
          roomType={roomType}
          roomCount={roomCount}
          bathroomCount={bathroomCount}
          invalidRoomCount={isInvalid("roomCount")}
          onEdit={() => onRoomTypeOpenChange(true)}
          onChange={({ roomCount: nextRooms, bathroomCount: nextBaths }) => {
            onPatch({ roomCount: nextRooms, bathroomCount: nextBaths });
          }}
        />
      </div>

      <div ref={setFieldRef("dealType")}>
        <DealTypeToggle
          label="거래종류"
          required
          invalid={isInvalid("dealType")}
          value={effectiveDealType}
          onChange={onDealType}
          types={isLandOrBuilding ? (["매매"] as const) : undefined}
        />
      </div>

      <div className="space-y-2">
        <div
          className={
            effectiveDealType === "월세" ? "grid grid-cols-2 gap-2" : undefined
          }
        >
          <div
            className="space-y-1"
          >
            <div className="flex items-center justify-between gap-2">
              <p
                className={[
                  "flex min-w-0 flex-1 items-baseline gap-1 text-[13px] font-semibold",
                  isInvalid("deposit") || isInvalid("depositTo")
                    ? invalidLabelClass
                    : "text-gray-600",
                ].join(" ")}
              >
                <span className="shrink-0">
                  {effectiveDealType === "매매" ? "매매가" : "보증금"}
                  <span className={requiredStarClass}>*</span>
                </span>
                {effectiveDealType === "매매" ? (
                  <span className="min-w-0 truncate font-medium text-gray-400">
                    예: 5억 → 50000
                  </span>
                ) : effectiveDealType === "전세" ? (
                  <span className="min-w-0 truncate font-medium text-gray-400">
                    예: 1억 → 10000
                  </span>
                ) : null}
              </p>
              <label className="flex shrink-0 items-center gap-2 active:scale-95 transition-all duration-150">
                <CircleCheck
                  checked={depositSingle}
                  onChange={(e) => {
                    const on = e.target.checked;
                    onPatch({
                      depositSingle: on,
                      ...(on && deposit ? { depositTo: deposit } : {}),
                    });
                  }}
                />
                <span className="text-[14px] font-semibold text-gray-700">
                  단일
                </span>
              </label>
            </div>
            {isInvalid("deposit") || isInvalid("depositTo") ? (
              <p className={`text-xs ${invalidHintClass}`}>미입력</p>
            ) : null}
            {depositSingle ? (
              <div ref={setFieldRef("deposit")}>
                <ManAmountInput
                  label=""
                  required
                  invalid={isInvalid("deposit")}
                  value={deposit}
                  onChange={(next) => {
                    onPatch({ deposit: next, depositTo: next });
                  }}
                  placeholder="예) 1억 → 10000"
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <div ref={setFieldRef("deposit")}>
                  <ManAmountInput
                    label="부터"
                    required
                    invalid={isInvalid("deposit")}
                    value={deposit}
                    onChange={(next) => onPatch({ deposit: next })}
                    placeholder="예) 1억 → 10000"
                  />
                </div>
                <div ref={setFieldRef("depositTo")}>
                  <ManAmountInput
                    label="까지"
                    required
                    invalid={isInvalid("depositTo")}
                    value={depositTo}
                    onChange={(next) => onPatch({ depositTo: next })}
                    placeholder="예) 1억 → 10000"
                  />
                </div>
              </div>
            )}
          </div>

          {effectiveDealType === "월세" ? (
            <div
              className="space-y-1"
            >
              <div className="flex items-center justify-between gap-2">
                <p
                  className={[
                    "text-[13px] font-semibold",
                    isInvalid("monthlyRent") || isInvalid("monthlyRentTo")
                      ? invalidLabelClass
                      : "text-gray-600",
                  ].join(" ")}
                >
                  월세
                  <span className={requiredStarClass}>*</span>
                </p>
                <label className="flex items-center gap-2 active:scale-95 transition-all duration-150">
                  <CircleCheck
                    checked={monthlyRentSingle}
                    onChange={(e) => {
                      const on = e.target.checked;
                      onPatch({
                        monthlyRentSingle: on,
                        ...(on && monthlyRent
                          ? { monthlyRentTo: monthlyRent }
                          : {}),
                      });
                    }}
                  />
                  <span className="text-[14px] font-semibold text-gray-700">
                    단일
                  </span>
                </label>
              </div>
              {isInvalid("monthlyRent") || isInvalid("monthlyRentTo") ? (
                <p className={`text-xs ${invalidHintClass}`}>미입력</p>
              ) : null}
              {monthlyRentSingle ? (
                <div ref={setFieldRef("monthlyRent")}>
                  <ManAmountInput
                    label=""
                    required
                    invalid={isInvalid("monthlyRent")}
                    value={monthlyRent}
                    onChange={(next) => {
                      onPatch({ monthlyRent: next, monthlyRentTo: next });
                    }}
                    placeholder="예) 50"
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <div ref={setFieldRef("monthlyRent")}>
                    <ManAmountInput
                      label="부터"
                      required
                      invalid={isInvalid("monthlyRent")}
                      value={monthlyRent}
                      onChange={(next) => onPatch({ monthlyRent: next })}
                      placeholder="예) 40"
                    />
                  </div>
                  <div ref={setFieldRef("monthlyRentTo")}>
                    <ManAmountInput
                      label="까지"
                      required
                      invalid={isInvalid("monthlyRentTo")}
                      value={monthlyRentTo}
                      onChange={(next) => onPatch({ monthlyRentTo: next })}
                      placeholder="예) 60"
                    />
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
});

export const CustomerFormLocationMoveInFields = memo(
  function CustomerFormLocationMoveInFields({
    preferredGus,
    preferredDongs,
    moveInFrom,
    moveInTo,
    moveInSingle,
    nonOccupancy,
    effectiveDealType,
    showMoveIn,
    locationInvalid,
    moveInInvalid,
    setFieldRef,
    onPreferredChange,
    onPatch,
  }: {
    preferredGus: string[];
    preferredDongs: string[];
    moveInFrom: string;
    moveInTo: string;
    moveInSingle: boolean;
    nonOccupancy: boolean;
    effectiveDealType: DealType | "";
    showMoveIn: boolean;
    locationInvalid: boolean;
    moveInInvalid: boolean;
    setFieldRef: FieldRef;
    onPreferredChange: (next: {
      preferredGus: string[];
      preferredDongs: string[];
    }) => void;
    onPatch: (patch: Partial<CustomerFormDraft>) => void;
  }) {
    const showNonOccupancyToggle =
      effectiveDealType === "매매" && showMoveIn;

    return (
      <>
        <div ref={setFieldRef("preferredLocation")}>
          <PreferredLocationPicker
            preferredGus={preferredGus}
            preferredDongs={preferredDongs}
            invalid={locationInvalid}
            onChange={onPreferredChange}
          />
        </div>

        {showMoveIn ? (
          <div
            ref={setFieldRef("moveIn")}
            className="space-y-1"
          >
            <div className="flex items-center justify-between gap-2">
              <p
                className={[
                  "text-[13px] font-semibold",
                  moveInInvalid ? invalidLabelClass : "text-gray-600",
                ].join(" ")}
              >
                입주희망일
                <span className={requiredStarClass}>*</span>
              </p>
              <div className="flex shrink-0 items-center gap-3">
                {showNonOccupancyToggle ? (
                  <label className="flex items-center gap-2 active:scale-95 transition-all duration-150">
                    <CircleCheck
                      checked={nonOccupancy}
                      onChange={(e) => {
                        const on = e.target.checked;
                        onPatch({
                          nonOccupancy: on,
                          ...(on
                            ? {
                                moveInFrom: "",
                                moveInTo: "",
                                moveInSingle: false,
                              }
                            : {}),
                        });
                      }}
                    />
                    <span className="text-[14px] font-semibold text-gray-700">
                      비입주
                    </span>
                  </label>
                ) : null}
                <label
                  className={[
                    "flex items-center gap-2 active:scale-95 transition-all duration-150",
                    nonOccupancy ? "pointer-events-none opacity-40" : "",
                  ].join(" ")}
                >
                  <CircleCheck
                    checked={moveInSingle}
                    disabled={nonOccupancy}
                    onChange={(e) => {
                      const on = e.target.checked;
                      onPatch({
                        moveInSingle: on,
                        ...(on && moveInFrom
                          ? { moveInTo: moveInFrom }
                          : !on
                            ? { moveInTo: "" }
                            : {}),
                      });
                    }}
                  />
                  <span className="text-[14px] font-semibold text-gray-700">
                    단일
                  </span>
                </label>
              </div>
            </div>
            {moveInInvalid ? (
              <p className={`text-xs ${invalidHintClass}`}>미입력</p>
            ) : null}
            {nonOccupancy ? (
              <div
                className={[
                  "flex min-h-[36px] w-full items-center justify-center rounded-xl px-4 text-[15px] font-medium text-gray-700",
                  controlStatusClass({ filled: true }),
                ].join(" ")}
              >
                비입주
              </div>
            ) : moveInSingle ? (
              <DatePicker
                label=""
                required
                invalid={moveInInvalid}
                value={moveInFrom}
                onChange={(next) => {
                  onPatch({ moveInFrom: next, moveInTo: next });
                }}
                placeholder="단일 날짜 선택"
              />
            ) : (
              <DateRangePicker
                label=""
                required
                invalid={moveInInvalid}
                from={moveInFrom}
                to={moveInTo}
                onChange={({ from, to }) => {
                  const single = Boolean(from && (!to || from === to));
                  onPatch({
                    moveInSingle: single,
                    moveInFrom: from,
                    moveInTo: single ? from : to,
                  });
                }}
              />
            )}
          </div>
        ) : null}
      </>
    );
  }
);

export const CustomerFormExtraFields = memo(function CustomerFormExtraFields({
  roomType,
  dealType,
  loanNeeded,
  insuranceNeeded,
  parkingType,
  elevatorNeeded,
  notes,
  workspaceShared,
  hasTeam,
  isInvalid,
  setFieldRef,
  onPatch,
}: {
  roomType: RoomType | "";
  dealType: DealType | "";
  loanNeeded: YesNoBlank;
  insuranceNeeded: YesNoBlank;
  parkingType: YesNoBlank;
  elevatorNeeded: YesNoBlank;
  notes: string;
  workspaceShared: boolean;
  hasTeam: boolean;
  isInvalid: (key: CustomerFieldKey) => boolean;
  setFieldRef: FieldRef;
  onPatch: (patch: Partial<CustomerFormDraft>) => void;
}) {
  const hideLoanInsurance =
    roomType === "상가" ||
    roomType === "사무실" ||
    isCustomerLandOrBuilding(roomType);
  const showInsurance =
    !hideLoanInsurance && needsJeonseInsurance(dealType, roomType);

  return (
    <div className="mt-2 space-y-1.5 border-t border-gray-200 pt-3">
      <p className="text-sm font-bold text-gray-800">기타</p>
      {!hideLoanInsurance && (
        <div ref={setFieldRef("loan")}>
          <OptionToggle
            label="대출"
            required
            invalid={isInvalid("loan")}
            columns={2}
            value={availFromYesNo(loanNeeded)}
            options={AVAIL_TOGGLE}
            onChange={(next) => onPatch({ loanNeeded: yesNoFromAvail(next) })}
          />
        </div>
      )}
      {showInsurance && (
        <div ref={setFieldRef("insurance")}>
          <OptionToggle
            label="전세보증보험 가입 가능 여부"
            required
            invalid={isInvalid("insurance")}
            columns={2}
            value={availFromYesNo(insuranceNeeded)}
            options={AVAIL_TOGGLE}
            onChange={(next) =>
              onPatch({ insuranceNeeded: yesNoFromAvail(next) })
            }
          />
        </div>
      )}
      {!(roomType === "토지" || roomType === "건물") && (
        <div ref={setFieldRef("parking")}>
          <OptionToggle
            label="주차"
            required
            invalid={isInvalid("parking")}
            columns={2}
            value={availFromYesNo(parkingType)}
            options={AVAIL_TOGGLE}
            onChange={(next) => onPatch({ parkingType: yesNoFromAvail(next) })}
          />
        </div>
      )}
      {roomType !== "토지" && (
        <OptionToggle
          label="엘리베이터"
          columns={2}
          value={elevatorNeeded || undefined}
          options={["유", "무"] as const}
          onChange={(next) => onPatch({ elevatorNeeded: next })}
        />
      )}
      <div>
        <TextArea
          label="메모"
          value={notes}
          onChange={(e) => onPatch({ notes: e.target.value })}
          placeholder={customerMemoPlaceholder(roomType)}
        />
      </div>
      <TeamShareFormField
        value={workspaceShared}
        onChange={(next) => onPatch({ workspaceShared: next })}
        hasTeam={hasTeam}
      />
      <SiteShareFormField value={false} onChange={() => {}} />
    </div>
  );
});
