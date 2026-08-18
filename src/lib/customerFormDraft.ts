import {
  defaultRoomBathCounts,
  needsRoomBathCounts,
  normalizeBuildingKind,
  normalizeRoomType,
} from "@/lib/constants";
import {
  applyDealTypeToMoney,
  isDealMoneyCleared,
} from "@/lib/dealTypeMoney";
import { formatPhoneInput, onlyDigits, resolveCustomerLoanNeeded } from "@/lib/format";
import {
  completedPreferredGus,
  defaultPreferredLocation,
} from "@/lib/preferredLocation";
import type { BuildingKind, Customer, DealType, RoomType } from "@/lib/types";

export type YesNoBlank = "유" | "무" | "";

export type CustomerFormDraft = {
  name: string;
  phone: string;
  dealType: DealType | "";
  roomType: RoomType | "";
  buildingKind: BuildingKind | "";
  roomCount: number;
  bathroomCount: number;
  deposit: number;
  depositTo: number;
  depositSingle: boolean;
  monthlyRent: number;
  monthlyRentTo: number;
  monthlyRentSingle: boolean;
  nonOccupancy: boolean;
  moveInFrom: string;
  moveInTo: string;
  moveInSingle: boolean;
  loanNeeded: YesNoBlank;
  parkingType: YesNoBlank;
  insuranceNeeded: YesNoBlank;
  elevatorNeeded: YesNoBlank;
  notes: string;
  landCategory: string;
  preferredGus: string[];
  preferredDongs: string[];
  workspaceShared: boolean;
};

function initialYesNo(
  value: "유" | "무" | undefined,
  hasInitial: boolean
): YesNoBlank {
  if (value === "유" || value === "무") return value;
  return hasInitial ? "무" : "";
}

function initialMoneySingle(
  explicit: boolean | undefined,
  from: number | undefined,
  to: number | undefined
): boolean {
  if (explicit != null) return explicit;
  if (to != null && to > 0 && to !== from) return false;
  return true;
}

function initialMoveInSingle(initial?: Customer): boolean {
  if (initial?.moveInSingle != null) return initial.moveInSingle;
  if (initial?.moveInFrom && initial?.moveInTo) {
    return initial.moveInFrom === initial.moveInTo;
  }
  return false;
}

function initialPreferred(initial?: Customer): {
  preferredGus: string[];
  preferredDongs: string[];
} {
  if (initial?.preferredGus?.length) {
    return {
      preferredGus: initial.preferredGus,
      preferredDongs: initial.preferredDongs ?? [],
    };
  }
  if (initial?.preferredDongs?.length) {
    return {
      preferredGus: completedPreferredGus([], initial.preferredDongs),
      preferredDongs: initial.preferredDongs,
    };
  }
  if (initial) return { preferredGus: [], preferredDongs: [] };
  return defaultPreferredLocation();
}

export function isCustomerLandOrBuilding(roomType: RoomType | ""): boolean {
  return roomType === "토지" || roomType === "건물";
}

