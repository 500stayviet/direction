import {
  appendIntakeMemo,
  normalizeIntakeInput,
  type IntakeKind,
  type IntakeParseResult,
} from "@/lib/intakeParse";
import { isKnownSeoulDong, SEOUL_GU_LIST } from "@/lib/seoulRegions";

export const INTAKE_AI_MIN_WAIT_MS = 500;
export const INTAKE_AI_LEFTOVER_MAX = 200;
export const INTAKE_AI_LEFTOVER_MAX_OCR = 280;

export type IntakeAiSource = "message" | "photo";

export type IntakeAiPatch = {
  name?: string;
  buildingName?: string;
  gu?: string;
  dong?: string;
  jibun?: string;
  roomNo?: string;
  moveInFrom?: string;
  moveInTo?: string;
  moveInImmediate?: boolean;
  memo?: string;
};

const ROOM_TYPE_TOKENS = [
  "오피스텔",
  "오피텔",
  "아파트",
  "사무실",
  "오피스",
  "쓰리룸+",
  "쓰리룸",
  "3룸+",
  "투룸",
  "원룸",
  "상가",
  "점포",
  "토지",
  "통건물",
  "건물",
  "다섯룸",
  "네룸",
  "포룸",
  "2룸",
  "1룸",
  "3룸",
  "오피",
].sort((a, b) => b.length - a.length);

const DEAL_TOKENS = ["매매가", "매매", "전세", "월세", "매가"];

