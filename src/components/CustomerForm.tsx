"use client";

import { FormEvent, useState } from "react";
import type {
  Customer,
  DealType,
  ParkingType,
  PetAllowed,
  RoomType,
} from "@/lib/types";
import { LOAN_TYPES, ROOM_TYPES } from "@/lib/constants";
import { createId } from "@/lib/id";
import { formatDepositRent, formatMoveInRange } from "@/lib/format";
import { Input, Select, TextArea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StickyActionBar } from "@/components/StickyActionBar";
import { DealTypeToggle } from "@/components/DealTypeToggle";
import { OptionToggle } from "@/components/OptionToggle";
import { DatePicker } from "@/components/DatePicker";
import { DateRangePicker } from "@/components/DateRangePicker";
import { PhoneInput } from "@/components/PhoneInput";
import { formatPhoneInput } from "@/lib/format";

const FORM_ID = "customer-form";

interface CustomerFormProps {
  initial?: Customer;
  onSubmit: (customer: Customer) => void;
  submitLabel?: string;
}

export function CustomerForm({
  initial,
  onSubmit,
  submitLabel = "저장하기",
}: CustomerFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [phone, setPhone] = useState(formatPhoneInput(initial?.phone ?? ""));
  const [dealType, setDealType] = useState<DealType>(
    initial?.dealType ?? "전세"
  );
  const [roomType, setRoomType] = useState<RoomType>(
    initial?.roomType ?? "원룸"
  );
  const [deposit, setDeposit] = useState<number>(initial?.deposit ?? 0);
  const [monthlyRent, setMonthlyRent] = useState<number>(
    initial?.monthlyRent ?? 0
  );
  const [nonOccupancy, setNonOccupancy] = useState(
    initial?.nonOccupancy ?? false
  );
  const [moveInFrom, setMoveInFrom] = useState(
    initial?.moveInFrom ?? initial?.moveInDate ?? ""
  );
  const [moveInTo, setMoveInTo] = useState(initial?.moveInTo ?? "");
  const [moveInSingle, setMoveInSingle] = useState(() => {
    if (initial?.moveInSingle != null) return initial.moveInSingle;
    if (initial?.moveInFrom && initial?.moveInTo) {
      return initial.moveInFrom === initial.moveInTo;
    }
    return false;
  });
  const [loanType, setLoanType] = useState(initial?.loanType ?? "해당없음");
  const [parkingType, setParkingType] = useState<ParkingType>(
    initial?.parkingType === "유" ? "유" : "무"
  );
  const [petAllowed, setPetAllowed] = useState<PetAllowed>(
    initial?.petAllowed ?? "무"
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");

  const isLandOrBuilding = roomType === "토지" || roomType === "건물";
  const effectiveDealType: DealType = isLandOrBuilding ? "매매" : dealType;

  const handleDealTypeChange = (next: DealType) => {
    setDealType(next);
    if (next !== "매매") setNonOccupancy(false);
    if (next !== "월세") setMonthlyRent(0);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const savedDealType: DealType = isLandOrBuilding ? "매매" : dealType;
    const isNonOccupancy = savedDealType === "매매" && nonOccupancy;
    const toDate = moveInSingle ? moveInFrom : moveInTo;
    if (!isNonOccupancy) {
      if (!moveInFrom || (!moveInSingle && !moveInTo)) {
        alert("희망 입주일을 선택해 주세요.");
        return;
      }
      if (!moveInSingle && moveInTo < moveInFrom) {
        alert("종료일은 시작일 이후로 선택해 주세요.");
        return;
      }
    }
    const now = new Date().toISOString();
    const rent =
      savedDealType === "월세" ? monthlyRent || undefined : undefined;
    onSubmit({
      id: initial?.id ?? createId("cus"),
      name: name.trim(),
      phone: formatPhoneInput(phone),
      dealType: savedDealType,
      roomType,
      deposit,
      monthlyRent: rent,
      budget: formatDepositRent(savedDealType, deposit, rent),
      moveInFrom: isNonOccupancy ? "" : moveInFrom,
      moveInTo: isNonOccupancy ? "" : toDate,
      moveInSingle: isNonOccupancy ? undefined : moveInSingle,
      moveInDate: isNonOccupancy
        ? "비입주"
        : formatMoveInRange(moveInFrom, toDate),
      nonOccupancy: isNonOccupancy,
      loanType:
        roomType === "상가" ||
        roomType === "사무실" ||
        isLandOrBuilding
          ? "해당없음"
          : loanType,
      parkingType,
      petAllowed,
      notes: notes.trim(),
      contractCompleted: initial?.contractCompleted,
      createdAt: initial?.createdAt ?? now,
      updatedAt: now,
    });
  };

  return (
    <>
    <form id={FORM_ID} onSubmit={handleSubmit} className="space-y-3 pb-2">
      <Card className="space-y-2.5">
        <Input
          label="고객명 또는 명칭"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="홍길동"
        />
        <PhoneInput
          label="전화번호"
          required
          value={phone}
          onChange={setPhone}
          hint="숫자만 입력해도 - 가 자동으로 붙어요 · 저장 후 원클릭 전화"
        />
        <OptionToggle
          label="거래유형"
          required
          value={roomType}
          options={ROOM_TYPES}
          onChange={(next) => {
            setRoomType(next);
            if (
              next === "상가" ||
              next === "사무실" ||
              next === "토지" ||
              next === "건물"
            ) {
              setLoanType("해당없음");
            }
            if (next === "토지" || next === "건물") {
              setDealType("매매");
              setMonthlyRent(0);
            }
            if (next === "토지") {
              setParkingType("무");
            }
          }}
          columns={4}
        />
        <DealTypeToggle
          label="희망 거래 유형"
          required
          value={effectiveDealType}
          onChange={handleDealTypeChange}
          types={isLandOrBuilding ? (["매매"] as const) : undefined}
        />

        {effectiveDealType === "매매" ? (
          <>
            <Input
              label="매가 (만원)"
              required
              type="number"
              inputMode="numeric"
              value={deposit || ""}
              onChange={(e) => setDeposit(Number(e.target.value) || 0)}
              placeholder="50000"
              hint="예: 5억 → 50000"
            />
            <label className="flex min-h-[48px] items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-3.5 active:scale-[0.99] transition-all duration-150">
              <input
                type="checkbox"
                checked={nonOccupancy}
                onChange={(e) => setNonOccupancy(e.target.checked)}
                className="h-5 w-5 accent-[#3182F6]"
              />
              <span className="flex-1">
                <span className="block text-[15px] font-bold text-gray-900">
                  비입주
                </span>
                <span className="block text-xs text-gray-500">
                  입주 없이 매수만 하는 경우
                </span>
              </span>
            </label>
          </>
        ) : (
          <div
            className={
              effectiveDealType === "월세" ? "grid grid-cols-2 gap-2" : "space-y-2"
            }
          >
            <Input
              label="보증금 (만원)"
              required
              type="number"
              inputMode="numeric"
              value={deposit || ""}
              onChange={(e) => setDeposit(Number(e.target.value) || 0)}
              placeholder="10000"
              hint={effectiveDealType === "전세" ? "예: 1억 → 10000" : undefined}
            />
            {effectiveDealType === "월세" && (
              <Input
                label="월세 (만원)"
                required
                type="number"
                inputMode="numeric"
                value={monthlyRent || ""}
                onChange={(e) => setMonthlyRent(Number(e.target.value) || 0)}
                placeholder="50"
              />
            )}
          </div>
        )}

        {!(effectiveDealType === "매매" && nonOccupancy) && (
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[13px] font-semibold text-gray-600">
                희망 입주일
                <span className="ml-0.5 text-[#3182F6]">*</span>
              </p>
              <label className="flex items-center gap-2 active:scale-95 transition-all duration-150">
                <input
                  type="checkbox"
                  checked={moveInSingle}
                  onChange={(e) => {
                    const on = e.target.checked;
                    setMoveInSingle(on);
                    if (on && moveInFrom) {
                      setMoveInTo(moveInFrom);
                    }
                  }}
                  className="h-5 w-5 accent-[#3182F6]"
                />
                <span className="text-[14px] font-semibold text-gray-700">
                  단일
                </span>
              </label>
            </div>
            {moveInSingle ? (
              <DatePicker
                label=""
                required
                value={moveInFrom}
                onChange={(next) => {
                  setMoveInFrom(next);
                  setMoveInTo(next);
                }}
                placeholder="입주 날짜 선택"
              />
            ) : (
              <DateRangePicker
                label=""
                required
                from={moveInFrom}
                to={moveInTo}
                onChange={({ from, to }) => {
                  setMoveInFrom(from);
                  setMoveInTo(to);
                }}
              />
            )}
          </div>
        )}
        {!(
          roomType === "상가" ||
          roomType === "사무실" ||
          roomType === "토지" ||
          roomType === "건물"
        ) && (
          <Select
            label="대출 종류"
            value={loanType}
            onChange={(e) => setLoanType(e.target.value)}
          >
            {LOAN_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        )}
        {!(roomType === "토지" || roomType === "건물") && (
          <>
            <OptionToggle
              label="주차 유무"
              columns={2}
              value={parkingType}
              options={["유", "무"] as const}
              onChange={setParkingType}
            />
            <OptionToggle
              label="애완동물 유무"
              columns={2}
              value={petAllowed}
              options={["유", "무"] as const}
              onChange={setPetAllowed}
            />
          </>
        )}
        {roomType === "건물" && (
          <OptionToggle
            label="주차 유무"
            columns={2}
            value={parkingType}
            options={["유", "무"] as const}
            onChange={setParkingType}
          />
        )}
        <TextArea
          label="메모 / 특이사항"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={
            roomType === "토지" || roomType === "건물"
              ? "건폐율, 용적률, 현황, 향, 희망조건 등"
              : "현황, 향, 희망조건, 희망층수, 애완동물 등"
          }
        />
      </Card>
    </form>

    <StickyActionBar>
      <Button type="submit" form={FORM_ID} fullWidth size="lg">
        {submitLabel}
      </Button>
    </StickyActionBar>
    </>
  );
}
