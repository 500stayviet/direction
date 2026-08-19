import type { DealType, ListedProperty, PetAllowed, Property, RouteSummary, Schedule } from "@/lib/types";

export type NaviMeetingSampleStatus = "new" | "exported" | "reviewed";

export type NaviMeetingRawPayload = {
  scheduleId: string;
  customerId?: string | null;
  guestName?: string | null;
  visitDate?: string | null;
  visitTime?: string | null;
  workspaceShared?: boolean;
  properties: Array<{
    id: string;
    address?: string | null;
    buildingName?: string | null;
    roomNo?: string | null;
    roomType?: string | null;
    dealType?: DealType | null;
    deposit?: number | null;
    monthlyRent?: number | null;
    parkingType?: string | null;
    elevator?: boolean | null;
    insuranceType?: string | null;
    loanAvailable?: string | null;
    petAllowed?: PetAllowed | null;
    usableArea?: number | null;
    moveInFrom?: string | null;
    moveInVacant?: boolean | null;
    moveInNegotiable?: boolean | null;
    notes?: string | null;
  }>;
  routeStops: RouteSummary[];
};

export type NaviMeetingParsedPayload = {
  scheduleId: string;
  customer: {
    customerId?: string | null;
    guestName?: string | null;
  };
  visit: {
    date?: string | null;
    time?: string | null;
  };
  /**
   * 커서가 규칙을 만들기 쉽게:
   * - “고객-매물(선택된 property)” 쌍 단위로 펼쳐둠
   * - 각 pair는 해당 일정(schedule)의 customer에 매핑됨
   */
  pairs: Array<{
    customer: NaviMeetingParsedPayload["customer"];
    property: NaviMeetingRawPayload["properties"][number];
  }>;
  routeStops: RouteSummary[];
};

const PHONE_REGEX =
  /(\b0\d{1,2}[-.\s]?\d{3,4}[-.\s]?\d{4}\b)|(\b\+?82\s*\d{1,2}[-.\s]?\d{3,4}[-.\s]?\d{4}\b)/g;

function maskPhone(s: string): string {
  return s.replace(PHONE_REGEX, "****");
}

function maskPropertyForSample(p: Property): NaviMeetingRawPayload["properties"][number] {
  // 파서 개선용: 주소/금액/옵션 위주로 남기고 전화·비밀번호 등은 제거/마스킹
  return {
    id: p.id,
    address: p.address ?? null,
    buildingName: p.buildingName ?? null,
    roomNo: p.roomNo ?? null,
    roomType: p.roomType ?? null,
    dealType: p.dealType ?? null,
    deposit: p.deposit ?? null,
    monthlyRent: p.monthlyRent ?? null,
    parkingType: p.parkingType ?? null,
    elevator: p.elevator ?? null,
    insuranceType: p.insuranceType ?? null,
    loanAvailable: p.loanAvailable ?? null,
    petAllowed: p.petAllowed ?? null,
    usableArea: p.usableArea ?? null,
    moveInFrom: p.moveInFrom ?? null,
    moveInVacant: p.moveInVacant ?? null,
    moveInNegotiable: p.moveInNegotiable ?? null,
    notes: p.notes ? maskPhone(p.notes) : null,
  };
}

export function buildNaviMeetingRawPayload(schedule: Schedule): NaviMeetingRawPayload {
  return {
    scheduleId: schedule.id,
    customerId: schedule.customerId ?? null,
    guestName: schedule.guestName ? maskPhone(schedule.guestName) : null,
    visitDate: schedule.visitDate ?? null,
    visitTime: schedule.visitTime ?? null,
    workspaceShared: Boolean(schedule.workspaceShared),
    properties: schedule.properties.map(maskPropertyForSample),
    routeStops: schedule.routeSummary ?? [],
  };
}

export function buildNaviMeetingParsedPayload(
  raw: NaviMeetingRawPayload
): NaviMeetingParsedPayload {
  const customer = {
    customerId: raw.customerId ?? null,
    guestName: raw.guestName ?? null,
  };

  return {
    scheduleId: raw.scheduleId,
    customer,
    visit: {
      date: raw.visitDate ?? null,
      time: raw.visitTime ?? null,
    },
    pairs: raw.properties.map((property) => ({
      customer,
      property,
    })),
    routeStops: raw.routeStops,
  };
}

export function listMissingNaviMeetingFields(
  raw: NaviMeetingRawPayload
): string[] {
  const missing: string[] = [];
  if (!raw.customerId && !raw.guestName) missing.push("customer");
  if (!raw.visitDate) missing.push("visitDate");
  if (raw.visitTime == null || raw.visitTime === "") missing.push("visitTime");
  if (!raw.properties || raw.properties.length === 0) missing.push("properties");
  const badProp = raw.properties?.some((p) => !p.address);
  if (badProp) missing.push("property.address");
  return missing;
}

export function shouldRecordNaviMeetingSample(schedule: Schedule): boolean {
  if (!schedule?.id) return false;
  if (!schedule.properties || schedule.properties.length === 0) return false;
  return Boolean(schedule.visitDate || schedule.visitTime);
}

