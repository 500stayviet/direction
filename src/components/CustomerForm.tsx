"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Customer, DealType, ParkingType, RoomType } from "@/lib/types";
import {
  defaultRoomBathCounts,
  needsRoomBathCounts,
} from "@/lib/constants";
import { createId } from "@/lib/id";
import { formatDepositRent, formatMoveInRange, formatPhoneInput } from "@/lib/format";
import { findCustomerBySamePhone } from "@/lib/duplicateEntity";
import {
  getCustomerFieldMessage,
  getMissingCustomerFields,
  type CustomerFieldKey,
} from "@/lib/customerValidation";
import { useCustomersList } from "@/hooks/useEntityList";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { RequiredFieldWarnModal } from "@/components/RequiredFieldWarnModal";
import { StickyActionBar } from "@/components/StickyActionBar";
import { completedPreferredGus } from "@/lib/preferredLocation";
import { useHasTeam } from "@/hooks/useHasTeam";
import { useIntakeApply } from "@/hooks/useIntakeApply";
import type { IntakeParseResult } from "@/lib/intakeParse";
import {
  applyCustomerDealType,
  applyCustomerRoomType,
  createCustomerFormDraft,
  customerFormHasContent,
  isCustomerLandOrBuilding,
  type CustomerFormDraft,
} from "@/lib/customerFormDraft";
import {
  CustomerFormExtraFields,
  CustomerFormIdentityFields,
  CustomerFormLocationMoveInFields,
  CustomerFormTypeMoneyFields,
} from "@/components/CustomerFormFields";

const FORM_ID = "customer-form";
const NO_MISSING: CustomerFieldKey[] = [];

interface CustomerFormProps {
  initial?: Customer;
  restoreMode?: boolean;
  onSubmit: (customer: Customer) => void;
  submitLabel?: string;
}

