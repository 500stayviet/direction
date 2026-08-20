import { needsRoomBathCounts, formatUnitCountsLine, skipsResidentialExtras, needsMaintenanceFee } from "@/lib/constants";
import {
  formatDepositRent,
  formatMoney,
  formatVisitDateTime,
  customerNeedLabel,
  getCustomerBudgetLabel,
  getCustomerLoanLabel,
  getCustomerMoveInLabel,
  getCustomerParkingLabel,
  getPropertyMoveInLabel,
  isInsuranceJoined,
  yesNoLabel,
  needsJeonseInsurance,
  formatBuildingParking,
} from "@/lib/format";
import { notesWithDoorPasswords } from "@/lib/propertyPasswords";
import { formatLandAreaLine } from "@/lib/landArea";
import type { Customer, Property, Schedule } from "@/lib/types";

export type AdminDetailField = {
  label: string;
  value: string;
  /** 슈퍼 해제용 secrets 키 */
  secretKey?: string;
};

export type AdminEntityDetail = {
  id: string;
  kind: "customers" | "properties" | "schedules";
  title: string;
  fields: AdminDetailField[];
  slots?: {
    title: string;
    fields: AdminDetailField[];
  }[];
  routes?: string[];
  secrets?: Record<string, string>;
  shared: boolean;
  deleted: boolean;
  createdByName: string;
  createdAt?: string;
  updatedAt?: string;
  contractCompleted?: boolean;
  visitCompleted?: boolean;
};

const MASK_PHONE = "•••-••••-••••";
const MASK_ROOM = "•••";
const MASK_SECRET = "••••";