const CONSUMED_RES = [
  /방\s*[1-9]/g,
  /[1-9]\s*룸/g,
  /화(?:장실)?\s*[1-4]\s*개?/g,
  /\d{1,5}\s*동\s*\d{1,5}\s*호/g,
  /\d{1,3}\s*층\s*\d{1,5}\s*호/g,
  /\d{2,4}\s*호/g,
  /관(?:리비)?\s*\d+(?:\.\d+)?/g,
  /주(?:차)?\s*\d+\s*대/g,
  /(?:엘리베이터|엘레베이터|엘베)/g,
  /(?:실입주|바로입주|즉시입주)(?:\s*가능)?/g,
  /주차(?:\s*가능)?/g,
  /\d+(?:\.\d+)?\s*억/g,
  /\d{1,3}(?:,\d{3})+\s*만(?:원)?/g,
  /\d+\s*만(?:원)?/g,
  /\d+\s*\/\s*\d+(?:\s*\/\s*\d+)?/g,
  /0\d{1,2}[-.\s]?\d{3,4}[-.\s]?\d{4}/g,
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceLongest(text: string, tokens: string[]): string {
  let next = text;
  const unique = [...new Set(tokens.filter(Boolean))].sort(
    (a, b) => b.length - a.length
  );
  for (const token of unique) {
    if (token.length < 2) continue;
    next = next.replace(new RegExp(escapeRegExp(token), "g"), " ");
  }
  return next;
}

export function leftoverMaxForSource(source: IntakeAiSource): number {
  return source === "photo"
    ? INTAKE_AI_LEFTOVER_MAX_OCR
    : INTAKE_AI_LEFTOVER_MAX;
}

export function listEmptyIntakeAiFields(parsed: IntakeParseResult): string[] {
  const empty: string[] = [];
  if (!parsed.name?.trim()) empty.push("name");
  if (!parsed.gu?.trim()) empty.push("gu");
  if (!parsed.dong?.trim()) empty.push("dong");
  if (!parsed.jibun?.trim()) empty.push("jibun");
  if (!parsed.roomNo?.trim()) empty.push("roomNo");
  if (!parsed.moveInFrom && !parsed.moveInImmediate) {
    empty.push("moveInFrom", "moveInTo", "moveInImmediate");
  }
  empty.push("buildingName", "memo");
  return empty;
}

export function intakeAiLeftover(
  raw: string,
  parsed: IntakeParseResult,
  source: IntakeAiSource = "message"
): string {
  let text = normalizeIntakeInput(raw);
  if (!text) return "";

  const filled = [
    parsed.name,
    parsed.phone,
    parsed.tenantPhone,
    parsed.landlordPhone,
    parsed.gu,
    parsed.dong,
    parsed.jibun,
    parsed.roomNo,
    parsed.roomType,
    parsed.dealType,
  ].filter((v): v is string => Boolean(v && v.trim()));

  text = replaceLongest(text, [...filled, ...ROOM_TYPE_TOKENS, ...DEAL_TOKENS]);

  for (const re of CONSUMED_RES) {
    text = text.replace(new RegExp(re.source, re.flags), " ");
  }

  if (parsed.moveInFrom || parsed.moveInImmediate) {
    text = text.replace(
      /\d{2,4}\s*[.\-/]\s*\d{1,2}\s*[.\-/]\s*\d{1,2}/g,
      " "
    );
  }

  const noteBits = parsed.notes
    .split(/[\/|,]+/)
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter((part) => part.length >= 2);
  text = replaceLongest(text, noteBits);

  text = text
    .replace(/[()[\]{}<>'"“”‘’]/g, " ")
    .replace(/[:：]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!/[가-힣]{2,}/.test(text)) return "";
  return text.slice(0, leftoverMaxForSource(source));
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

function sanitizeName(value: string): string | undefined {
  const name = value.replace(/\s+/g, "").trim();
  if (!/^[가-힣]{2,6}$/.test(name)) return undefined;
  if (name.endsWith("동") && isKnownSeoulDong(name)) return undefined;
  return name;
}

function sanitizeBuildingName(value: string): string | undefined {
  const name = value.replace(/\s+/g, "").trim();
  if (!/^[가-힣A-Za-z0-9]{2,24}$/.test(name)) return undefined;
  if (isKnownSeoulDong(name)) return undefined;
  if (/^\d+$/.test(name)) return undefined;
  return name;
}

function sanitizeRoomNo(value: string): string | undefined {
  const next = value.replace(/\s+/g, " ").trim();
  if (
    /^\d{1,4}동\s+\d{1,4}호$/.test(next) ||
    /^\d{1,3}층\s+\d{1,4}호$/.test(next) ||
    /^\d{1,4}호$/.test(next) ||
    /^\d{1,3}층$/.test(next)
  ) {
    return next;
  }
  return undefined;
}

function sanitizeJibun(value: string): string | undefined {
  const next = value.replace(/\s+/g, "").trim();
  return /^\d{1,5}(?:-\d{1,5})?$/.test(next) ? next : undefined;
}

function sanitizeMemo(value: string): string | undefined {
  const next = value.replace(/\s+/g, " ").trim();
  if (!next) return undefined;
  if (/^\d{1,2}[.,]\d{1,2}$/.test(next)) return next;
  return next.slice(0, 200);
}

export function sanitizeIntakeAiPatch(
  input: unknown,
  leftover = ""
): IntakeAiPatch {
  if (!input || typeof input !== "object") return {};
  const raw = input as Record<string, unknown>;
  const patch: IntakeAiPatch = {};

  if (typeof raw.name === "string") {
    const name = sanitizeName(raw.name);
    if (name) patch.name = name;
  }
  if (typeof raw.buildingName === "string") {
    const building = sanitizeBuildingName(raw.buildingName);
    if (building) patch.buildingName = building;
  }
  if (typeof raw.gu === "string") {
    const gu = raw.gu.replace(/\s+/g, "").trim();
    if ((SEOUL_GU_LIST as readonly string[]).includes(gu)) patch.gu = gu;
  }
  if (typeof raw.dong === "string") {
    const dong = raw.dong.replace(/\s+/g, "").trim();
    if (isKnownSeoulDong(dong)) patch.dong = dong;
  }
  if (typeof raw.jibun === "string") {
    const jibun = sanitizeJibun(raw.jibun);
    if (jibun) patch.jibun = jibun;
  }
  if (typeof raw.roomNo === "string") {
    const roomNo = sanitizeRoomNo(raw.roomNo);
    if (roomNo) patch.roomNo = roomNo;
  }

  const consultMoveIn = /이사\s*협의/.test(leftover);
  if (!consultMoveIn && typeof raw.moveInFrom === "string") {
    const from = raw.moveInFrom.trim();
    if (isIsoDate(from)) patch.moveInFrom = from;
  }
  if (!consultMoveIn && typeof raw.moveInTo === "string") {
    const to = raw.moveInTo.trim();
    if (isIsoDate(to)) patch.moveInTo = to;
  }
  if (!consultMoveIn && raw.moveInImmediate === true) {
    patch.moveInImmediate = true;
  }
  if (typeof raw.memo === "string") {
    const memo = sanitizeMemo(raw.memo);
    if (memo) patch.memo = memo;
  }
  return patch;
}

export function mergeIntakeAi(
  parsed: IntakeParseResult,
  patchInput: unknown,
  leftover = ""
): IntakeParseResult {
  const patch = sanitizeIntakeAiPatch(patchInput, leftover);
  const next: IntakeParseResult = {
    ...parsed,
    options: [...parsed.options],
    notes: parsed.notes,
  };

  if (!next.name && patch.name) next.name = patch.name;
  if (!next.gu && patch.gu) next.gu = patch.gu;
  if (!next.dong && patch.dong) next.dong = patch.dong;
  if (!next.jibun && patch.jibun) next.jibun = patch.jibun;
  if (!next.roomNo && patch.roomNo) next.roomNo = patch.roomNo;

  if (!next.moveInFrom && !next.moveInImmediate) {
    if (patch.moveInFrom) {
      next.moveInFrom = patch.moveInFrom;
      next.moveInTo = patch.moveInTo || patch.moveInFrom;
    } else if (patch.moveInImmediate) {
      next.moveInImmediate = true;
    }
  }

  if (patch.buildingName) {
    next.notes = appendIntakeMemo(next.notes, patch.buildingName);
  }
  if (patch.memo) {
    next.notes = appendIntakeMemo(next.notes, patch.memo);
  }
  return next;
}

export function buildIntakeAiUserPrompt(opts: {
  leftover: string;
  kind: IntakeKind;
  emptyFields: string[];
}): string {
  return [
    `구분: ${opts.kind === "property" ? "매물" : "고객"}`,
    `비어 있는 칸: ${opts.emptyFields.join(", ") || "(없음)"}`,
    "잔여 글:",
    opts.leftover,
  ].join("\n");
}
