"use client";

import type { Property } from "@/lib/types";
import { formatPropertyPlaceLine } from "@/lib/propertyRoomNo";
import {
  displayRoomType,
  skipsResidentialExtras,
  needsMaintenanceFee,
  formatUnitCountsLine,
  needsRoomBathCounts,
  isUnitRoomType,
} from "@/lib/constants";
import {
  formatDepositRent,
  formatMoney,
  getPropertyMoveInLabel,
  formatPhone,
  isInsuranceJoined,
  needsJeonseInsurance,
  formatBuildingParking,
} from "@/lib/format";
import { formatLandAreaLine } from "@/lib/landArea";
import { formatDisplayTime } from "@/components/TimePicker";
import { Card } from "@/components/ui/Card";
import { PhoneLink, PhoneHandsetIcon } from "@/components/PhoneLink";
import { AddressLink } from "@/components/AddressLink";
import { toNaviAddress } from "@/lib/navi";
import { PasswordReveal } from "@/components/PasswordReveal";
import { SchedulePropertySwapModal } from "@/components/SchedulePropertySwapModal";
import { dealTypeBarClass, dealTypeTextClass } from "@/components/ListEdgeChips";
import { notesWithDoorPasswords } from "@/lib/propertyPasswords";
import { useState } from "react";

function NaviGlyph({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={["shrink-0", className].join(" ")}
      aria-hidden
    >
      <path d="M12 2.25c-3.9 0-7.05 3.05-7.05 6.8 0 4.95 6.2 11.55 6.46 11.82a.8.8 0 0 0 1.18 0c.26-.27 6.46-6.87 6.46-11.82 0-3.75-3.15-6.8-7.05-6.8Zm0 9.55a2.75 2.75 0 1 1 0-5.5 2.75 2.75 0 0 1 0 5.5Z" />
    </svg>
  );
}

interface PropertyBriefProps {
  index: number;
  property: Property;
  /** 순서 변경용 전체 매물 (2개 이상일 때 제목 탭) */
  allProperties?: Property[];
  onSwapWith?: (targetIndex: number) => void;
  /** false면 「N번 매물」 제목 숨김 (매물 상세 등) */
  showTitle?: boolean;
  /** false면 방문 약속 칩 숨김 (매물 상세 등) */
  showArriveTime?: boolean;
  /** 바깥 카드·떠 있는 칩 없이 본문만 */
  embedded?: boolean;
  /** 비어 있는 선택 칸은 숨김 */
  omitEmpty?: boolean;
}

const chipBase =
  "inline-flex items-center rounded-full px-3 py-1.5 text-[14px] font-bold leading-none tracking-tight";
/** 유·입주·옵션: 브랜드 블루 톤 / 무: 중립 회색 */
const chipOn = `${chipBase} bg-[#3182F6]/12 text-gray-900`;
const chipOff = `${chipBase} bg-[#F2F4F6] text-gray-500`;
const chipOption = `${chipBase} bg-[#3182F6]/12 text-gray-900`;

function StatusChip({
  label,
  value,
  active,
}: {
  label: string;
  value: string;
  active: boolean;
}) {
  return (
    <span className={active ? chipOn : chipOff}>
      {label} {value}
    </span>
  );
}

