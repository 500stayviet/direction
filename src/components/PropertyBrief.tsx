"use client";

import type { Property } from "@/lib/types";
import {
  formatDepositRent,
  formatMoney,
  formatMoveInRange,
} from "@/lib/format";
import { formatDisplayTime } from "@/components/TimePicker";
import { Card } from "@/components/ui/Card";
import { PhoneLink } from "@/components/PhoneLink";
import { AddressLink } from "@/components/AddressLink";
import { PasswordReveal } from "@/components/PasswordReveal";

interface PropertyBriefProps {
  index: number;
  property: Property;
}

const chipBase =
  "inline-flex items-center rounded-full px-3.5 py-2 text-[14px] font-bold leading-none tracking-tight";
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

export function PropertyBrief({ index, property }: PropertyBriefProps) {
  const insuranceOn =
    property.insuranceType === "유" ||
    Boolean(
      property.insuranceType &&
        property.insuranceType !== "무" &&
        property.insuranceType !== "미가입"
    );
  const moveInLabel = formatMoveInRange(
    property.moveInFrom,
    property.moveInTo,
    property.moveInDate
  );
  const partnerLabel =
    property.partnerAgency.name?.trim() || "협력부동산";

  return (
    <Card className="space-y-0 overflow-hidden !p-0">
      {/* 헤더: 방문 시간 + 매물 번호 */}
      <div className="flex items-stretch">
        {property.arriveTime ? (
          <div className="flex min-w-[7.5rem] flex-col justify-center bg-[#3182F6] px-4 py-4 text-white">
            <p className="text-[11px] font-semibold tracking-wide text-white/80">
              방문 약속
            </p>
            <p className="mt-0.5 text-[28px] font-extrabold tabular-nums leading-none tracking-tight">
              {formatDisplayTime(property.arriveTime)}
            </p>
          </div>
        ) : null}
        <div className="flex flex-1 flex-col justify-center gap-2 px-4 py-4">
          <p className="text-[18px] font-extrabold tracking-tight text-gray-900">
            {index + 1}번 매물
          </p>
          <div className="flex flex-wrap gap-1.5">
            {property.roomType ? (
              <span className="rounded-lg bg-[#F2F4F6] px-2.5 py-1 text-[13px] font-bold text-gray-700">
                {property.roomType}
              </span>
            ) : null}
            <span className="rounded-lg bg-[#3182F6]/12 px-2.5 py-1 text-[13px] font-bold text-[#3182F6]">
              {property.dealType}
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-3 px-4 pb-4">
        {/* 원터치 네비 — 블루 포인트 (탭 = 지번까지만 네비 전달) */}
        <div className="rounded-2xl bg-[#E8F3FF] px-3.5 py-3.5 ring-1 ring-inset ring-[#3182F6]/25">
          <div className="mb-2 flex items-center gap-1.5">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#3182F6] text-[12px] text-white">
              ▶
            </span>
            <p className="text-[13px] font-extrabold text-[#3182F6]">
              원터치 네비게이션
            </p>
          </div>
          <AddressLink
            address={property.address}
            className="items-center rounded-xl bg-white px-3 py-3.5 text-[16px] font-extrabold leading-snug text-[#1B64DA] shadow-sm"
          >
            <span className="block">
              {property.address || "주소 없음"}
              {property.roomNo?.trim() ? (
                <span className="mt-0.5 block text-[13px] font-semibold text-gray-500">
                  {property.roomNo.trim()}
                </span>
              ) : null}
            </span>
          </AddressLink>
          <p className="mt-1.5 text-[11px] font-medium text-[#3182F6]/70">
            탭하면 주소·지번만 내비로 전달됩니다
          </p>
        </div>

        {/* 원터치 전화 — 민트 포인트 */}
        {(property.tenantPhone ||
          property.landlordPhone ||
          (property.hasPartnerAgency && property.partnerAgency.phone)) && (
          <div className="rounded-2xl bg-[#E8F8F1] px-3.5 py-3.5 ring-1 ring-inset ring-[#03B26C]/25">
            <div className="mb-2.5 flex items-center gap-1.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#03B26C] text-[12px] text-white">
                ☎
              </span>
              <p className="text-[13px] font-extrabold text-[#03B26C]">
                원터치 전화
              </p>
            </div>
            <div className="space-y-2">
              {property.hasPartnerAgency && property.partnerAgency.phone && (
                <div className="flex items-center justify-between gap-2 rounded-xl bg-white px-3 py-2.5 shadow-sm">
                  <span className="shrink-0 text-[14px] font-bold text-gray-700">
                    {partnerLabel}
                  </span>
                  <PhoneLink
                    phone={property.partnerAgency.phone}
                    className="!text-[16px] !font-extrabold !text-[#03B26C]"
                  />
                </div>
              )}
              {property.tenantPhone && (
                <div className="flex items-center justify-between gap-2 rounded-xl bg-white px-3 py-2.5 shadow-sm">
                  <span className="shrink-0 text-[14px] font-bold text-gray-700">
                    임차인
                  </span>
                  <PhoneLink
                    phone={property.tenantPhone}
                    className="!text-[16px] !font-extrabold !text-[#03B26C]"
                  />
                </div>
              )}
              {property.landlordPhone && (
                <div className="flex items-center justify-between gap-2 rounded-xl bg-white px-3 py-2.5 shadow-sm">
                  <span className="shrink-0 text-[14px] font-bold text-gray-700">
                    집주인
                  </span>
                  <PhoneLink
                    phone={property.landlordPhone}
                    className="!text-[16px] !font-extrabold !text-[#03B26C]"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* 금액 · 관리비 (한 행, 낮은 높이) */}
        <div className="grid grid-cols-2 gap-2">
          <div className="flex min-h-[52px] flex-col justify-center rounded-xl bg-[#F9FAFB] px-3 py-2">
            <p className="text-[11px] font-bold leading-none text-gray-400">
              금액
            </p>
            <p className="mt-1 text-[15px] font-extrabold leading-snug tracking-tight text-gray-900">
              {formatDepositRent(
                property.dealType,
                property.deposit,
                property.monthlyRent
              )}
            </p>
          </div>
          <div className="flex min-h-[52px] flex-col justify-center rounded-xl bg-[#F9FAFB] px-3 py-2">
            <p className="text-[11px] font-bold leading-none text-gray-400">
              관리비
            </p>
            <p className="mt-1 text-[15px] font-extrabold leading-snug tracking-tight text-gray-900">
              {formatMoney(property.maintenanceFee)}
              {property.maintenanceIncludes.length > 0 ? (
                <span className="ml-1 text-[12px] font-semibold text-gray-500">
                  ({property.maintenanceIncludes.join(", ")})
                </span>
              ) : null}
            </p>
          </div>
        </div>

        {/* 비밀번호 */}
        <div className="divide-y divide-gray-100 rounded-2xl bg-[#F9FAFB] px-3.5">
          <div className="flex items-center justify-between gap-2 py-3">
            <span className="text-[14px] font-bold text-gray-500">
              1층 비밀번호
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

        {/* 조건 칩 */}
        <div className="flex flex-wrap gap-1.5">
          <StatusChip
            label="엘리베이터"
            value={property.elevator ? "유" : "무"}
            active={property.elevator}
          />
          <StatusChip
            label="보증보험"
            value={insuranceOn ? "유" : "무"}
            active={insuranceOn}
          />
          {moveInLabel ? (
            <StatusChip label="입주" value={moveInLabel} active />
          ) : null}
          <StatusChip
            label="주차"
            value={
              property.parkingType === "유"
                ? property.parkingFee != null && property.parkingFee > 0
                  ? `유 · ${formatMoney(property.parkingFee)}`
                  : "유"
                : "무"
            }
            active={property.parkingType === "유"}
          />
          <StatusChip
            label="애완동물"
            value={property.petAllowed ?? "무"}
            active={property.petAllowed === "유"}
          />
          {property.options.map((opt) => (
            <span key={opt} className={chipOption}>
              {opt}
            </span>
          ))}
        </div>

        {property.notes?.trim() ? (
          <div className="rounded-2xl bg-[#F9FAFB] px-3.5 py-3">
            <p className="text-[12px] font-bold text-gray-400">추가내용</p>
            <p className="mt-1 whitespace-pre-wrap text-[14px] font-medium leading-relaxed text-gray-800">
              {property.notes}
            </p>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