function str(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

function push(
  fields: AdminDetailField[],
  label: string,
  value: string | undefined | null,
  secretKey?: string
) {
  const v = (value ?? "").trim();
  if (!v) return;
  fields.push(secretKey ? { label, value: v, secretKey } : { label, value: v });
}

function maskPhone(phone: string): string {
  return phone ? MASK_PHONE : "";
}

function maskRoom(roomNo: string): string {
  return roomNo ? MASK_ROOM : "";
}

function buildPropertyFields(
  p: Property,
  secrets: Record<string, string>,
  secretPrefix = "",
  options?: { includeDoorPasswords?: boolean }
): AdminDetailField[] {
  const fields: AdminDetailField[] = [];
  const sk = (key: string) => (secretPrefix ? `${secretPrefix}.${key}` : key);

  push(fields, "주소", p.address);

  const roomNo = str(p.roomNo);
  if (roomNo) {
    secrets[sk("roomNo")] = roomNo;
    push(fields, "동·호실", `${maskRoom(roomNo)}호`, sk("roomNo"));
  }

  push(
    fields,
    "유형",
    [p.roomType, p.buildingKind, p.dealType].filter(Boolean).join(" · ")
  );

  if (needsRoomBathCounts(p.roomType)) {
    push(
      fields,
      "방 · 화장실",
      `방 ${p.roomType === "투룸" ? 2 : p.roomCount ?? "-"}개 · 화장실 ${p.bathroomCount ?? 1}개`
    );
  }
  if (p.usableArea != null) {
    push(fields, "평형 (약)", `${p.usableArea}평`);
  }

  const dealForMoney =
    p.roomType === "건물" || p.roomType === "토지"
      ? "매매"
      : p.dealType ?? "";
  if (typeof p.deposit === "number") {
    push(
      fields,
      "금액",
      formatDepositRent(dealForMoney, p.deposit, p.monthlyRent)
    );
  }

  if (p.roomType === "토지") {
    if (p.landArea != null) push(fields, "대지면적", formatLandAreaLine(p.landArea));
    if (p.landCategory?.trim()) push(fields, "지목", p.landCategory.trim());
    if (p.landUse?.trim()) push(fields, "용도지역", p.landUse.trim());
  } else if (p.roomType === "건물") {
    const parking = formatBuildingParking(
      p.parkingSpacesAbove,
      p.parkingSpacesBasement,
      p.parkingSpaces
    );
    push(
      fields,
      "층수 · 주차",
      [
        p.floorsBasement ? `지하 -${p.floorsBasement}` : "",
        p.floorsAbove ? `지상 ${p.floorsAbove}` : "",
        parking ? parking : "",
      ]
        .filter(Boolean)
        .join(" · ")
    );
    if (p.landArea != null) push(fields, "토지면적", formatLandAreaLine(p.landArea));
    if (p.buildingArea != null) push(fields, "건축면적", formatLandAreaLine(p.buildingArea));
    if (p.unitCounts) {
      push(
        fields,
        "건물내 방 · 상가수",
        formatUnitCountsLine(p.unitCounts, p.buildingKind) || "-"
      );
    }
  } else if (needsMaintenanceFee(p.dealType, p.roomType) && typeof p.maintenanceFee === "number") {
    const includes =
      Array.isArray(p.maintenanceIncludes) && p.maintenanceIncludes.length > 0
        ? ` (${p.maintenanceIncludes.join(", ")})`
        : "";
    push(fields, "관리비", `${formatMoney(p.maintenanceFee)}${includes}`);
  }

  if (p.roomType !== "토지" && p.roomType !== "건물") {
    push(
      fields,
      "입주 가능",
      getPropertyMoveInLabel(p)
    );
  }

  if (p.arriveTime) push(fields, "방문 약속", p.arriveTime);

  const tenant = str(p.tenantPhone);
  if (tenant) {
    secrets[sk("tenantPhone")] = tenant;
    push(fields, "임차인 전화", maskPhone(tenant), sk("tenantPhone"));
  }
  const landlord = str(p.landlordPhone);
  if (landlord) {
    secrets[sk("landlordPhone")] = landlord;
    push(fields, "임대인 전화", maskPhone(landlord), sk("landlordPhone"));
  }
  if (p.hasPartnerAgency) {
    push(
      fields,
      "협력 부동산",
      [p.partnerAgency?.name, p.partnerAgency?.dong].filter(Boolean).join(" · ")
    );
    const partnerPhone = str(p.partnerAgency?.phone);
    if (partnerPhone) {
      secrets[sk("partnerPhone")] = partnerPhone;
      push(
        fields,
        "협력 전화",
        maskPhone(partnerPhone),
        sk("partnerPhone")
      );
    }
  }

  if (options?.includeDoorPasswords && p.roomType !== "토지") {
    const floorPw = str(p.floorPassword);
    if (floorPw) {
      secrets[sk("floorPassword")] = floorPw;
      push(fields, "현관 비밀번호", MASK_SECRET, sk("floorPassword"));
    }
    const roomPw = str(p.roomPassword || p.password);
    if (roomPw) {
      secrets[sk("roomPassword")] = roomPw;
      push(fields, "호실 비밀번호", MASK_SECRET, sk("roomPassword"));
    }
  }

  if (p.roomType !== "토지" && p.roomType !== "건물") {
    if (!skipsResidentialExtras(p.roomType)) {
      push(fields, "대출", yesNoLabel(p.loanAvailable));
      if (needsJeonseInsurance(p.dealType, p.roomType)) {
        push(
          fields,
          "보증보험",
          isInsuranceJoined(p.insuranceType) ? "유" : "무"
        );
      }
    }
    const parking =
      p.parkingType === "유"
        ? [
            "유",
            p.parkingFeeType,
            p.parkingFee != null ? `${formatMoney(p.parkingFee)}/월` : "",
          ]
            .filter(Boolean)
            .join(" · ")
        : "무";
    push(fields, "주차", parking);
    push(fields, "엘리베이터", p.elevator ? "유" : "무");
    if (Array.isArray(p.options) && p.options.length > 0) {
      push(fields, "옵션", p.options.join(", "));
    }
  }

  push(
    fields,
    "메모",
    options?.includeDoorPasswords
      ? str(p.notes) || undefined
      : notesWithDoorPasswords(p) || undefined
  );
  push(fields, "팀공유", p.workspaceShared ? "유" : "무");

  return fields;
}

export function buildAdminCustomerDetail(args: {
  id: string;
  payload: Record<string, unknown>;
  canReveal: boolean;
  shared: boolean;
  deleted: boolean;
  createdByName: string;
  createdAt?: string;
  updatedAt?: string;
}): AdminEntityDetail {
  const c = args.payload as unknown as Customer;
  const fields: AdminDetailField[] = [];
  const secrets: Record<string, string> = {};

  push(fields, "이름", c.name);
  const phone = str(c.phone);
  if (phone) {
    secrets.phone = phone;
    push(fields, "전화", maskPhone(phone), "phone");
  }
  push(
    fields,
    "유형",
    [c.roomType, c.buildingKind, c.dealType].filter(Boolean).join(" · ")
  );
  if (needsRoomBathCounts(c.roomType)) {
    push(
      fields,
      "방 · 화장실",
      `방 ${c.roomType === "투룸" ? 2 : c.roomCount ?? "-"}개 · 화장실 ${c.bathroomCount ?? 1}개`
    );
  }
  push(fields, "금액", getCustomerBudgetLabel(c));
  if ((c.preferredDongs?.length ?? 0) > 0) {
    const loc = (c.preferredDongs ?? [])
      .map((raw) => {
        const i = raw.indexOf("|");
        if (i <= 0) return raw;
        return `${raw.slice(0, i)} ${raw.slice(i + 1)}`;
      })
      .join(", ");
    push(fields, "선호지역", loc || undefined);
  }
  if (c.roomType === "토지" && c.landCategory?.trim()) {
    push(fields, "지목", c.landCategory.trim());
  }
  if (c.roomType !== "토지") {
    push(fields, "입주희망", getCustomerMoveInLabel(c));
  }

  const showLoanInsurancePet = !(
    c.roomType === "상가" ||
    c.roomType === "사무실" ||
    c.roomType === "토지" ||
    c.roomType === "건물"
  );
  const showParking = c.roomType !== "토지" && c.roomType !== "건물";
  const showElevator = c.roomType !== "토지";

  if (showLoanInsurancePet) {
    push(fields, "대출", customerNeedLabel(getCustomerLoanLabel(c)));
    if (needsJeonseInsurance(c.dealType, c.roomType)) {
      push(fields, "보증보험", customerNeedLabel(c.insuranceNeeded));
    }
  }
  if (showParking) {
    push(fields, "주차", customerNeedLabel(getCustomerParkingLabel(c)));
  }
  if (showElevator) push(fields, "엘리베이터", yesNoLabel(c.elevatorNeeded));

  push(fields, "메모", str(c.notes) || undefined);
  push(fields, "팀공유", c.workspaceShared ? "유" : "무");
  if (c.contractCompleted) push(fields, "계약완료", "유");

  return {
    id: args.id,
    kind: "customers",
    title: str(c.name) || args.id,
    fields,
    secrets: args.canReveal ? secrets : undefined,
    shared: args.shared,
    deleted: args.deleted,
    createdByName: args.createdByName,
    createdAt: args.createdAt,
    updatedAt: args.updatedAt,
    contractCompleted: Boolean(c.contractCompleted),
  };
}

export function buildAdminPropertyDetail(args: {
  id: string;
  payload: Record<string, unknown>;
  canReveal: boolean;
  shared: boolean;
  deleted: boolean;
  createdByName: string;
  createdAt?: string;
  updatedAt?: string;
}): AdminEntityDetail {
  const p = args.payload as unknown as Property;
  const secrets: Record<string, string> = {};
  const fields = buildPropertyFields(p, secrets);
  if ((args.payload as ListedMeta).contractCompleted) {
    push(fields, "계약완료", "유");
  }

  return {
    id: args.id,
    kind: "properties",
    title: str(p.address) || args.id,
    fields,
    secrets: args.canReveal ? secrets : undefined,
    shared: args.shared,
    deleted: args.deleted,
    createdByName: args.createdByName,
    createdAt: args.createdAt,
    updatedAt: args.updatedAt,
    contractCompleted: Boolean(
      (args.payload as ListedMeta).contractCompleted
    ),
  };
}

type ListedMeta = { contractCompleted?: boolean };

export function buildAdminScheduleDetail(args: {
  id: string;
  payload: Record<string, unknown>;
  canReveal: boolean;
  shared: boolean;
  deleted: boolean;
  createdByName: string;
  createdAt?: string;
  updatedAt?: string;
}): AdminEntityDetail {
  const s = args.payload as unknown as Schedule;
  const fields: AdminDetailField[] = [];
  const secrets: Record<string, string> = {};

  const guest = str(s.guestName);
  const title =
    guest ||
    str(s.customerId) ||
    "네비";

  if (guest) push(fields, "고객(게스트)", guest);
  else if (s.customerId) push(fields, "고객 ID", str(s.customerId));

  push(fields, "방문", formatVisitDateTime(s.visitDate, s.visitTime));
  push(fields, "팀공유", s.workspaceShared ? "유" : "무");
  if (s.visitCompleted) push(fields, "방문완료", "유");

  const props = Array.isArray(s.properties) ? s.properties : [];
  const slots = props.map((prop, i) => ({
    title: `${i + 1}번 매물`,
    fields: buildPropertyFields(prop, secrets, `slot${i}`, {
      includeDoorPasswords: true,
    }),
  }));

  const routes = (Array.isArray(s.routeSummary) ? s.routeSummary : []).map(
    (r) =>
      `${r.fromIndex + 1}→${r.toIndex + 1}: ${Number(r.distanceKm).toFixed(1)} km / 약 ${r.durationMin}분`
  );

  return {
    id: args.id,
    kind: "schedules",
    title,
    fields,
    slots: slots.length ? slots : undefined,
    routes: routes.length ? routes : undefined,
    secrets: args.canReveal ? secrets : undefined,
    shared: args.shared,
    deleted: args.deleted,
    createdByName: args.createdByName,
    createdAt: args.createdAt,
    updatedAt: args.updatedAt,
    visitCompleted: Boolean(s.visitCompleted),
  };
}