export function PropertyBrief({
  index,
  property,
  allProperties,
  onSwapWith,
  showTitle = true,
  showArriveTime = true,
  embedded = false,
  omitEmpty = false,
}: PropertyBriefProps) {
  const [moveOpen, setMoveOpen] = useState(false);
  const canReorder = Boolean(onSwapWith);
  const insuranceOn = isInsuranceJoined(property.insuranceType);
  const showResidentialExtras =
    property.roomType !== "토지" &&
    property.roomType !== "건물" &&
    !skipsResidentialExtras(property.roomType);
  const loanOn = property.loanAvailable === "유";
  const moveInLabel = getPropertyMoveInLabel(property);
  const partnerLabel =
    property.partnerAgency?.name?.trim() || "협력부동산";

  const dealLabel =
    property.roomType === "건물" || property.roomType === "토지"
      ? "매매"
      : property.dealType;

  const showArriveChip = showArriveTime && Boolean(property.arriveTime);
  const memoText = showArriveTime
    ? property.notes?.trim() || ""
    : notesWithDoorPasswords(property);
  const hasNotes = Boolean(memoText);
  const hasFloorPw = Boolean(property.floorPassword?.trim());
  const hasRoomPw = Boolean(
    (property.roomPassword || property.password)?.trim()
  );
  const showPasswords =
    showArriveTime &&
    property.roomType !== "토지" &&
    (!omitEmpty || hasFloorPw || hasRoomPw);
  const showMemo = !omitEmpty || hasNotes;
  const showMoveIn =
    property.roomType !== "토지" &&
    property.roomType !== "건물" &&
    (!omitEmpty || (Boolean(moveInLabel) && moveInLabel !== "-"));
  const showMaintenance = needsMaintenanceFee(
    dealLabel,
    property.roomType
  );

  const typeLabel = displayRoomType(property.roomType, property.buildingKind);
  const typeText = typeLabel && typeLabel !== "-" ? typeLabel : "유형";

  const inner = (
    <>
        {showTitle ? (
          <div className="relative z-10 px-3 pt-3">
            {canReorder ? (
              <button
                type="button"
                onClick={() => setMoveOpen(true)}
                className="group flex min-h-[40px] min-w-0 items-center gap-1.5 text-left active:scale-[0.98] transition-transform"
              >
                <span className="truncate text-[22px] font-extrabold tracking-tight text-gray-900 underline decoration-gray-300 underline-offset-4 group-hover:decoration-[#3182F6]">
                  {index + 1}번 매물
                </span>
                <span className="shrink-0 rounded-md bg-blue-50 px-1.5 py-0.5 text-[11px] font-bold text-[#3182F6]">
                  순서 변경
                </span>
              </button>
            ) : (
              <p className="min-w-0 text-[22px] font-extrabold tracking-tight text-gray-900">
                {index + 1}번 매물
              </p>
            )}
          </div>
        ) : null}

        {canReorder ? (
          <SchedulePropertySwapModal
            open={moveOpen}
            onClose={() => setMoveOpen(false)}
            properties={allProperties ?? [property]}
            fromIndex={index}
            onSelect={(target) => onSwapWith?.(target)}
          />
        ) : null}

        <div
          className={[
            "space-y-2 px-3 pb-3",
            showTitle ? "pt-1.5" : "pt-3",
          ].join(" ")}
        >
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {dealLabel ? (
            <span
              className={[
                "text-[22px] font-extrabold leading-none tracking-tight",
                dealTypeTextClass(dealLabel),
              ].join(" ")}
            >
              {dealLabel}
            </span>
          ) : null}
          <span className="inline-flex max-w-[8.5rem] shrink-0 truncate rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-[16px] font-bold leading-none text-gray-600">
            {typeText}
          </span>
        </div>
        {/* 원터치 네비 — 제목·안내 상단, 아이콘은 주소 옆 하단 */}
        <AddressLink
          address={property.address}
          showIcon={false}
          className="rounded-2xl bg-[#E8F3FF] px-3 py-3 ring-1 ring-inset ring-[#3182F6]/20"
        >
          <span className="flex w-full items-baseline gap-x-2 gap-y-0.5">
            <span className="shrink-0 text-[14px] font-extrabold leading-none text-[#3182F6]">
              원터치 네비게이션
            </span>
            <span className="min-w-0 flex-1 text-right text-[11px] font-medium leading-snug text-[#1B64DA]/70">
              주소를 눌러 네비게이션으로 이동하세요
            </span>
          </span>
          <span className="mt-2 flex w-full items-end gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#3182F6] text-white shadow-sm">
              <NaviGlyph className="h-6 w-6" />
            </span>
            <span className="min-w-0 flex-1 text-right">
              <span className="inline-block text-[18px] font-extrabold leading-snug tracking-tight text-[#1B64DA] underline decoration-[#3182F6]/45 underline-offset-[3px]">
                {toNaviAddress(property.address) ||
                  property.address ||
                  "주소 없음"}
              </span>
              {formatPropertyPlaceLine(property) ? (
                <span className="mt-0.5 block text-[12px] font-bold leading-snug text-gray-700">
                  {formatPropertyPlaceLine(property)}
                </span>
              ) : null}
            </span>
          </span>
        </AddressLink>

        {/* 원터치 전화 — 제목 좌상단 · 안내 옆 · 상호/지역/번호 */}
        {(property.tenantPhone ||
          property.landlordPhone ||
          property.hasPartnerAgency) ? (
          <div className="rounded-2xl bg-[#E8F8F1] px-3 py-3 ring-1 ring-inset ring-[#03B26C]/20">
            <div className="flex items-baseline gap-x-2 gap-y-0.5">
              <p className="shrink-0 text-[14px] font-extrabold leading-none text-[#03B26C]">
                원터치 전화
              </p>
              <p className="min-w-0 flex-1 text-right text-[11px] font-medium leading-snug text-[#027A4A]/70">
                전화번호를 누르면 전화로 이동합니다
              </p>
            </div>
            <div className="mt-2 flex items-end gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#03B26C] text-white shadow-sm">
                <PhoneHandsetIcon className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1 divide-y divide-[#03B26C]/15">
                {property.hasPartnerAgency ? (
                  property.partnerAgency?.phone ? (
                    <PhoneLink
                      phone={property.partnerAgency.phone}
                      showIcon={false}
                      className="!flex w-full items-center gap-2 py-1.5 !text-[#03B26C] first:pt-0 last:pb-0"
                    >
                      <span className="min-w-0 flex-1 truncate text-[13px] font-extrabold text-gray-900">
                        {partnerLabel}
                      </span>
                      {property.partnerAgency?.dong?.trim() ? (
                        <span className="shrink-0 rounded-md border border-gray-200 bg-white px-1 py-0.5 text-[10px] font-bold text-gray-500">
                          {property.partnerAgency.dong.trim()}
                        </span>
                      ) : null}
                      <span className="shrink-0 text-[19px] font-extrabold tabular-nums tracking-tight underline decoration-[#03B26C]/45 underline-offset-[3px]">
                        {formatPhone(property.partnerAgency.phone)}
                      </span>
                    </PhoneLink>
                  ) : (
                    <div className="flex items-center gap-2 py-1.5 first:pt-0 last:pb-0">
                      <p className="min-w-0 flex-1 truncate text-[13px] font-extrabold text-gray-900">
                        {partnerLabel}
                      </p>
                      {property.partnerAgency?.dong?.trim() ? (
                        <span className="shrink-0 rounded-md border border-gray-200 bg-white px-1 py-0.5 text-[10px] font-bold text-gray-500">
                          {property.partnerAgency.dong.trim()}
                        </span>
                      ) : null}
                      <span className="shrink-0 text-[13px] font-medium text-gray-400">
                        번호 없음
                      </span>
                    </div>
                  )
                ) : (
                  <>
                    {property.tenantPhone ? (
                      <PhoneLink
                        phone={property.tenantPhone}
                        showIcon={false}
                        className="!flex w-full items-baseline justify-between gap-3 py-1.5 !text-[#03B26C] first:pt-0 last:pb-0"
                      >
                        <span className="shrink-0 text-[14px] font-bold text-gray-600">
                          임차인
                        </span>
                        <span className="text-[20px] font-extrabold tabular-nums tracking-tight underline decoration-[#03B26C]/45 underline-offset-[3px]">
                          {formatPhone(property.tenantPhone)}
                        </span>
                      </PhoneLink>
                    ) : null}
                    {property.landlordPhone ? (
                      <PhoneLink
                        phone={property.landlordPhone}
                        showIcon={false}
                        className="!flex w-full items-baseline justify-between gap-3 py-1.5 !text-[#03B26C] first:pt-0 last:pb-0"
                      >
                        <span className="shrink-0 text-[14px] font-bold text-gray-600">
                          임대인
                        </span>
                        <span className="text-[20px] font-extrabold tabular-nums tracking-tight underline decoration-[#03B26C]/45 underline-offset-[3px]">
                          {formatPhone(property.landlordPhone)}
                        </span>
                      </PhoneLink>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          </div>
        ) : null}

        {/* 금액 · 관리비 · 입주 */}
        <div className="grid grid-cols-2 gap-1.5">
          <div
            className={[
              "flex min-h-[46px] flex-col justify-center rounded-xl bg-[#F9FAFB] px-2.5 py-1.5",
              property.roomType === "토지" ||
              property.roomType === "건물" ||
              showMaintenance
                ? ""
                : "col-span-2",
            ].join(" ")}
          >
            <p className="text-[11px] font-bold leading-none text-gray-400">
              금액
            </p>
            <p className="mt-1 text-[15px] font-extrabold leading-snug tracking-tight text-gray-900">
              {formatDepositRent(
                property.roomType === "건물" || property.roomType === "토지"
                  ? "매매"
                  : property.dealType ?? "",
                property.deposit,
                property.monthlyRent
              )}
            </p>
          </div>
          {property.roomType === "토지" ? (
            <div className="flex min-h-[46px] flex-col justify-center rounded-xl bg-[#F9FAFB] px-2.5 py-1.5">
              <p className="text-[11px] font-bold leading-none text-gray-400">
                대지면적
                {property.landCategory?.trim() ? " · 지목" : ""}
                {property.landUse?.trim() ? " · 용도지역" : ""}
              </p>
              <p className="mt-1 text-[15px] font-extrabold leading-snug tracking-tight text-gray-900">
                {[
                  formatLandAreaLine(property.landArea) || null,
                  property.landCategory?.trim() || null,
                  property.landUse?.trim() || null,
                ]
                  .filter(Boolean)
                  .join(" · ") || "-"}
              </p>
            </div>
          ) : property.roomType === "건물" ? (
            <div className="flex min-h-[46px] flex-col justify-center rounded-xl bg-[#F9FAFB] px-2.5 py-1.5">
              <p className="text-[11px] font-bold leading-none text-gray-400">
                층수 · 주차
              </p>
              <p className="mt-1 text-[15px] font-extrabold leading-snug tracking-tight text-gray-900">
                {[
                  property.floorsBasement
                    ? `지하 -${property.floorsBasement}`
                    : null,
                  property.floorsAbove ? `지상 ${property.floorsAbove}` : null,
                  property.parkingSpaces != null ||
                  property.parkingSpacesAbove ||
                  property.parkingSpacesBasement
                    ? formatBuildingParking(
                        property.parkingSpacesAbove,
                        property.parkingSpacesBasement,
                        property.parkingSpaces
                      ) ||
                      (property.parkingSpaces != null
                        ? `지상 ${property.parkingSpaces}대`
                        : null)
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || "-"}
              </p>
            </div>
          ) : showMaintenance ? (
            <div className="flex min-h-[46px] flex-col justify-center rounded-xl bg-[#F9FAFB] px-2.5 py-1.5">
              <p className="text-[11px] font-bold leading-none text-gray-400">
                관리비
              </p>
              <p className="mt-1 text-[15px] font-extrabold leading-snug tracking-tight text-gray-900">
                {formatMoney(property.maintenanceFee)}
                {!skipsResidentialExtras(property.roomType) &&
                (property.maintenanceIncludes?.length ?? 0) > 0 ? (
                  <span className="ml-1 text-[12px] font-semibold text-gray-500">
                    ({property.maintenanceIncludes.join(", ")})
                  </span>
                ) : null}
              </p>
            </div>
          ) : null}
          {property.roomType === "건물" && property.unitCounts ? (
            <div className="col-span-2 flex min-h-[40px] flex-col justify-center rounded-xl bg-[#F9FAFB] px-2.5 py-1.5">
              <p className="text-[11px] font-bold leading-none text-gray-400">
                방 · 상가수
              </p>
              <p className="mt-1 text-[14px] font-extrabold leading-snug tracking-tight text-gray-900">
                {formatUnitCountsLine(
                  property.unitCounts,
                  property.buildingKind
                ) || "-"}
              </p>
            </div>
          ) : null}
          {needsRoomBathCounts(property.roomType) ? (
            <div className="col-span-2 flex min-h-[40px] flex-col justify-center rounded-xl bg-[#F9FAFB] px-2.5 py-1.5">
              <p className="text-[11px] font-bold leading-none text-gray-400">
                방 · 화장실
              </p>
              <p className="mt-1 text-[14px] font-extrabold leading-snug tracking-tight text-gray-900">
                방 {property.roomType === "투룸" ? 2 : property.roomCount ?? "-"}개
                {" · "}
                화장실 {property.bathroomCount ?? 1}개
              </p>
            </div>
          ) : null}
          {isUnitRoomType(property.roomType) &&
          property.usableArea != null ? (
            <div className="col-span-2 flex min-h-[40px] flex-col justify-center rounded-xl bg-[#F9FAFB] px-2.5 py-1.5">
              <p className="text-[11px] font-bold leading-none text-gray-400">
                평형 (약)
              </p>
              <p className="mt-1 text-[14px] font-extrabold leading-snug tracking-tight text-gray-900">
                {property.usableArea}평
              </p>
            </div>
          ) : null}
          {showMoveIn ? (
            <div className="col-span-2 flex min-h-[40px] flex-col justify-center rounded-xl bg-[#F9FAFB] px-2.5 py-1.5">
              <p className="text-[11px] font-bold leading-none text-gray-400">
                입주 가능
              </p>
              <p className="mt-1 text-[14px] font-extrabold leading-snug tracking-tight text-gray-900">
                {moveInLabel || "-"}
              </p>
            </div>
          ) : null}
        </div>

        {showPasswords ? (
          <div className="divide-y divide-gray-100 rounded-2xl bg-[#F9FAFB] px-3.5">
          <div className="flex items-center justify-between gap-2 py-3">
            <span className="text-[14px] font-bold text-gray-500">
              현관 비밀번호
            </span>
            <PasswordReveal password={property.floorPassword} />
          </div>
          <div className="flex items-center justify-between gap-2 py-3">
            <span className="text-[14px] font-bold text-gray-500">
              호실 비밀번호
            </span>
            <PasswordReveal
              password={property.roomPassword || property.password}
            />
          </div>
        </div>
        ) : null}

        {/* 조건 칩: 대출 → 보증보험 → 주차 → 엘리베이터 */}
        <div className="flex flex-wrap gap-1.5">
          {showResidentialExtras &&
          (!omitEmpty ||
            property.loanAvailable === "유" ||
            property.loanAvailable === "무") ? (
          <StatusChip
            label="대출"
            value={loanOn ? "가능" : "불가"}
            active={loanOn}
          />
          ) : null}
          {showResidentialExtras &&
          needsJeonseInsurance(property.dealType, property.roomType) &&
          (!omitEmpty ||
            property.insuranceType === "유" ||
            property.insuranceType === "무") ? (
          <StatusChip
            label="보증보험"
            value={
              insuranceOn
                ? property.insuranceType &&
                  property.insuranceType !== "유"
                  ? property.insuranceType
                  : "가능"
                : "불가"
            }
            active={insuranceOn}
          />
          ) : null}
          {property.roomType !== "토지" &&
          property.roomType !== "건물" &&
          (!omitEmpty ||
            property.parkingType === "유" ||
            property.parkingType === "무") ? (
          <StatusChip
            label="주차"
            value={
              property.parkingType === "유"
                ? [
                    "가능",
                    property.parkingFeeType === "포함" ? "포함" : "별도",
                    property.parkingFee != null && property.parkingFee > 0
                      ? formatMoney(property.parkingFee)
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")
                : "불가"
            }
            active={property.parkingType === "유"}
          />
          ) : null}
          {property.roomType !== "토지" &&
          (!omitEmpty ||
            property.elevator === true ||
            property.elevator === false) ? (
          <StatusChip
            label="엘리베이터"
            value={property.elevator ? "유" : "무"}
            active={property.elevator === true}
          />
          ) : null}
          {showResidentialExtras &&
            (property.options ?? []).map((opt) => (
            <span key={opt} className={chipOption}>
              {opt}
            </span>
          ))}
        </div>

        {showMemo ? (
        <div className="rounded-2xl bg-[#F9FAFB] px-3.5 py-3">
          <p className="text-[12px] font-bold text-gray-400">메모</p>
          <p className="mt-1 whitespace-pre-wrap text-[14px] font-medium leading-relaxed text-gray-800">
            {memoText || "-"}
          </p>
        </div>
        ) : null}
        </div>
    </>
  );

  if (embedded) {
    return <div className="space-y-2">{inner}</div>;
  }

  return (
    <div className="space-y-2">
      {showArriveChip ? (
        <div className="inline-flex items-center gap-2 rounded-xl bg-[#3182F6] px-3 py-2 text-white">
          <span className="shrink-0 text-[12px] font-bold text-white/75">
            방문 약속
          </span>
          <span className="text-[16px] font-extrabold tabular-nums tracking-tight">
            {formatDisplayTime(property.arriveTime!)}
          </span>
        </div>
      ) : null}
      <Card className="space-y-0 !overflow-hidden !p-0">
        <div className="flex">
          <div
            className={["w-1.5 shrink-0", dealTypeBarClass(dealLabel)].join(" ")}
            aria-hidden
          />
          <div className="min-w-0 flex-1">{inner}</div>
        </div>
      </Card>
    </div>
  );
}
