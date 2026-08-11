"use client";

import { FormEvent, useMemo, useState } from "react";
import type {
  BuildingKind,
  CarType,
  Customer,
  DealType,
  ParkingType,
  PetAllowed,
  RoomType,
} from "@/lib/types";
import {
  BUILDING_KINDS,
  LOAN_KIND_OPTIONS,
  ROOM_TYPES,
  defaultRoomBathCounts,
  needsRoomBathCounts,
  normalizeBuildingKind,
  normalizeRoomType,
} from "@/lib/constants";
import { SITE_SHARE_UI_ENABLED } from "@/lib/siteShare";
import { createId } from "@/lib/id";
import {
  formatDepositRent,
  formatMoveInRange,
  formatPhoneInput,
  resolveCustomerLoanNeeded,
} from "@/lib/format";
import { findCustomerBySamePhone } from "@/lib/duplicateEntity";
import { useCustomersList } from "@/hooks/useEntityList";
import { Input, Select, TextArea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StickyActionBar } from "@/components/StickyActionBar";
import { SiteShareFormField } from "@/components/SiteShareUi";
import { DealTypeToggle } from "@/components/DealTypeToggle";
import { RoomBathCountFields } from "@/components/RoomBathCountFields";
import { CircleCheck } from "@/components/ui/CircleCheck";
import { OptionToggle } from "@/components/OptionToggle";
import { DatePicker } from "@/components/DatePicker";
import { DateRangePicker } from "@/components/DateRangePicker";
import { PhoneInput } from "@/components/PhoneInput";

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
  const { items: customers } = useCustomersList();
  const [name, setName] = useState(initial?.name ?? "");
  const [phone, setPhone] = useState(formatPhoneInput(initial?.phone ?? ""));
  const [dealType, setDealType] = useState<DealType>(
    initial?.dealType ?? "월세"
  );
  const [roomType, setRoomType] = useState<RoomType>(
    () => normalizeRoomType(initial?.roomType) ?? initial?.roomType ?? "원룸"
  );
  const [buildingKind, setBuildingKind] = useState<BuildingKind | "">(
    () => normalizeBuildingKind(initial?.buildingKind) ?? ""
  );
  const [roomCount, setRoomCount] = useState<number>(() => {
    const type =
      normalizeRoomType(initial?.roomType) ?? initial?.roomType ?? "원룸";
    if (initial?.roomCount && initial.roomCount > 0) return initial.roomCount;
    if (needsRoomBathCounts(type)) return defaultRoomBathCounts(type).roomCount;
    return 0;
  });
  const [bathroomCount, setBathroomCount] = useState<number>(() => {
    const type =
      normalizeRoomType(initial?.roomType) ?? initial?.roomType ?? "원룸";
    if (initial?.bathroomCount && initial.bathroomCount > 0) {
      return initial.bathroomCount;
    }
    if (needsRoomBathCounts(type)) {
      return defaultRoomBathCounts(type).bathroomCount;
    }
    return 1;
  });
  const [deposit, setDeposit] = useState<number>(initial?.deposit ?? 0);
  const [depositTo, setDepositTo] = useState<number>(
    () => initial?.depositTo ?? initial?.deposit ?? 0
  );
  const [depositSingle, setDepositSingle] = useState(() => {
    if (initial?.depositSingle != null) return initial.depositSingle;
    if (
      initial?.depositTo != null &&
      initial.depositTo > 0 &&
      initial.depositTo !== initial.deposit
    ) {
      return false;
    }
    return true;
  });
  const [monthlyRent, setMonthlyRent] = useState<number>(
    initial?.monthlyRent ?? 0
  );
  const [monthlyRentTo, setMonthlyRentTo] = useState<number>(
    () => initial?.monthlyRentTo ?? initial?.monthlyRent ?? 0
  );
  const [monthlyRentSingle, setMonthlyRentSingle] = useState(() => {
    if (initial?.monthlyRentSingle != null) return initial.monthlyRentSingle;
    if (
      initial?.monthlyRentTo != null &&
      initial.monthlyRentTo > 0 &&
      initial.monthlyRentTo !== (initial.monthlyRent ?? 0)
    ) {
      return false;
    }
    return true;
  });
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
  const [loanNeeded, setLoanNeeded] = useState<"유" | "무">(() =>
    resolveCustomerLoanNeeded(initial ?? {})
  );
  const [loanType, setLoanType] = useState(() => {
    const t = initial?.loanType?.trim();
    if (t && t !== "해당없음") return t;
    return LOAN_KIND_OPTIONS[0] ?? "기타";
  });
  const [parkingType, setParkingType] = useState<ParkingType>(
    initial?.parkingType === "유" ? "유" : "무"
  );
  const [carType, setCarType] = useState<CarType>(
    () => (initial?.carType === "SUV" ? "SUV" : "세단")
  );
  const [petAllowed, setPetAllowed] = useState<PetAllowed>(
    initial?.petAllowed ?? "무"
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [workspaceShared, setWorkspaceShared] = useState(
    initial?.workspaceShared === true
  );
  const [siteShared, setSiteShared] = useState(initial?.siteShared === true);

  const duplicateCustomer = useMemo(
    () => findCustomerBySamePhone(phone, customers, initial?.id),
    [phone, customers, initial?.id]
  );

  const isLandOrBuilding = roomType === "토지" || roomType === "건물";
  const effectiveDealType: DealType = isLandOrBuilding ? "매매" : dealType;

  const handleDealTypeChange = (next: DealType) => {
    setDealType(next);
    if (next !== "매매") setNonOccupancy(false);
    if (next !== "월세") {
      setMonthlyRent(0);
      setMonthlyRentTo(0);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const savedDealType: DealType = isLandOrBuilding ? "매매" : dealType;
    const isNonOccupancy = savedDealType === "매매" && nonOccupancy;
    const toDate = moveInSingle ? moveInFrom : moveInTo;
    if (roomType === "건물" && !buildingKind) {
      alert("건물 종류를 선택해 주세요.");
      return;
    }
    if (needsRoomBathCounts(roomType)) {
      const rooms = roomType === "투룸" ? 2 : roomCount;
      const min = roomType === "3룸+" ? 3 : 1;
      if (!rooms || rooms < min) {
        alert("방 수를 선택해 주세요.");
        return;
      }
    }
    if (!deposit || deposit <= 0) {
      alert(
        savedDealType === "매매"
          ? "매가를 입력해 주세요."
          : "보증금을 입력해 주세요."
      );
      return;
    }
    if (!depositSingle) {
      if (!depositTo || depositTo <= 0) {
        alert(
          savedDealType === "매매"
            ? "매가 종료 금액을 입력해 주세요."
            : "보증금 종료 금액을 입력해 주세요."
        );
        return;
      }
      if (depositTo < deposit) {
        alert("종료 금액은 시작 금액 이상으로 입력해 주세요.");
        return;
      }
    }
    if (savedDealType === "월세") {
      if (!monthlyRent || monthlyRent <= 0) {
        alert("월세를 입력해 주세요.");
        return;
      }
      if (!monthlyRentSingle) {
        if (!monthlyRentTo || monthlyRentTo <= 0) {
          alert("월세 종료 금액을 입력해 주세요.");
          return;
        }
        if (monthlyRentTo < monthlyRent) {
          alert("월세 종료 금액은 시작 금액 이상으로 입력해 주세요.");
          return;
        }
      }
    }
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
    const savedDepositTo = depositSingle ? deposit : depositTo;
    const savedRentTo =
      savedDealType === "월세"
        ? monthlyRentSingle
          ? monthlyRent
          : monthlyRentTo
        : undefined;
    onSubmit({
      id: initial?.id ?? createId("cus"),
      name: name.trim(),
      phone: formatPhoneInput(phone),
      dealType: savedDealType,
      roomType,
      buildingKind: roomType === "건물" ? buildingKind || undefined : undefined,
      roomCount: needsRoomBathCounts(roomType)
        ? roomType === "투룸"
          ? 2
          : roomCount
        : undefined,
      bathroomCount: needsRoomBathCounts(roomType) ? bathroomCount : undefined,
      deposit,
      depositTo: savedDepositTo,
      depositSingle,
      monthlyRent: rent,
      monthlyRentTo: savedDealType === "월세" ? savedRentTo : undefined,
      monthlyRentSingle: savedDealType === "월세" ? monthlyRentSingle : undefined,
      budget: formatDepositRent(
        savedDealType,
        deposit,
        rent,
        depositSingle ? undefined : savedDepositTo,
        savedDealType === "월세" && !monthlyRentSingle
          ? savedRentTo
          : undefined
      ),
      moveInFrom: isNonOccupancy ? "" : moveInFrom,
      moveInTo: isNonOccupancy ? "" : toDate,
      moveInSingle: isNonOccupancy ? undefined : moveInSingle,
      moveInDate: isNonOccupancy
        ? "비입주"
        : formatMoveInRange(moveInFrom, toDate),
      nonOccupancy: isNonOccupancy,
      loanNeeded:
        roomType === "상가" ||
        roomType === "사무실" ||
        isLandOrBuilding
          ? "무"
          : loanNeeded,
      loanType:
        roomType === "상가" ||
        roomType === "사무실" ||
        isLandOrBuilding ||
        loanNeeded === "무"
          ? "해당없음"
          : loanType,
      parkingType:
        roomType === "토지" || roomType === "건물" ? "무" : parkingType,
      carType:
        roomType === "토지" || roomType === "건물" || parkingType === "무"
          ? undefined
          : carType,
      petAllowed,
      notes: notes.trim(),
      workspaceShared,
      siteShared: SITE_SHARE_UI_ENABLED ? siteShared : false,
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
            labelRight={
              duplicateCustomer ? "동일 고객이 존재합니다" : undefined
            }
            hint="숫자만 입력해도 - 가 자동으로 붙어요 · 저장 후 원클릭 전화"
          />
          <OptionToggle
            label="매물 유형"
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
                setLoanNeeded("무");
              }
              if (next === "토지" || next === "건물") {
                setDealType("매매");
                setMonthlyRent(0);
                setMonthlyRentTo(0);
                setParkingType("무");
              } else if (roomType === "토지" || roomType === "건물") {
                setDealType("월세");
              }
              if (next !== "건물") {
                setBuildingKind("");
              }
              if (needsRoomBathCounts(next)) {
                const defaults = defaultRoomBathCounts(next);
                setRoomCount(defaults.roomCount);
                setBathroomCount(defaults.bathroomCount);
              } else {
                setRoomCount(0);
                setBathroomCount(1);
              }
            }}
            columns={4}
          />

          {roomType === "건물" ? (
            <OptionToggle
              label="건물 종류"
              required
              value={buildingKind || ("—" as BuildingKind)}
              options={BUILDING_KINDS}
              fit
              onChange={setBuildingKind}
            />
          ) : null}

          <RoomBathCountFields
            roomType={roomType}
            roomCount={roomCount}
            bathroomCount={bathroomCount}
            onChange={({ roomCount: nextRooms, bathroomCount: nextBaths }) => {
              setRoomCount(nextRooms);
              setBathroomCount(nextBaths);
            }}
          />

          <DealTypeToggle
            label="희망거래"
            required
            value={effectiveDealType}
            onChange={handleDealTypeChange}
            types={isLandOrBuilding ? (["매매"] as const) : undefined}
          />

          <div className="space-y-2">
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <p className="min-w-0 flex-1 truncate text-[13px] font-semibold text-gray-600">
                  {effectiveDealType === "매매" ? "매가 (만원)" : "보증금 (만원)"}
                  <span className="ml-0.5 text-[#3182F6]">*</span>
                  {effectiveDealType === "매매" ? (
                    <span className="ml-2 font-medium text-gray-400">
                      예: 5억 → 50000
                    </span>
                  ) : effectiveDealType === "전세" ? (
                    <span className="ml-2 font-medium text-gray-400">
                      예: 1억 → 10000
                    </span>
                  ) : null}
                </p>
                <label className="flex shrink-0 items-center gap-2 active:scale-95 transition-all duration-150">
                  <CircleCheck
                    checked={depositSingle}
                    onChange={(e) => {
                      const on = e.target.checked;
                      setDepositSingle(on);
                      if (on && deposit) {
                        setDepositTo(deposit);
                      }
                    }}
                  />
                  <span className="text-[14px] font-semibold text-gray-700">
                    단일
                  </span>
                </label>
              </div>
              {depositSingle ? (
                <Input
                  label=""
                  required
                  type="number"
                  inputMode="numeric"
                  value={deposit || ""}
                  onChange={(e) => {
                    const next = Number(e.target.value) || 0;
                    setDeposit(next);
                    setDepositTo(next);
                  }}
                  placeholder={
                    effectiveDealType === "매매" ? "50000" : "10000"
                  }
                />
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    label="부터"
                    required
                    type="number"
                    inputMode="numeric"
                    value={deposit || ""}
                    onChange={(e) =>
                      setDeposit(Number(e.target.value) || 0)
                    }
                    placeholder={
                      effectiveDealType === "매매" ? "40000" : "8000"
                    }
                  />
                  <Input
                    label="까지"
                    required
                    type="number"
                    inputMode="numeric"
                    value={depositTo || ""}
                    onChange={(e) =>
                      setDepositTo(Number(e.target.value) || 0)
                    }
                    placeholder={
                      effectiveDealType === "매매" ? "50000" : "10000"
                    }
                  />
                </div>
              )}
            </div>

            {effectiveDealType === "월세" ? (
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[13px] font-semibold text-gray-600">
                    월세 (만원)
                    <span className="ml-0.5 text-[#3182F6]">*</span>
                  </p>
                  <label className="flex items-center gap-2 active:scale-95 transition-all duration-150">
                    <CircleCheck
                      checked={monthlyRentSingle}
                      onChange={(e) => {
                        const on = e.target.checked;
                        setMonthlyRentSingle(on);
                        if (on && monthlyRent) {
                          setMonthlyRentTo(monthlyRent);
                        }
                      }}
                    />
                    <span className="text-[14px] font-semibold text-gray-700">
                      단일
                    </span>
                  </label>
                </div>
                {monthlyRentSingle ? (
                  <Input
                    label=""
                    required
                    type="number"
                    inputMode="numeric"
                    value={monthlyRent || ""}
                    onChange={(e) => {
                      const next = Number(e.target.value) || 0;
                      setMonthlyRent(next);
                      setMonthlyRentTo(next);
                    }}
                    placeholder="50"
                  />
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      label="부터"
                      required
                      type="number"
                      inputMode="numeric"
                      value={monthlyRent || ""}
                      onChange={(e) =>
                        setMonthlyRent(Number(e.target.value) || 0)
                      }
                      placeholder="40"
                    />
                    <Input
                      label="까지"
                      required
                      type="number"
                      inputMode="numeric"
                      value={monthlyRentTo || ""}
                      onChange={(e) =>
                        setMonthlyRentTo(Number(e.target.value) || 0)
                      }
                      placeholder="60"
                    />
                  </div>
                )}
              </div>
            ) : null}

            {effectiveDealType === "매매" ? (
              <label className="flex min-h-[48px] items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-3.5 active:scale-[0.99] transition-all duration-150">
                <CircleCheck
                  checked={nonOccupancy}
                  onChange={(e) => setNonOccupancy(e.target.checked)}
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
            ) : null}
          </div>

          {!(effectiveDealType === "매매" && nonOccupancy) && (
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[13px] font-semibold text-gray-600">
                  희망 입주일
                  <span className="ml-0.5 text-[#3182F6]">*</span>
                </p>
                <label className="flex items-center gap-2 active:scale-95 transition-all duration-150">
                  <CircleCheck
                    checked={moveInSingle}
                    onChange={(e) => {
                      const on = e.target.checked;
                      setMoveInSingle(on);
                      if (on && moveInFrom) {
                        setMoveInTo(moveInFrom);
                      }
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
                    if (from && to && from === to) {
                      setMoveInSingle(true);
                    }
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
            <>
              <OptionToggle
                label="대출 유무"
                columns={2}
                value={loanNeeded}
                options={["유", "무"] as const}
                onChange={(next) => {
                  setLoanNeeded(next);
                  if (next === "유" && (!loanType || loanType === "해당없음")) {
                    setLoanType(LOAN_KIND_OPTIONS[0] ?? "기타");
                  }
                }}
              />
              {loanNeeded === "유" ? (
                <Select
                  label="대출 종류"
                  value={loanType}
                  onChange={(e) => setLoanType(e.target.value)}
                  hint="상담·기록용 · 매물 매칭에는 사용하지 않아요"
                >
                  {LOAN_KIND_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>
              ) : null}
            </>
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
              {parkingType === "유" ? (
                <OptionToggle
                  label="차종"
                  required
                  columns={2}
                  value={carType}
                  options={["세단", "SUV"] as const}
                  onChange={setCarType}
                />
              ) : null}
              <OptionToggle
                label="애완동물 유무"
                columns={2}
                value={petAllowed}
                options={["유", "무"] as const}
                onChange={setPetAllowed}
              />
            </>
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
          <OptionToggle
            label="팀공유 유무"
            columns={2}
            value={workspaceShared ? "유" : "무"}
            options={["유", "무"] as const}
            onChange={(v) => setWorkspaceShared(v === "유")}
          />
          <SiteShareFormField
            value={siteShared}
            onChange={setSiteShared}
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
