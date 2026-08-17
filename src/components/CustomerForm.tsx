"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type {
  BuildingKind,
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
import { applyDealTypeToMoney, isDealMoneyCleared } from "@/lib/dealTypeMoney";
import { findCustomerBySamePhone } from "@/lib/duplicateEntity";
import {
  getCustomerFieldMessage,
  getMissingCustomerFields,
  type CustomerFieldKey,
} from "@/lib/customerValidation";
import { useCustomersList } from "@/hooks/useEntityList";
import { Input, TextArea } from "@/components/ui/Input";
import { ManAmountInput } from "@/components/ManAmountInput";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { RequiredFieldWarnModal } from "@/components/RequiredFieldWarnModal";
import { StickyActionBar } from "@/components/StickyActionBar";
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
import {
  completedPreferredGus,
  defaultPreferredLocation,
} from "@/lib/preferredLocation";
import { customerMemoPlaceholder } from "@/lib/memoPlaceholders";
import type { IntakeParseResult } from "@/lib/intakeParse";
import {
  recordIntakeSample,
  type IntakeSampleSource,
} from "@/lib/intakeSampleCollect";
import { getAccessToken } from "@/lib/auth";
import { filledSectionClass, memoFilledSectionClass, requiredStarClass, emptyRequiredClass, invalidHintClass, invalidLabelClass } from "@/lib/uiInvalid";
import { IntakeSourceBar, type IntakeMethod } from "@/components/IntakeSourceBar";
import { IntakeResetModal } from "@/components/IntakeResetModal";
import { IntakeMessageModal, IntakeTalkModal } from "@/components/intakeLazy";
import { IntakeAiBusyOverlay } from "@/components/IntakeAiBusyOverlay";
import { useHasTeam } from "@/hooks/useHasTeam";

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
  const hasTeam = useHasTeam();
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
    if (needsRoomBathCounts(type)) return defaultRoomBathCounts(type).bathroomCount;
    return 0;
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
  const [aiBusy, setAiBusy] = useState(false);
  const [roomTypeOpen, setRoomTypeOpen] = useState(false);
  const applyingIntakeRef = useRef(false);

  const duplicateCustomer = useMemo(
    () => findCustomerBySamePhone(phone, customers, initial?.id),
    [phone, customers, initial?.id]
  );

  const isLandOrBuilding = roomType === "토지" || roomType === "건물";
  const effectiveDealType: DealType | "" = isLandOrBuilding
    ? "매매"
    : dealType;

  const handleDealTypeChange = (next: DealType | "") => {
    const prev = effectiveDealType || dealType;
    const money = applyDealTypeToMoney(prev, next, {
      deposit,
      depositTo,
      monthlyRent,
      monthlyRentTo,
    });
    setDealType(next);
    if (next !== "매매") setNonOccupancy(false);
    setDeposit(money.deposit);
    setDepositTo(money.depositTo);
    setMonthlyRent(money.monthlyRent);
    setMonthlyRentTo(money.monthlyRentTo);
    if (isDealMoneyCleared(money)) {
      setDepositSingle(true);
      setMonthlyRentSingle(true);
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
      handleDealTypeChange("매매");
      setParkingType("무");
    } else if (roomType === "토지" || roomType === "건물") {
      handleDealTypeChange("");
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
      setBathroomCount(0);
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
    setBathroomCount(0);
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

  const applyIntakeParsed = async (parsed: IntakeParseResult) => {
    const { intakeMoveInPeriod, intakePreferredLocation } = await import(
      "@/lib/intakeParse"
    );
    const nextPhone =
      parsed.phone || parsed.tenantPhone || parsed.landlordPhone || "";
    if (nextPhone) {
      setPhone(formatPhoneInput(nextPhone));
      setPhoneNonce((n) => n + 1);
    }
    if (parsed.name) setName(parsed.name);
    if (parsed.roomType) {
      applyRoomType(parsed.roomType);
      if (needsRoomBathCounts(parsed.roomType)) {
        const defaults = defaultRoomBathCounts(parsed.roomType);
        setRoomCount(parsed.roomCount ?? defaults.roomCount);
        setBathroomCount(parsed.bathroomCount ?? defaults.bathroomCount);
      }
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
    if (loc.preferredDongs.length > 0) {
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
    if (parsed.workspaceShared && hasTeam) {
      setWorkspaceShared(parsed.workspaceShared === "유");
    }
    if (parsed.notes) {
      setNotes((prev) => (prev.trim() ? `${prev.trim()}\n${parsed.notes}` : parsed.notes));
    }
    setFilledFromIntake(true);
    setValidationActive(true);
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
        kind: "customer",
        source,
        accessToken,
      });
      const wait = Math.max(0, INTAKE_AI_MIN_WAIT_MS - (Date.now() - started));
      if (wait) await new Promise((resolve) => window.setTimeout(resolve, wait));
      void recordIntakeSample({
        raw,
        kind: "customer",
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
    loanNeeded,
    insuranceNeeded,
    workspaceShared,
    requireTeamShare: false,
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
          : roomCount > 0
            ? roomCount
            : defaultRoomBathCounts(roomType).roomCount
        : undefined,
      bathroomCount: needsRoomBathCounts(roomType)
        ? bathroomCount > 0
          ? bathroomCount
          : defaultRoomBathCounts(roomType).bathroomCount
        : undefined,
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
      carType: undefined,
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
      <IntakeAiBusyOverlay open={aiBusy} />
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
        {photoRequestId > 0 ? (
          <IntakePhotoPicker
            requestId={photoRequestId}
            onText={(text) => void applyIntakeText(text, "photo")}
            onError={setPhotoError}
          />
        ) : null}
        <Card className="space-y-2.5">
          <div ref={setFieldRef("name")}>
            <Input
              label="고객명 또는 명칭"
              required
              invalid={isInvalid("name")}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="홍길동"
              chipWhenFilled
              chipTone="green"
            />
          </div>
          <div ref={setFieldRef("phone")}>
            <PhoneInput
              key={phoneNonce}
              label="고객 전화번호"
              required
              invalid={isInvalid("phone")}
              value={phone}
              onChange={setPhone}
              chipTone="green"
              labelHint="원터치 전화걸기에 사용됩니다."
              labelRight={
                duplicateCustomer ? "동일 고객이 존재합니다" : undefined
              }
              hint=""
            />
          </div>
          <div ref={setFieldRef("roomType")}>
          <ModalChoice
            label="매물 유형"
            required
            filled={filledFromIntake && Boolean(roomType)}
            invalid={isInvalid("roomType")}
            value={roomType || undefined}
            options={ROOM_TYPES}
            onChange={applyRoomType}
            columns={4}
            keepOpen={(type) => needsRoomBathCounts(type)}
            open={roomTypeOpen}
            onOpenChange={setRoomTypeOpen}
            extra={
              <RoomBathCountGrids
                roomType={roomType}
                roomCount={roomCount}
                bathroomCount={bathroomCount}
                invalidRoomCount={isInvalid("roomCount")}
                onChange={({ roomCount: nextRooms, bathroomCount: nextBaths }) => {
                  setRoomCount(nextRooms);
                  setBathroomCount(nextBaths);
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
                filled={filledFromIntake && Boolean(buildingKind)}
                invalid={isInvalid("buildingKind")}
                value={buildingKind || undefined}
                options={BUILDING_KINDS}
                onChange={setBuildingKind}
                columns={1}
              />
            </div>
          ) : null}

          <div
            ref={setFieldRef("roomCount")}
            className={
              filledFromIntake &&
              needsRoomBathCounts(roomType) &&
              (roomType === "투룸" || roomCount > 0)
                ? filledSectionClass
                : ""
            }
          >
            <RoomBathCountFields
              roomType={roomType}
              roomCount={roomCount}
              bathroomCount={bathroomCount}
              invalidRoomCount={isInvalid("roomCount")}
              onEdit={() => setRoomTypeOpen(true)}
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
            invalid={isInvalid("dealType")}
            value={effectiveDealType}
            onChange={handleDealTypeChange}
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
              className={emptyRequiredClass({
                invalid: isInvalid("deposit") || isInvalid("depositTo"),
              })}
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
              {isInvalid("deposit") || isInvalid("depositTo") ? (
                <p className={`text-xs ${invalidHintClass}`}>미입력</p>
              ) : null}
              {depositSingle ? (
                <div ref={setFieldRef("deposit")}>
                  <ManAmountInput
                    label=""
                    required
                    value={deposit}
                    onChange={(next) => {
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
                    <ManAmountInput
                      label="부터"
                      required
                      value={deposit}
                      onChange={setDeposit}
                      placeholder={
                        effectiveDealType === "매매" ? "40000" : "8000"
                      }
                    />
                  </div>
                  <div ref={setFieldRef("depositTo")}>
                    <ManAmountInput
                      label="까지"
                      required
                      value={depositTo}
                      onChange={setDepositTo}
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
                className={emptyRequiredClass({
                  invalid:
                    isInvalid("monthlyRent") || isInvalid("monthlyRentTo"),
                })}
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
                {isInvalid("monthlyRent") || isInvalid("monthlyRentTo") ? (
                  <p className={`text-xs ${invalidHintClass}`}>미입력</p>
                ) : null}
                {monthlyRentSingle ? (
                  <div ref={setFieldRef("monthlyRent")}>
                    <Input
                      label=""
                      required
                      type="number"
                      inputMode="numeric"
                      value={monthlyRent || ""}
                      accent={monthlyRent > 0}
                      chipWhenFilled
                      onChange={(e) => {
                        const next = Number(e.target.value) || 0;
                        setMonthlyRent(next);
                        setMonthlyRentTo(next);
                      }}
                      placeholder="50"
                      suffix="만원"
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <div ref={setFieldRef("monthlyRent")}>
                      <Input
                        label="부터"
                        required
                        type="number"
                        inputMode="numeric"
                        value={monthlyRent || ""}
                        accent={monthlyRent > 0}
                        chipWhenFilled
                        onChange={(e) =>
                          setMonthlyRent(Number(e.target.value) || 0)
                        }
                        placeholder="40"
                        suffix="만원"
                      />
                    </div>
                    <div ref={setFieldRef("monthlyRentTo")}>
                      <Input
                        label="까지"
                        required
                        type="number"
                        inputMode="numeric"
                        value={monthlyRentTo || ""}
                        accent={monthlyRentTo > 0}
                        chipWhenFilled
                        onChange={(e) =>
                          setMonthlyRentTo(Number(e.target.value) || 0)
                        }
                        placeholder="60"
                        suffix="만원"
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : null}
            </div>

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

          {!(effectiveDealType === "매매" && nonOccupancy) && (
            <div
              ref={setFieldRef("moveIn")}
              className={emptyRequiredClass({
                invalid: isInvalid("moveIn"),
              })}
            >
              <div className="flex items-center justify-between gap-2">
                <p
                  className={[
                    "text-[13px] font-semibold",
                    isInvalid("moveIn") ? invalidLabelClass : "text-gray-600",
                  ].join(" ")}
                >
                  입주희망일
                  <span className={requiredStarClass}>*</span>
                </p>
                <label className="flex items-center gap-2 active:scale-95 transition-all duration-150">
                  <CircleCheck
                    checked={moveInSingle}
                    onChange={(e) => {
                      const on = e.target.checked;
                      setMoveInSingle(on);
                      if (on && moveInFrom) {
                        setMoveInTo(moveInFrom);
                      } else if (!on) {
                        setMoveInTo("");
                      }
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
                  from={moveInFrom}
                  to={moveInTo}
                  onChange={({ from, to }) => {
                  const single = Boolean(from && (!to || from === to));
                  setMoveInSingle(single);
                  setMoveInFrom(from);
                  setMoveInTo(single ? from : to);
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
                  label="대출"
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
                  label="주차"
                  required
                  compact={filledFromIntake}
                  invalid={isInvalid("parking")}
                  columns={2}
                  value={parkingType || undefined}
                  options={["유", "무"] as const}
                  onChange={setParkingType}
                />
              </div>
            </>
          )}
          {roomType !== "토지" && (
            <OptionToggle
              label="엘리베이터"
              compact={filledFromIntake}
              columns={2}
              value={elevatorNeeded || undefined}
              options={["유", "무"] as const}
              onChange={setElevatorNeeded}
            />
          )}
          <div className={notes.trim() ? memoFilledSectionClass : ""}>
            <TextArea
              label="메모"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={customerMemoPlaceholder(roomType)}
            />
          </div>
          <TeamShareFormField
            value={workspaceShared}
            onChange={setWorkspaceShared}
            hasTeam={hasTeam}
          />
          <SiteShareFormField value={false} onChange={() => {}} />
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
          kind="customer"
          onClose={() => setTalkOpen(false)}
          onApply={(parsed) => void applyIntakeParsed(parsed)}
        />
      ) : null}
    </>
  );
}
