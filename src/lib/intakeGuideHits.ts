import {
  formatCustomerTalkFlagValue,
  formatDepositRent,
  formatGuideMoveInRange,
  formatMoney,
  formatPhoneInput,
} from "@/lib/format";
import {
  intakeMoveInPeriod,
  intakePreferredLocation,
  formatTalkFlagValue,
  parseIntakeText,
  type IntakeKind,
  type IntakeParseResult,
} from "@/lib/intakeParse";
import { parsePreferredDong } from "@/lib/preferredLocation";
import { composeSeoulAddress, resolveGuFromDong } from "@/lib/seoulRegions";

export type IntakeGuideKey =
  | "name"
  | "phone"
  | "roomType"
  | "roomBath"
  | "buildingKind"
  | "landCategory"
  | "landArea"
  | "dealType"
  | "location"
  | "restAddress"
  | "money"
  | "dates"
  | "flags"
  | "elevator"
  | "share"
  | "tenantPhone"
  | "landlordPhone"
  | "notes";

/** 마이크 매물유형 줄: 유형명만. 방·화는 roomBath 칸 */
function formatRoomGuide(parsed: IntakeParseResult): string {
  return parsed.roomType ?? "";
}

export function formatRoomBathGuide(parsed: IntakeParseResult): string {
  if (!parsed.roomCount) return "";
  const parts = [`방 ${parsed.roomCount}개`];
  if (parsed.bathroomCount) {
    parts.push(`화장실 ${parsed.bathroomCount}개`);
  }
  return parts.join(" · ");
}

function formatMoneyGuide(parsed: IntakeParseResult, kind: IntakeKind): string {
  if (!parsed.deposit && !parsed.monthlyRent) return "";
  const deal =
    parsed.dealType || (parsed.monthlyRent ? "월세" : "전세");
  let text = formatDepositRent(
    deal,
    parsed.deposit ?? 0,
    parsed.monthlyRent,
    parsed.depositTo,
    parsed.monthlyRentTo
  );
  if (kind === "property" && parsed.maintenanceFee != null) {
    text += ` · 관리 ${formatMoney(parsed.maintenanceFee)}`;
  }
  return text;
}

function formatLocationGuide(
  parsed: IntakeParseResult,
  kind: IntakeKind
): string {
  if (kind === "customer") {
    const loc = intakePreferredLocation(parsed);
    const labels = loc.preferredDongs
      .map((raw) => parsePreferredDong(raw))
      .filter((p): p is { gu: string; dong: string } => Boolean(p))
      .map((p) => `${p.gu} ${p.dong}`);
    if (labels.length > 0) return labels.join(", ");
    if (parsed.dong) return `${parsed.gu ?? ""} ${parsed.dong}`.trim();
    return "";
  }
  if (!parsed.dong && !parsed.jibun) {
    return "";
  }
  const gu =
    parsed.gu ||
    (parsed.dong ? resolveGuFromDong(parsed.dong) : "") ||
    "";
  return composeSeoulAddress(gu, parsed.dong ?? "", parsed.jibun ?? "");
}

function formatRestAddressGuide(parsed: IntakeParseResult): string {
  return [parsed.buildingName, parsed.roomNo].filter(Boolean).join(" ");
}

export function intakeGuideHits(
  parsed: IntakeParseResult,
  kind: IntakeKind
): Partial<Record<IntakeGuideKey, string>> {
  const hits: Partial<Record<IntakeGuideKey, string>> = {};

  if (kind === "customer" && parsed.name) {
    hits.name = parsed.name;
  }
  if (kind === "customer" && parsed.phone) {
    hits.phone = formatPhoneInput(parsed.phone);
  }
  if (kind === "property") {
    if (parsed.tenantPhone) {
      hits.tenantPhone = formatPhoneInput(parsed.tenantPhone);
    }
    if (parsed.landlordPhone) {
      hits.landlordPhone = formatPhoneInput(parsed.landlordPhone);
    }
  }

  const room = formatRoomGuide(parsed);
  if (room) hits.roomType = room;
  const bath = formatRoomBathGuide(parsed);
  if (bath) hits.roomBath = bath;
  if (parsed.buildingKind) hits.buildingKind = parsed.buildingKind;
  if (parsed.landCategory) hits.landCategory = parsed.landCategory;
  if (parsed.landArea != null) hits.landArea = `${parsed.landArea}평`;
  if (parsed.dealType) hits.dealType = parsed.dealType;

  const location = formatLocationGuide(parsed, kind);
  if (location) hits.location = location;
  if (kind === "property") {
    const rest = formatRestAddressGuide(parsed);
    if (rest) hits.restAddress = rest;
  }

  const money = formatMoneyGuide(parsed, kind);
  if (money) hits.money = money;

  if (parsed.moveInNegotiable) {
    hits.dates = "협의가능";
  } else if (parsed.moveInImmediate) {
    hits.dates = kind === "property" ? "공실" : "바로입주";
  } else {
    const move = intakeMoveInPeriod(parsed);
    if (move) hits.dates = formatGuideMoveInRange(move.from, move.to);
  }

  const flagWord = (value: "유" | "무") =>
    kind === "customer"
      ? formatCustomerTalkFlagValue(value)
      : formatTalkFlagValue(value);
  const flagParts: string[] = [];
  if (parsed.loan) flagParts.push(`대출${flagWord(parsed.loan)}`);
  if (parsed.insurance) flagParts.push(`보증${flagWord(parsed.insurance)}`);
  if (parsed.parking) flagParts.push(`주차${flagWord(parsed.parking)}`);
  if (flagParts.length > 0) hits.flags = flagParts.join(" · ");
  if (parsed.elevator) {
    hits.elevator =
      kind === "customer"
        ? `엘베${formatCustomerTalkFlagValue(parsed.elevator)}`
        : `엘베${parsed.elevator}`;
  }
  if (parsed.workspaceShared) hits.share = `팀공유 ${parsed.workspaceShared}`;

  const notes = parsed.notes.trim();
  if (notes) hits.notes = notes;

  return hits;
}

export function intakeGuideHitsFromText(
  text: string,
  kind: IntakeKind
): Partial<Record<IntakeGuideKey, string>> {
  return intakeGuideHits(parseIntakeText(text, kind), kind);
}