export function createCustomerFormDraft(initial?: Customer): CustomerFormDraft {
  const roomType =
    normalizeRoomType(initial?.roomType) ?? initial?.roomType ?? "";
  const defaults = needsRoomBathCounts(roomType)
    ? defaultRoomBathCounts(roomType)
    : { roomCount: 0, bathroomCount: 0 };
  const loc = initialPreferred(initial);
  const deposit = initial?.deposit ?? 0;
  const monthlyRent = initial?.monthlyRent ?? 0;

  return {
    name: initial?.name ?? "",
    phone: formatPhoneInput(initial?.phone ?? ""),
    dealType: initial?.dealType ?? "",
    roomType,
    buildingKind: normalizeBuildingKind(initial?.buildingKind) ?? "",
    roomCount:
      initial?.roomCount && initial.roomCount > 0
        ? initial.roomCount
        : defaults.roomCount,
    bathroomCount:
      initial?.bathroomCount && initial.bathroomCount > 0
        ? initial.bathroomCount
        : defaults.bathroomCount,
    deposit,
    depositTo: initial?.depositTo ?? initial?.deposit ?? 0,
    depositSingle: initialMoneySingle(
      initial?.depositSingle,
      initial?.deposit,
      initial?.depositTo
    ),
    monthlyRent,
    monthlyRentTo: initial?.monthlyRentTo ?? initial?.monthlyRent ?? 0,
    monthlyRentSingle: initialMoneySingle(
      initial?.monthlyRentSingle,
      initial?.monthlyRent,
      initial?.monthlyRentTo
    ),
    nonOccupancy: initial?.nonOccupancy ?? false,
    moveInFrom: initial?.moveInFrom ?? initial?.moveInDate ?? "",
    moveInTo: initial?.moveInTo ?? "",
    moveInSingle: initialMoveInSingle(initial),
    loanNeeded: initial ? resolveCustomerLoanNeeded(initial) : "",
    parkingType: initialYesNo(initial?.parkingType, Boolean(initial)),
    insuranceNeeded: initialYesNo(initial?.insuranceNeeded, Boolean(initial)),
    elevatorNeeded: initialYesNo(initial?.elevatorNeeded, Boolean(initial)),
    notes: initial?.notes ?? "",
    landCategory: initial?.landCategory ?? "",
    preferredGus: loc.preferredGus,
    preferredDongs: loc.preferredDongs,
    workspaceShared: initial ? initial.workspaceShared === true : false,
  };
}

export function customerFormHasContent(draft: CustomerFormDraft): boolean {
  return Boolean(
    draft.name.trim() ||
      onlyDigits(draft.phone).length >= 7 ||
      draft.notes.trim() ||
      draft.deposit > 0 ||
      draft.preferredDongs.length > 0
  );
}

export function applyCustomerDealType(
  draft: CustomerFormDraft,
  next: DealType | ""
): CustomerFormDraft {
  const prev =
    (isCustomerLandOrBuilding(draft.roomType) ? "매매" : draft.dealType) ||
    draft.dealType;
  const money = applyDealTypeToMoney(prev, next, {
    deposit: draft.deposit,
    depositTo: draft.depositTo,
    monthlyRent: draft.monthlyRent,
    monthlyRentTo: draft.monthlyRentTo,
  });
  return {
    ...draft,
    dealType: next,
    nonOccupancy: next !== "매매" ? false : draft.nonOccupancy,
    deposit: money.deposit,
    depositTo: money.depositTo,
    monthlyRent: money.monthlyRent,
    monthlyRentTo: money.monthlyRentTo,
    ...(isDealMoneyCleared(money)
      ? { depositSingle: true, monthlyRentSingle: true }
      : {}),
  };
}

export function applyCustomerRoomType(
  draft: CustomerFormDraft,
  next: RoomType
): CustomerFormDraft {
  let nextDraft: CustomerFormDraft = { ...draft, roomType: next };
  if (
    next === "상가" ||
    next === "사무실" ||
    next === "토지" ||
    next === "건물"
  ) {
    nextDraft.loanNeeded = "무";
  }
  if (next === "토지" || next === "건물") {
    nextDraft = applyCustomerDealType(nextDraft, "매매");
    nextDraft.parkingType = "무";
  } else if (draft.roomType === "토지" || draft.roomType === "건물") {
    nextDraft = applyCustomerDealType(nextDraft, "");
  }
  if (next !== "건물") {
    nextDraft.buildingKind = "";
  }
  if (needsRoomBathCounts(next)) {
    const defaults = defaultRoomBathCounts(next);
    nextDraft.roomCount = defaults.roomCount;
    nextDraft.bathroomCount = defaults.bathroomCount;
  } else {
    nextDraft.roomCount = 0;
    nextDraft.bathroomCount = 0;
  }
  return nextDraft;
}