export function CustomerForm({
  initial,
  restoreMode = false,
  onSubmit,
  submitLabel = "저장하기",
}: CustomerFormProps) {
  const { items: customers } = useCustomersList();
  const hasTeam = useHasTeam();
  const [draft, setDraft] = useState(() =>
    createCustomerFormDraft(initial, { restore: restoreMode })
  );
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const [validationActive, setValidationActive] = useState(restoreMode);
  const [focusField, setFocusField] = useState<CustomerFieldKey | null>(null);
  const [warnOpen, setWarnOpen] = useState(false);
  const [warnMessage, setWarnMessage] = useState("");
  const fieldRefs = useRef<Partial<Record<CustomerFieldKey, HTMLDivElement | null>>>({});
  const warnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [phoneNonce, setPhoneNonce] = useState(0);
  const [roomTypeOpen, setRoomTypeOpen] = useState(false);

  const patch = useCallback((next: Partial<CustomerFormDraft>) => {
    setDraft((prev) => ({ ...prev, ...next }));
  }, []);
  const onNameChange = useCallback(
    (name: string) => patch({ name }),
    [patch]
  );
  const onPhoneChange = useCallback(
    (phone: string) => patch({ phone }),
    [patch]
  );

  const handleDealTypeChange = useCallback((next: DealType | "") => {
    setDraft((prev) => applyCustomerDealType(prev, next));
  }, []);

  const applyRoomType = useCallback((next: RoomType) => {
    setDraft((prev) => applyCustomerRoomType(prev, next));
  }, []);

  const resetCustomerDraft = useCallback(() => {
    setDraft(createCustomerFormDraft());
    setValidationActive(false);
  }, []);

  const applyIntakeParsed = useCallback(
    (parsed: IntakeParseResult) => {
      const nextPhone =
        parsed.phone || parsed.tenantPhone || parsed.landlordPhone || "";
      if (nextPhone) setPhoneNonce((n) => n + 1);
      void import("@/lib/intakeParse").then(({ applyIntakeToCustomer }) => {
        setDraft((prev) => applyIntakeToCustomer(prev, parsed, { hasTeam }));
        setValidationActive(true);
      });
    },
    [hasTeam]
  );

  const intake = useIntakeApply({
    kind: "customer",
    hasDraftContent: customerFormHasContent(draft),
    onResetDraft: resetCustomerDraft,
    onApplyParsed: applyIntakeParsed,
    photoErrorClassName: "-mt-1 text-[12px] font-semibold text-red-400",
  });

  const isLandOrBuilding = isCustomerLandOrBuilding(draft.roomType);
  const effectiveDealType: DealType | "" = isLandOrBuilding
    ? "매매"
    : draft.dealType;

  const duplicateCustomer = useMemo(
    () => findCustomerBySamePhone(draft.phone, customers, initial?.id),
    [draft.phone, customers, initial?.id]
  );

  const customerInput = {
    name: draft.name,
    phone: draft.phone,
    roomType: draft.roomType,
    buildingKind: draft.buildingKind,
    roomCount: draft.roomCount,
    dealType: effectiveDealType,
    deposit: draft.deposit,
    depositTo: draft.depositTo,
    depositSingle: draft.depositSingle,
    monthlyRent: draft.monthlyRent,
    monthlyRentTo: draft.monthlyRentTo,
    monthlyRentSingle: draft.monthlyRentSingle,
    nonOccupancy: draft.nonOccupancy,
    moveInFrom: draft.moveInFrom,
    moveInTo: draft.moveInTo,
    moveInSingle: draft.moveInSingle,
    parkingType: draft.parkingType,
    loanNeeded: draft.loanNeeded,
    insuranceNeeded: draft.insuranceNeeded,
    workspaceShared: draft.workspaceShared,
    requireTeamShare: false,
    preferredGus: draft.preferredGus,
    preferredDongs: draft.preferredDongs,
  };

  const missingFields = validationActive
    ? getMissingCustomerFields(customerInput)
    : NO_MISSING;
  const isInvalid = useCallback(
    (key: CustomerFieldKey) => missingFields.includes(key),
    [missingFields]
  );

  useEffect(() => {
    if (!validationActive || !focusField) return;
    fieldRefs.current[focusField]?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [validationActive, focusField]);

  useEffect(() => {
    return () => {
      if (warnTimer.current) clearTimeout(warnTimer.current);
    };
  }, []);

  const setFieldRef = useCallback(
    (key: CustomerFieldKey) => (node: HTMLDivElement | null) => {
      fieldRefs.current[key] = node;
    },
    []
  );

  const typeMoneyDraft = useMemo(
    () => ({
      roomType: draft.roomType,
      buildingKind: draft.buildingKind,
      roomCount: draft.roomCount,
      bathroomCount: draft.bathroomCount,
      deposit: draft.deposit,
      depositTo: draft.depositTo,
      depositSingle: draft.depositSingle,
      monthlyRent: draft.monthlyRent,
      monthlyRentTo: draft.monthlyRentTo,
      monthlyRentSingle: draft.monthlyRentSingle,
      landCategory: draft.landCategory,
    }),
    [
      draft.roomType,
      draft.buildingKind,
      draft.roomCount,
      draft.bathroomCount,
      draft.deposit,
      draft.depositTo,
      draft.depositSingle,
      draft.monthlyRent,
      draft.monthlyRentTo,
      draft.monthlyRentSingle,
      draft.landCategory,
    ]
  );

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const snap = draftRef.current;
    const savedDealType: DealType | "" = isCustomerLandOrBuilding(snap.roomType)
      ? "매매"
      : snap.dealType;
    const isLand = snap.roomType === "토지";
    const isNonOccupancy =
      !isLand && savedDealType === "매매" && snap.nonOccupancy;
    const toDate = isLand
      ? ""
      : snap.moveInSingle
        ? snap.moveInFrom
        : snap.moveInTo;
    const missing = getMissingCustomerFields({
      ...customerInput,
      name: snap.name,
      phone: snap.phone,
      roomType: snap.roomType,
      buildingKind: snap.buildingKind,
      roomCount: snap.roomCount,
      dealType: savedDealType,
      deposit: snap.deposit,
      depositTo: snap.depositTo,
      depositSingle: snap.depositSingle,
      monthlyRent: snap.monthlyRent,
      monthlyRentTo: snap.monthlyRentTo,
      monthlyRentSingle: snap.monthlyRentSingle,
      nonOccupancy: snap.nonOccupancy,
      moveInFrom: snap.moveInFrom,
      moveInTo: snap.moveInTo,
      moveInSingle: snap.moveInSingle,
      parkingType: snap.parkingType,
      loanNeeded: snap.loanNeeded,
      insuranceNeeded: snap.insuranceNeeded,
      workspaceShared: snap.workspaceShared,
      preferredGus: snap.preferredGus,
      preferredDongs: snap.preferredDongs,
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
    if (!snap.roomType || !savedDealType) return;
    setValidationActive(false);
    setWarnOpen(false);
    const now = new Date().toISOString();
    const rent =
      savedDealType === "월세" ? snap.monthlyRent || undefined : undefined;
    const savedDepositTo = snap.depositSingle ? snap.deposit : snap.depositTo;
    const savedRentTo =
      savedDealType === "월세"
        ? snap.monthlyRentSingle
          ? snap.monthlyRent
          : snap.monthlyRentTo
        : undefined;
    const doneGus = completedPreferredGus(
      snap.preferredGus,
      snap.preferredDongs
    );
    const landOrBuilding = isCustomerLandOrBuilding(snap.roomType);
    onSubmit({
      id: initial?.id ?? createId("cus"),
      name: snap.name.trim(),
      phone: formatPhoneInput(snap.phone),
      dealType: savedDealType,
      roomType: snap.roomType,
      buildingKind:
        snap.roomType === "건물" ? snap.buildingKind || undefined : undefined,
      roomCount: needsRoomBathCounts(snap.roomType)
        ? snap.roomType === "투룸"
          ? 2
          : snap.roomCount > 0
            ? snap.roomCount
            : defaultRoomBathCounts(snap.roomType).roomCount
        : undefined,
      bathroomCount: needsRoomBathCounts(snap.roomType)
        ? snap.bathroomCount > 0
          ? snap.bathroomCount
          : defaultRoomBathCounts(snap.roomType).bathroomCount
        : undefined,
      deposit: snap.deposit,
      depositTo: savedDepositTo,
      depositSingle: snap.depositSingle,
      monthlyRent: rent,
      monthlyRentTo: savedDealType === "월세" ? savedRentTo : undefined,
      monthlyRentSingle:
        savedDealType === "월세" ? snap.monthlyRentSingle : undefined,
      budget: formatDepositRent(
        savedDealType,
        snap.deposit,
        rent,
        snap.depositSingle ? undefined : savedDepositTo,
        savedDealType === "월세" && !snap.monthlyRentSingle
          ? savedRentTo
          : undefined
      ),
      moveInFrom: isLand || isNonOccupancy ? "" : snap.moveInFrom,
      moveInTo: isLand || isNonOccupancy ? "" : toDate,
      moveInSingle: isLand || isNonOccupancy ? undefined : snap.moveInSingle,
      moveInDate: isLand
        ? ""
        : isNonOccupancy
          ? "비입주"
          : formatMoveInRange(snap.moveInFrom, toDate),
      nonOccupancy: isNonOccupancy,
      loanNeeded:
        snap.roomType === "상가" ||
        snap.roomType === "사무실" ||
        landOrBuilding
          ? "무"
          : (snap.loanNeeded as ParkingType),
      loanType:
        snap.roomType === "상가" ||
        snap.roomType === "사무실" ||
        landOrBuilding ||
        snap.loanNeeded === "무"
          ? "해당없음"
          : "",
      insuranceNeeded:
        snap.roomType === "상가" ||
        snap.roomType === "사무실" ||
        landOrBuilding
          ? "무"
          : (snap.insuranceNeeded as ParkingType),
      elevatorNeeded:
        snap.roomType === "토지"
          ? "무"
          : snap.elevatorNeeded === "유" || snap.elevatorNeeded === "무"
            ? snap.elevatorNeeded
            : undefined,
      parkingType:
        snap.roomType === "토지" || snap.roomType === "건물"
          ? "무"
          : (snap.parkingType as ParkingType),
      carType: undefined,
      petAllowed: "무",
      notes: snap.notes.trim(),
      usableArea: snap.usableArea,
      landCategory:
        snap.roomType === "토지"
          ? snap.landCategory.trim() || undefined
          : undefined,
      preferredGus: doneGus.length > 0 ? doneGus : undefined,
      preferredDongs:
        snap.preferredDongs.length > 0 ? snap.preferredDongs : undefined,
      workspaceShared: snap.workspaceShared === true,
      siteShared: initial?.siteShared === true,
      contractCompleted: restoreMode ? false : initial?.contractCompleted,
      createdAt: initial?.createdAt ?? now,
      updatedAt: now,
    });
  };

  return (
    <>
      {intake.overlay}
      <form
        id={FORM_ID}
        noValidate
        onSubmit={handleSubmit}
        className="space-y-3 pb-2"
      >
        {intake.sourceSection}
        <Card className="space-y-2.5">
          <CustomerFormIdentityFields
            name={draft.name}
            phone={draft.phone}
            phoneNonce={phoneNonce}
            nameInvalid={isInvalid("name")}
            phoneInvalid={isInvalid("phone")}
            duplicateHint={Boolean(duplicateCustomer)}
            setFieldRef={setFieldRef}
            onNameChange={onNameChange}
            onPhoneChange={onPhoneChange}
          />
          <CustomerFormTypeMoneyFields
            draft={typeMoneyDraft}
            effectiveDealType={effectiveDealType}
            isLandOrBuilding={isLandOrBuilding}
            isInvalid={isInvalid}
            setFieldRef={setFieldRef}
            roomTypeOpen={roomTypeOpen}
            onRoomTypeOpenChange={setRoomTypeOpen}
            onRoomType={applyRoomType}
            onDealType={handleDealTypeChange}
            onPatch={patch}
          />
          <CustomerFormLocationMoveInFields
            preferredGus={draft.preferredGus}
            preferredDongs={draft.preferredDongs}
            moveInFrom={draft.moveInFrom}
            moveInTo={draft.moveInTo}
            moveInSingle={draft.moveInSingle}
            nonOccupancy={draft.nonOccupancy}
            effectiveDealType={effectiveDealType}
            showMoveIn={draft.roomType !== "토지"}
            locationInvalid={isInvalid("preferredLocation")}
            moveInInvalid={isInvalid("moveIn")}
            setFieldRef={setFieldRef}
            onPreferredChange={patch}
            onPatch={patch}
          />
          <CustomerFormExtraFields
            roomType={draft.roomType}
            dealType={draft.dealType}
            loanNeeded={draft.loanNeeded}
            insuranceNeeded={draft.insuranceNeeded}
            parkingType={draft.parkingType}
            elevatorNeeded={draft.elevatorNeeded}
            notes={draft.notes}
            workspaceShared={draft.workspaceShared}
            hasTeam={hasTeam}
            isInvalid={isInvalid}
            setFieldRef={setFieldRef}
            onPatch={patch}
          />
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
      {intake.modals}
    </>
  );
}
