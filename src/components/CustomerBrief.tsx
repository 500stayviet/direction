"use client";

import type { Customer } from "@/lib/types";
import {
  needsRoomBathCounts,
  normalizeRoomType,
} from "@/lib/constants";
import {
  getCustomerBudgetLabel,
  getCustomerLoanLabel,
  getCustomerMoveInLabel,
  getCustomerParkingLabel,
  yesNoLabel,
} from "@/lib/format";
import { Card } from "@/components/ui/Card";
import { PhoneLink } from "@/components/PhoneLink";
import { ListEdgeChips } from "@/components/ListEdgeChips";
import { CustomerPreferredLocationBlock } from "@/components/CustomerPreferredLocationBlock";
import { preferredLocationRows } from "@/lib/preferredLocation";

const chipBase =
  "inline-flex items-center rounded-full px-3.5 py-2 text-[14px] font-bold leading-none tracking-tight";
const chipOn = `${chipBase} bg-[#3182F6]/12 text-gray-900`;
const chipOff = `${chipBase} bg-[#F2F4F6] text-gray-500`;

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

/** 매물 PropertyBrief와 같은 톤의 고객 상세 카드 */
export function CustomerBrief({ customer }: { customer: Customer }) {
  const roomNorm = normalizeRoomType(customer.roomType) ?? customer.roomType;
  const showRoomBath = needsRoomBathCounts(roomNorm);
  const preferredRows = preferredLocationRows(customer);
  const showLoanInsurancePet = !(
    customer.roomType === "상가" ||
    customer.roomType === "사무실" ||
    customer.roomType === "토지" ||
    customer.roomType === "건물"
  );
  const showParking =
    customer.roomType !== "토지" && customer.roomType !== "건물";
  const showElevator = customer.roomType !== "토지";
  const parkingLabel = getCustomerParkingLabel(customer);
  const loanLabel = getCustomerLoanLabel(customer);
  const insuranceLabel = yesNoLabel(customer.insuranceNeeded);
  const elevatorLabel = yesNoLabel(customer.elevatorNeeded);

  return (
    <div className="relative pt-3">
      <div className="pointer-events-none absolute inset-x-2 top-3 z-10 flex -translate-y-1/2 items-center gap-1 overflow-hidden">
        <ListEdgeChips
          placement="inline"
          roomType={customer.roomType}
          buildingKind={customer.buildingKind}
          dealType={customer.dealType}
        />
      </div>

      <Card className="space-y-0 !overflow-visible !p-0">
        <div className="relative z-10 pt-4" />

        <div className="space-y-3 px-4 pb-4 pt-2">
          {/* 이름 · 전화 — 카드(원룸·전세 칩) 안, 별도 박스 없음 */}
          <div className="flex items-center justify-between gap-3 pt-1">
            <p className="min-w-0 flex-1 truncate text-[20px] font-extrabold leading-snug tracking-tight text-gray-900">
              {customer.name.trim() || "이름 미입력"}
            </p>
            {customer.phone?.trim() ? (
              <PhoneLink
                phone={customer.phone}
                className="!shrink-0 !text-[16px] !font-extrabold !text-[#03B26C]"
              />
            ) : (
              <span className="shrink-0 text-[13px] font-semibold text-gray-400">
                번호 없음
              </span>
            )}
          </div>

          {/* 금액 → 선호위치 → 지목 → 방 → 입주희망 */}
          <div
            className="grid grid-cols-2 gap-2"
            data-testid="customer-brief-meta"
          >
            <div
              className="col-span-2 flex min-h-[52px] flex-col justify-center rounded-xl bg-[#F9FAFB] px-3 py-2"
              data-testid="customer-brief-amount"
            >
              <p className="text-[11px] font-bold leading-none text-gray-400">
                금액
              </p>
              <p className="mt-1 text-[15px] font-extrabold leading-snug tracking-tight text-gray-900">
                {getCustomerBudgetLabel(customer)}
              </p>
            </div>
            {preferredRows.length > 0 ? (
              <div
                className="col-span-2 flex min-h-[44px] flex-col justify-center rounded-xl bg-[#F9FAFB] px-3 py-2"
                data-testid="customer-brief-preferred"
              >
                <CustomerPreferredLocationBlock customer={customer} />
              </div>
            ) : null}
            {customer.roomType === "토지" && customer.landCategory?.trim() ? (
              <div
                className="col-span-2 flex min-h-[44px] flex-col justify-center rounded-xl bg-[#F9FAFB] px-3 py-2"
                data-testid="customer-brief-land-category"
              >
                <p className="text-[11px] font-bold leading-none text-gray-400">
                  지목
                </p>
                <p className="mt-1 text-[14px] font-extrabold leading-snug tracking-tight text-gray-900">
                  {customer.landCategory.trim()}
                </p>
              </div>
            ) : null}
            {showRoomBath ? (
              <div className="col-span-2 flex min-h-[44px] flex-col justify-center rounded-xl bg-[#F9FAFB] px-3 py-2">
                <p className="text-[11px] font-bold leading-none text-gray-400">
                  방 · 화장실
                </p>
                <p className="mt-1 text-[14px] font-extrabold leading-snug tracking-tight text-gray-900">
                  방 {roomNorm === "투룸" ? 2 : customer.roomCount ?? "-"}개
                  {" · "}
                  화장실 {customer.bathroomCount ?? 1}개
                </p>
              </div>
            ) : null}
            <div
              className="col-span-2 flex min-h-[44px] flex-col justify-center rounded-xl bg-[#F9FAFB] px-3 py-2"
              data-testid="customer-brief-movein"
            >
              <p className="text-[11px] font-bold leading-none text-gray-400">
                입주희망
              </p>
              <p className="mt-1 text-[14px] font-extrabold leading-snug tracking-tight text-gray-900">
                {getCustomerMoveInLabel(customer) || "-"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {showLoanInsurancePet ? (
              <StatusChip
                label="대출"
                value={loanLabel}
                active={loanLabel !== "무" && loanLabel !== "-"}
              />
            ) : null}
            {showLoanInsurancePet ? (
              <StatusChip
                label="보증보험"
                value={insuranceLabel}
                active={insuranceLabel === "유"}
              />
            ) : null}
            {showParking ? (
              <StatusChip
                label="주차"
                value={parkingLabel}
                active={
                  parkingLabel !== "무" &&
                  parkingLabel !== "-" &&
                  !parkingLabel.startsWith("무")
                }
              />
            ) : null}
            {showElevator ? (
              <StatusChip
                label="엘리베이터"
                value={elevatorLabel}
                active={elevatorLabel === "유"}
              />
            ) : null}
          </div>

          <div className="rounded-2xl bg-[#F9FAFB] px-3.5 py-3">
            <p className="text-[12px] font-bold text-gray-400">메모</p>
            <p className="mt-1 whitespace-pre-wrap text-[14px] font-medium leading-relaxed text-gray-800">
              {customer.notes?.trim() || "-"}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
