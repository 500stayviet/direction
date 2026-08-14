"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type {
  BuildingKind,
  CarType,
  Customer,
  DealType,
  ParkingType,
  RoomType,
} from "@/lib/types";
import {
  BUILDING_KINDS,
  ROOM_TYPES,
  defaultRoomBathCounts,
  needsRoomBathCounts,
  normalizeBuildingKind,
  normalizeRoomType,
} from "@/lib/constants";
import { createId } from "@/lib/id";
import { formatDepositRent, formatMoveInRange, formatPhoneInput, onlyDigits, resolveCustomerLoanNeeded } from "@/lib/format";
import { findCustomerBySamePhone } from "@/lib/duplicateEntity";
import {
  getCustomerFieldMessage,
  getMissingCustomerFields,
  type CustomerFieldKey,
} from "@/lib/customerValidation";
import { useCustomersList } from "@/hooks/useEntityList";
import { Input, TextArea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { RequiredFieldWarnModal } from "@/components/RequiredFieldWarnModal";
import { StickyActionBar } from "@/components/StickyActionBar";
import { SiteShareFormField } from "@/components/SiteShareUi";
import { DealTypeToggle } from "@/components/DealTypeToggle";
import { RoomBathCountFields } from "@/components/RoomBathCountFields";
import { CircleCheck } from "@/components/ui/CircleCheck";
import { OptionToggle } from "@/components/OptionToggle";
import { DatePicker } from "@/components/DatePicker";
import { DateRangePicker } from "@/components/DateRangePicker";
import { PhoneInput } from "@/components/PhoneInput";
import { LandCategoryPicker } from "@/components/LandCategoryPicker";
import { PreferredLocationPicker } from "@/components/PreferredLocationPicker";
import {
  completedPreferredGus,
  defaultPreferredLocation,
} from "@/lib/preferredLocation";
import { customerMemoPlaceholder } from "@/lib/memoPlaceholders";
import {
  intakeMoveInPeriod,
  intakePreferredLocation,
  parseIntakeText,
} from "@/lib/intakeParse";
import { filledSectionClass } from "@/lib/uiInvalid";
import { IntakeSourceBar, type IntakeMethod } from "@/components/IntakeSourceBar";
import { IntakeResetModal } from "@/components/IntakeResetModal";
import { IntakeMessageModal } from "@/components/IntakeMessageModal";
import { IntakeTalkModal } from "@/components/IntakeTalkModal";

const IntakePhotoPicker = dynamic(
  () =>
    import("@/components/IntakePhotoPicker").then((m) => m.IntakePhotoPicker),
  { ssr: false }
);

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
  const [dealType, setDealType] = useState<DealType | "">(
    initial?.dealType ?? ""
  );
  const [roomType, setRoomType] = useState<RoomType | "">(
    () => normalizeRoomType(initial?.roomType) ?? initial?.roomType ?? ""
  );
  const [buildingKind, setBuildingKind] = useState<BuildingKind | "">(
    () => normalizeBuildingKind(initial?.buildingKind) ?? ""
  );
  const [roomCount, setRoomCount] = useState<number>(() => {
    const type =
      normalizeRoomType(initial?.roomType) ?? initial?.roomType ?? "";
    if (initial?.roomCount && initial.roomCount > 0) return initial.roomCount;
    if (needsRoomBathCounts(type)) return defaultRoomBathCounts(type).roomCount;
    return 0;
  });
  const [bathroomCount, setBathroomCount] = useState<number>(() => {
    const type =
      normalizeRoomType(initial?.roomType) ?? initial?.roomType ?? "";
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
  const [loanNeeded, setLoanNeeded] = useState<"유" | "무" | "">(() => {
    if (!initial) return "";
    return resolveCustomerLoanNeeded(initial);
  });
  const [parkingType, setParkingType] = useState<"유" | "무" | "">(
    initial?.parkingType === "유" || initial?.parkingType === "무"
      ? initial.parkingType
      : initial
        ? "무"
        : ""
  );
  const [carType, setCarType] = useState<CarType>(
    () => (initial?.carType === "SUV" ? "SUV" : "세단")
  );
  const [insuranceNeeded, setInsuranceNeeded] = useState<"유" | "무" | "">(
    initial?.insuranceNeeded === "유" || initial?.insuranceNeeded === "무"
      ? initial.insuranceNeeded
      : initial
        ? "무"
        : ""
  );
  const [elevatorNeeded, setElevatorNeeded] = useState<"유" | "무" | "">(
    initial?.elevatorNeeded === "유" || initial?.elevatorNeeded === "무"
      ? initial.elevatorNeeded
      : initial
        ? "무"
        : ""
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [landCategory, setLandCategory] = useState(
    initial?.landCategory ?? ""
  );
  const [preferredGus, setPreferredGus] = useState<string[]>(() => {
    if (initial?.preferredGus?.length) return initial.preferredGus;
    if (initial?.preferredDongs?.length) {
      return completedPreferredGus([], initial.preferredDongs);
    }
    if (initial) return [];
    return defaultPreferredLocation().preferredGus;
  });
  const [preferredDongs, setPreferredDongs] = useState<string[]>(() => {
    if (initial?.preferredDongs?.length) return initial.preferredDongs;
    if (initial) return [];
    return defaultPreferredLocation().preferredDongs;
  });
  const preferredRef = useRef({
    preferredGus,
    preferredDongs,
  });
  preferredRef.current = { preferredGus, preferredDongs };
  const [workspaceShared, setWorkspaceShared] = useState(
    initial ? initial.workspaceShared === true : false
  );
  const [validationActive, setValidationActive] = useState(false);
  const [focusField, setFocusField] = useState<CustomerFieldKey | null>(null);
  const [warnOpen, setWarnOpen] = useState(false);
  const [warnMessage, setWarnMessage] = useState("");
  const fieldRefs = useRef<Partial<Record<CustomerFieldKey, HTMLDivElement | null>>>({});
  const warnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [filledFromIntake, setFilledFromIntake] = useState(false);
  const [phoneNonce, setPhoneNonce] = useState(0);
  const [resetOpen, setResetOpen] = useState(false);
  const [pendingMethod, setPendingMethod] = useState<IntakeMethod | null>(null);
  const [messageOpen, setMessageOpen] = useState(false);
  const [talkOpen, setTalkOpen] = useState(false);
  const [photoRequestId, setPhotoRequestId] = useState(0);
  const [photoError, setPhotoError] = useState("");

  const duplicateCustomer = useMemo(
    () => findCustomerBySamePhone(phone, customers, initial?.id),
    [phone, customers, initial?.id]
  );

  const isLandOrBuilding = roomType === "토지" || roomType === "건물";
  const effectiveDealType: DealType | "" = isLandOrBuilding
    ? "매매"
    : dealType;

  const handleDealTypeChange = (next: DealType) => {
    setDealType(next);
    if (next !== "매매") setNonOccupancy(false);
    if (next !== "월세") {
      setMonthlyRent(0);
      setMonthlyRentTo(0);
    }
  };

  const applyRoomType = (next: RoomType) => {
    setRoomType(next);
    if (
      next === "상가" ||
      next === "사무실" ||
      next === "토지" ||
      next === "건물"
    ) {
      setLoanNeeded("무");
    }
    if (next === "토지" || next === "건물") {
      setDealType("매매");
      setMonthlyRent(0);
      setMonthlyRentTo(0);
      setParkingType("무");
    } else if (roomType === "토지" || roomType === "건물") {
      setDealType("");
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
  };

  const formHasContent = Boolean(
    filledFromIntake ||
      name.trim() ||
      onlyDigits(phone).length >= 7 ||
      notes.trim() ||
      deposit > 0 ||
      preferredDongs.length > 0
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

  const resetCustomerDraft = () => {
    setName("");
    setPhone("");
    setDealType("");
    setRoomType("");
    setBuildingKind("");
    setRoomCount(0);
    setBathroomCount(1);
    setDeposit(0);
    setDepositTo(0);
    setDepositSingle(true);
    setMonthlyRent(0);
    setMonthlyRentTo(0);
    setMonthlyRentSingle(true);
    setNonOccupancy(false);
    setMoveInFrom("");
    setMoveInTo("");
    setMoveInSingle(false);
    setLoanNeeded("");
    setInsuranceNeeded("");
    setParkingType("");
    setCarType("세단");
    setElevatorNeeded("");
    setNotes("");
    setLandCategory("");
    const loc = defaultPreferredLocation();
    setPreferredGus(loc.preferredGus);
    setPreferredDongs(loc.preferredDongs);
    preferredRef.current = loc;
    setWorkspaceShared(false);
    setFilledFromIntake(false);
    setValidationActive(false);
    setPhotoError("");
  };

  const applyIntakeText = (raw: string) => {
    const parsed = parseIntakeText(raw, "customer");
    const nextPhone =
      parsed.phone || parsed.tenantPhone || parsed.landlordPhone || "";
    if (nextPhone) {
      setPhone(formatPhoneInput(nextPhone));
      setPhoneNonce((n) => n + 1);
    }
    if (parsed.roomType) applyRoomType(parsed.roomType);
    if (parsed.roomCount && needsRoomBathCounts(parsed.roomType)) {
      setRoomCount(parsed.roomCount);
    }
    if (parsed.bathroomCount && needsRoomBathCounts(parsed.roomType)) {
      setBathroomCount(parsed.bathroomCount);
    }
    if (parsed.dealType) handleDealTypeChange(parsed.dealType);
    if (parsed.deposit && parsed.deposit > 0) {
      setDeposit(parsed.deposit);
      if (parsed.depositTo && parsed.depositTo !== parsed.deposit) {
        setDepositTo(parsed.depositTo);
        setDepositSingle(false);
      } else {
        setDepositTo(parsed.deposit);
        setDepositSingle(true);
      }
    }
    if (parsed.monthlyRent && parsed.monthlyRent > 0) {
      setMonthlyRent(parsed.monthlyRent);
      if (parsed.monthlyRentTo && parsed.monthlyRentTo !== parsed.monthlyRent) {
        setMonthlyRentTo(parsed.monthlyRentTo);
        setMonthlyRentSingle(false);
      } else {
        setMonthlyRentTo(parsed.monthlyRent);
        setMonthlyRentSingle(true);
      }
      if (!parsed.dealType) handleDealTypeChange("월세");
    }
    const loc = intakePreferredLocation(parsed);
    if (loc.preferredDongs.length > 0 || loc.preferredGus.length > 0) {
      setPreferredGus(loc.preferredGus);
      setPreferredDongs(loc.preferredDongs);
      preferredRef.current = loc;
    }
    const move = intakeMoveInPeriod(parsed);
    if (move) {
      setMoveInFrom(move.from);
      setMoveInTo(move.to);
      setMoveInSingle(move.single);
    }
    if (parsed.loan) setLoanNeeded(parsed.loan);
    if (parsed.insurance) setInsuranceNeeded(parsed.insurance);
    if (parsed.parking) setParkingType(parsed.parking);
    if (parsed.elevator) setElevatorNeeded(parsed.elevator);
    if (parsed.workspaceShared) setWorkspaceShared(parsed.workspaceShared === "유");
    if (parsed.notes) {
      setNotes((prev) => (prev.trim() ? `${prev.trim()}\n${parsed.notes}` : parsed.notes));
    }
    setFilledFromIntake(true);
    setValidationActive(true);
    setMessageOpen(false);
    setTalkOpen(false);
  };

  const customerInput = {
    name,
    phone,
    roomType,
    buildingKind,
    roomCount,
    dealType: effectiveDealType,
    deposit,
    depositTo,
    depositSingle,
    monthlyRent,
    monthlyRentTo,
    monthlyRentSingle,
    nonOccupancy,
    moveInFrom,
    moveInTo,
    moveInSingle,
    parkingType,
    carType,
    loanNeeded,
    insuranceNeeded,
    workspaceShared,
    preferredGus,
    preferredDongs,
  };

  const missingFields = validationActive
    ? getMissingCustomerFields(customerInput)
    : [];
  const isInvalid = (key: CustomerFieldKey) => missingFields.includes(key);

  useEffect(() => {
    if (!validationActive || !focusField) return;
    fieldRefs.current[focusField]?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [validationActive, focusField]);

  const setFieldRef =
    (key: CustomerFieldKey) => (node: HTMLDivElement | null) => {
      fieldRefs.current[key] = node;
    };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const savedDealType: DealType | "" = isLandOrBuilding ? "매매" : dealType;
    const isNonOccupancy = savedDealType === "매매" && nonOccupancy;
    const toDate = moveInSingle ? moveInFrom : moveInTo;
    const preferredSnap = preferredRef.current;
    const missing = getMissingCustomerFields({
      ...customerInput,
      dealType: savedDealType,
      preferredGus: preferredSnap.preferredGus,
      preferredDongs: preferredSnap.preferredDongs,
    });
    if (missing.length > 0) {
      const field = missing[0];
      setValidationActive(true);
      setFocusField(field);
      setWarnMessage(getCustomerFieldMessage(field, savedDealType));
      if (warnTimer.current) clearTimeout(warnTimer.current);
      warnTimer.current = setTimeout(() => setWarnOpen(true), 350);
      return;
    }
    if (!roomType || !savedDealType) return;
    setValidationActive(false);
    setWarnOpen(false);
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
    const doneGus = completedPreferredGus(
      preferredSnap.preferredGus,
      preferredSnap.preferredDongs
    );
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
          : (loanNeeded as ParkingType),
      loanType:
        roomType === "상가" ||
        roomType === "사무실" ||
        isLandOrBuilding ||
        loanNeeded === "무"
          ? "해당없음"
          : "",
      insuranceNeeded:
        roomType === "상가" ||
        roomType === "사무실" ||
        isLandOrBuilding
          ? "무"
          : (insuranceNeeded as ParkingType),
      elevatorNeeded:
        roomType === "토지"
          ? "무"
          : elevatorNeeded === "유" || elevatorNeeded === "무"
            ? elevatorNeeded
            : undefined,
      parkingType:
        roomType === "토지" || roomType === "건물"
          ? "무"
          : (parkingType as ParkingType),
      carType:
        roomType === "토지" || roomType === "건물" || parkingType === "무"
          ? undefined
          : carType,
      petAllowed: "무",
      notes: notes.trim(),
      landCategory:
        roomType === "토지" ? landCategory.trim() || undefined : undefined,
      preferredGus: doneGus.length > 0 ? doneGus : undefined,
      preferredDongs:
        preferredSnap.preferredDongs.length > 0
          ? preferredSnap.preferredDongs
          : undefined,
      workspaceShared: workspaceShared === true,
      siteShared: initial?.siteShared === true,
      contractCompleted: initial?.contractCompleted,
      createdAt: initial?.createdAt ?? now,
      updatedAt: now,
    });
  };

  return (
    <>
      <form
        id={FORM_ID}
        noValidate
        onSubmit={handleSubmit}
        className="space-y-3 pb-2"
      >
        <IntakeSourceBar onSelect={requestIntake} />
        {photoError ? (
          <p className="-mt-1 text-[12px] font-semibold text-red-400">
            {photoError}
          </p>
        ) : null}
        <IntakePhotoPicker
          requestId={photoRequestId}
          onText={applyIntakeText}
          onError={setPhotoError}
        />
        <Card className="space-y-2.5">
          <div ref={setFieldRef("name")}>
            <Input
              label="고객명 또는 명칭"
              required
              invalid={isInvalid("name")}
              hint={isInvalid("name") ? "직접 입력" : undefined}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="홍길동"
            />
          </div>
          <div
            ref={setFieldRef("phone")}
            className={
              filledFromIntake && phone && !isInvalid("phone")
                ? filledSectionClass
                : ""
            }
          >
            <PhoneInput
              key={phoneNonce}
              label="전화번호"
              required
              invalid={isInvalid("phone")}
              invalidHint="직접 입력"
              accent={filledFromIntake && Boolean(phone)}
              value={phone}
              onChange={setPhone}
              labelRight={
                duplicateCustomer ? "동일 고객이 존재합니다" : undefined
              }
              hint="숫자만 입력해도 - 가 자동으로 붙어요 · 저장 후 원클릭 전화"
            />
          </div>
          <div ref={setFieldRef("roomType")}>
          <OptionToggle
            label="매물 유형"
            required
            compact={filledFromIntake}
            filled={filledFromIntake && Boolean(roomType)}
            invalid={isInvalid("roomType")}
            value={roomType || undefined}
            options={ROOM_TYPES}
            onChange={applyRoomType}
            columns={4}
          />
          </div>

          {roomType === "건물" ? (
            <div ref={setFieldRef("buildingKind")}>
              <OptionToggle
                label="건물 종류"
                required
                compact={filledFromIntake}
                filled={filledFromIntake && Boolean(buildingKind)}
                invalid={isInvalid("buildingKind")}
                value={buildingKind || ("—" as BuildingKind)}
                options={BUILDING_KINDS}
                fit
                onChange={setBuildingKind}
              />
            </div>
          ) : null}

          <div
            ref={setFieldRef("roomCount")}
            className={
              filledFromIntake && needsRoomBathCounts(roomType)
                ? filledSectionClass
                : ""
            }
          >
            <RoomBathCountFields
              roomType={roomType}
              roomCount={roomCount}
              bathroomCount={bathroomCount}
              invalidRoomCount={isInvalid("roomCount")}
              filled={filledFromIntake && needsRoomBathCounts(roomType)}
              onChange={({ roomCount: nextRooms, bathroomCount: nextBaths }) => {
                setRoomCount(nextRooms);
                setBathroomCount(nextBaths);
              }}
            />
          </div>

          <div
            ref={setFieldRef("dealType")}
            className={
              filledFromIntake && Boolean(effectiveDealType)
                ? filledSectionClass
                : ""
            }
          >
          <DealTypeToggle
            label="거래종류"
            required
            compact={filledFromIntake}
            invalid={isInvalid("dealType")}
            value={effectiveDealType}
            onChange={handleDealTypeChange}
            types={isLandOrBuilding ? (["매매"] as const) : undefined}
          />
          </div>

          {roomType === "토지" ? (
            <LandCategoryPicker
              value={landCategory}
              onChange={setLandCategory}
            />
          ) : null}

          <div
            ref={setFieldRef("preferredLocation")}
            className={
              filledFromIntake && preferredDongs.length > 0
                ? filledSectionClass
                : ""
            }
          >
            <PreferredLocationPicker
              preferredGus={preferredGus}
              preferredDongs={preferredDongs}
              invalid={isInvalid("preferredLocation")}
              accent={filledFromIntake}
              onChange={({ preferredGus: nextGus, preferredDongs: nextDongs }) => {
                preferredRef.current = {
                  preferredGus: nextGus,
                  preferredDongs: nextDongs,
                };
                setPreferredGus(nextGus);
                setPreferredDongs(nextDongs);
              }}
            />
          </div>

          <div className="space-y-2">
            <div
              className={[
                "space-y-1",
                filledFromIntake && deposit > 0 && !isInvalid("deposit")
                  ? filledSectionClass
                  : "",
              ].join(" ")}
            >
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
                <div ref={setFieldRef("deposit")}>
                  <Input
                    label=""
                    required
                    invalid={isInvalid("deposit")}
                    type="number"
                    inputMode="numeric"
                    value={deposit || ""}
                    accent={filledFromIntake && deposit > 0}
                    onChange={(e) => {
                      const next = Number(e.target.value) || 0;
                      setDeposit(next);
                      setDepositTo(next);
                    }}
                    placeholder={
                      effectiveDealType === "매매" ? "50000" : "10000"
                    }
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <div ref={setFieldRef("deposit")}>
                    <Input
                      label="부터"
                      required
                      invalid={isInvalid("deposit")}
                      type="number"
                      inputMode="numeric"
                      value={deposit || ""}
                      accent={filledFromIntake && deposit > 0}
                      onChange={(e) =>
                        setDeposit(Number(e.target.value) || 0)
                      }
                      placeholder={
                        effectiveDealType === "매매" ? "40000" : "8000"
                      }
                    />
                  </div>
                  <div ref={setFieldRef("depositTo")}>
                    <Input
                      label="까지"
                      required
                      invalid={isInvalid("depositTo")}
                      type="number"
                      inputMode="numeric"
                      value={depositTo || ""}
                      accent={filledFromIntake && depositTo > 0}
                      onChange={(e) =>
                        setDepositTo(Number(e.target.value) || 0)
                      }
                      placeholder={
                        effectiveDealType === "매매" ? "50000" : "10000"
                      }
                    />
                  </div>
                </div>
              )}
            </div>

            {effectiveDealType === "월세" ? (
              <div
                className={[
                  "space-y-1",
                  filledFromIntake && monthlyRent > 0 && !isInvalid("monthlyRent")
                    ? filledSectionClass
                    : "",
                ].join(" ")}
              >
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
                  <div ref={setFieldRef("monthlyRent")}>
                    <Input
                      label=""
                      required
                      invalid={isInvalid("monthlyRent")}
                      type="number"
                      inputMode="numeric"
                      value={monthlyRent || ""}
                      accent={filledFromIntake && monthlyRent > 0}
                      onChange={(e) => {
                        const next = Number(e.target.value) || 0;
                        setMonthlyRent(next);
                        setMonthlyRentTo(next);
                      }}
                      placeholder="50"
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <div ref={setFieldRef("monthlyRent")}>
                      <Input
                        label="부터"
                        required
                        invalid={isInvalid("monthlyRent")}
                        type="number"
                        inputMode="numeric"
                        value={monthlyRent || ""}
                        accent={filledFromIntake && monthlyRent > 0}
                        onChange={(e) =>
                          setMonthlyRent(Number(e.target.value) || 0)
                        }
                        placeholder="40"
                      />
                    </div>
                    <div ref={setFieldRef("monthlyRentTo")}>
                      <Input
                        label="까지"
                        required
                        invalid={isInvalid("monthlyRentTo")}
                        type="number"
                        inputMode="numeric"
                        value={monthlyRentTo || ""}
                        accent={filledFromIntake && monthlyRentTo > 0}
                        onChange={(e) =>
                          setMonthlyRentTo(Number(e.target.value) || 0)
                        }
                        placeholder="60"
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            {effectiveDealType === "매매" ? (
              <label className="flex min-h-[38px] items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-3.5 active:scale-[0.99] transition-all duration-150">
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
            <div
              ref={setFieldRef("moveIn")}
              className={[
                "space-y-1",
                filledFromIntake && moveInFrom && !isInvalid("moveIn")
                  ? filledSectionClass
                  : "",
              ].join(" ")}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[13px] font-semibold text-gray-600">
                  입주희망일
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
                  invalid={isInvalid("moveIn")}
                  accent={filledFromIntake && Boolean(moveInFrom)}
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
                  invalid={isInvalid("moveIn")}
                  accent={filledFromIntake && Boolean(moveInFrom)}
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
          <div className="mt-2 space-y-1.5 border-t border-gray-200 pt-3">
            <p className="text-sm font-bold text-gray-800">기타</p>
          {!(
            roomType === "상가" ||
            roomType === "사무실" ||
            roomType === "토지" ||
            roomType === "건물"
          ) && (
            <>
              <div ref={setFieldRef("loan")}>
                <OptionToggle
                  label="대출 유무"
                  required
                  compact={filledFromIntake}
                  invalid={isInvalid("loan")}
                  columns={2}
                  value={loanNeeded || undefined}
                  options={["유", "무"] as const}
                  onChange={setLoanNeeded}
                />
              </div>
              <div ref={setFieldRef("insurance")}>
                <OptionToggle
                  label="전세보증보험 가입 가능 여부"
                  required
                  compact={filledFromIntake}
                  invalid={isInvalid("insurance")}
                  columns={2}
                  value={insuranceNeeded || undefined}
                  options={["유", "무"] as const}
                  onChange={setInsuranceNeeded}
                />
              </div>
            </>
          )}
          {!(roomType === "토지" || roomType === "건물") && (
            <>
              <div ref={setFieldRef("parking")}>
                <OptionToggle
                  label="주차 유무"
                  required
                  compact={filledFromIntake}
                  invalid={isInvalid("parking")}
                  columns={2}
                  value={parkingType || undefined}
                  options={["유", "무"] as const}
                  onChange={setParkingType}
                />
              </div>
              {parkingType === "유" ? (
                <div ref={setFieldRef("carType")}>
                  <OptionToggle
                    label="차종"
                    required
                    compact={filledFromIntake}
                    invalid={isInvalid("carType")}
                    columns={2}
                    value={carType}
                    options={["세단", "SUV"] as const}
                    onChange={setCarType}
                  />
                </div>
              ) : null}
            </>
          )}
          {roomType !== "토지" && (
            <OptionToggle
              label="엘리베이터 유무"
              compact={filledFromIntake}
              columns={2}
              value={elevatorNeeded || undefined}
              options={["유", "무"] as const}
              onChange={setElevatorNeeded}
            />
          )}
          <TextArea
            label="메모"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={customerMemoPlaceholder(roomType)}
          />
          <div ref={setFieldRef("teamShare")}>
            <OptionToggle
              label="팀공유 유무"
              hint="팀에 공유가 필요할 때 사용하세요"
              required
              compact={filledFromIntake}
              invalid={isInvalid("teamShare")}
              columns={2}
              value={
                workspaceShared === true
                  ? "유"
                  : workspaceShared === false
                    ? "무"
                    : undefined
              }
              options={["유", "무"] as const}
              onChange={(v) => setWorkspaceShared(v === "유")}
            />
          </div>
          <SiteShareFormField
            value={false}
            onChange={() => {}}
          />
          </div>
        </Card>
      </form>

      <StickyActionBar>
        <Button type="submit" form={FORM_ID} fullWidth size="lg">
          {submitLabel}
        </Button>
      </StickyActionBar>

      <RequiredFieldWarnModal
        open={warnOpen}
        message={warnMessage}
        onClose={() => setWarnOpen(false)}
      />
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
          resetCustomerDraft();
          if (method) startIntake(method);
        }}
      />
      <IntakeMessageModal
        open={messageOpen}
        onClose={() => setMessageOpen(false)}
        onApply={applyIntakeText}
      />
      <IntakeTalkModal
        open={talkOpen}
        kind="customer"
        onClose={() => setTalkOpen(false)}
        onApply={applyIntakeText}
      />
    </>
  );
}
