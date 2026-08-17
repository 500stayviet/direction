import { needsRoomBathCounts } from "@/lib/constants";
import {
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
  | "dealType"
  | "location"
  | "money"
  | "dates"
  | "flags"
  | "share"
  | "contacts"
  | "notes";

function formatRoomGuide(parsed: IntakeParseResult): string {
  if (!parsed.roomType) return "";
  if (parsed.roomCount && needsRoomBathCounts(parsed.roomType)) {
    const bath = parsed.bathroomCount ? ` 화${parsed.bathroomCount}` : "";
    return `${parsed.roomCount}룸${bath}`;
  }
  return parsed.roomType;
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
  if (!parsed.dong && !parsed.jibun && !parsed.roomNo && !parsed.buildingName) {
    return "";
  }
  const gu =
    parsed.gu ||
    (parsed.dong ? resolveGuFromDong(parsed.dong) : "") ||
    "";
  const addr = composeSeoulAddress(gu, parsed.dong ?? "", parsed.jibun ?? "");
  return [addr, parsed.buildingName, parsed.roomNo].filter(Boolean).join(" ");
}

function formatContactsGuide(parsed: IntakeParseResult): string {
  const parts: string[] = [];
  if (parsed.tenantPhone) {
    parts.push(`임차인 ${formatPhoneInput(parsed.tenantPhone)}`);
  }
  if (parsed.landlordPhone) {
    parts.push(`임대인 ${formatPhoneInput(parsed.landlordPhone)}`);
  }
  return parts.join(" · ");
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
    const contacts = formatContactsGuide(parsed);
    if (contacts) hits.contacts = contacts;
  }

  const room = formatRoomGuide(parsed);
  if (room) hits.roomType = room;
  if (parsed.dealType) hits.dealType = parsed.dealType;

  const location = formatLocationGuide(parsed, kind);
  if (location) hits.location = location;

  const money = formatMoneyGuide(parsed, kind);
  if (money) hits.money = money;

  if (parsed.moveInImmediate) {
    hits.dates = "바로입주";
  } else {
    const move = intakeMoveInPeriod(parsed);
    if (move) hits.dates = formatGuideMoveInRange(move.from, move.to);
  }

  const flagParts: string[] = [];
  if (parsed.loan) flagParts.push(`대출${formatTalkFlagValue(parsed.loan)}`);
  if (parsed.insurance) flagParts.push(`보증${formatTalkFlagValue(parsed.insurance)}`);
  if (parsed.parking) flagParts.push(`주차${formatTalkFlagValue(parsed.parking)}`);
  if (parsed.elevator) flagParts.push(`엘베${parsed.elevator}`);
  if (flagParts.length > 0) hits.flags = flagParts.join(" · ");
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
