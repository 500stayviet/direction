import {
  appendIntakeMemo,
  normalizeIntakeInput,
  scrubCorruptIntakeText,
  type IntakeKind,
  type IntakeParseResult,
} from "@/lib/intakeParse";
import { isKnownSeoulDong, SEOUL_GU_LIST } from "@/lib/seoulRegions";

export const INTAKE_AI_MIN_WAIT_MS = 3_000;
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
  dealType?: "매매" | "전세" | "월세";
  deposit?: number;
  monthlyRent?: number;
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

const STRUCTURAL_FIELD_RES = [
  /방\s*[1-9]/g,
  /[1-9]\s*룸/g,
  /화(?:장실)?\s*[1-4]\s*개?/g,
  /\d{1,5}\s*동\s*\d{1,5}\s*호/g,
  /\d{1,3}\s*층\s*\d{1,5}\s*호/g,
  /\d{2,4}\s*호/g,
  /관(?:리비)?\s*\d+(?:\.\d+)?/g,
  /주(?:차)?\s*\d+\s*대/g,
  /(?:실입주|바로입주|즉시입주)(?:\s*가능)?/g,
  /0\d{1,2}[-.\s]?\d{3,4}[-.\s]?\d{4}/g,
];

const MONEY_FIELD_RES = [
  /\d+(?:\.\d+)?\s*억/g,
  /\d{1,3}(?:,\d{3})+\s*만(?:원)?/g,
  /\d+\s*만(?:원)?/g,
  /\d+\s*\/\s*\d+(?:\s*\/\s*\d+)?/g,
  /(?:보증금|월세|매매가|거래가액|전세금|전세가)\s*\d+/g,
];

const YESNO_TAIL =
  "(?:있음|있어요|있고|있습니다|가능(?:해요|합니다|함)?|유|됨|돼요|돼|가능|" +
  "가|불|안(?:됨|돼(?:요)?|됩니다|되)?|없(?:음|어요|어|습니다)?|" +
  "불가(?:능)?(?:해요|합니다|함)?|무)";

function moneyFieldsFilled(parsed: IntakeParseResult): boolean {
  const hasDeposit = Boolean(parsed.deposit && parsed.deposit > 0);
  if (!hasDeposit) return false;
  if (parsed.dealType === "월세") {
    return Boolean(parsed.monthlyRent && parsed.monthlyRent > 0);
  }
  return true;
}

function usedPlaceTokens(parsed: IntakeParseResult): string[] {
  const pairs = [
    ...(parsed.places ?? []),
    parsed.gu && parsed.dong ? { gu: parsed.gu, dong: parsed.dong } : null,
  ].filter((p): p is { gu: string; dong: string } => Boolean(p?.gu && p?.dong));
  const out: string[] = [];
  for (const { gu, dong } of pairs) {
    out.push(`${gu}${dong}`, `${gu} ${dong}`);
    const stem = dong.endsWith("동") ? dong.slice(0, -1) : dong;
    out.push(`${gu}${stem}`, `${gu} ${stem}`);
  }
  return out;
}

function dealTokensToStrip(parsed: IntakeParseResult): string[] {
  if (!parsed.dealType) return [];
  if (parsed.dealType === "월세" && !parsed.monthlyRent) {
    return DEAL_TOKENS.filter((token) => token !== "월세");
  }
  return DEAL_TOKENS;
}

function usedFlagRes(parsed: IntakeParseResult): RegExp[] {
  const out: RegExp[] = [];
  if (parsed.loan) out.push(new RegExp(`대출\\s*${YESNO_TAIL}`, "gi"));
  if (parsed.insurance) {
    out.push(new RegExp(`(?:전세)?보증보험\\s*${YESNO_TAIL}`, "gi"));
  }
  if (parsed.parking) {
    out.push(new RegExp(`주차(?:장)?\\s*${YESNO_TAIL}`, "gi"));
  }
  if (parsed.elevator) {
    out.push(
      new RegExp(
        `(?:엘리베이터|엘레베이터|엘베|승강기)\\s*${YESNO_TAIL}`,
        "gi"
      )
    );
  }
  return out;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** 칸에 쓴 구절만 끊고, leftover 문장 안의 같은 글자는 남긴다 */
function replacePhraseBreaks(text: string, tokens: string[]): string {
  let next = text;
  const unique = [...new Set(tokens.filter(Boolean))].sort(
    (a, b) => b.length - a.length
  );
  for (const token of unique) {
    if (token.length < 2) continue;
    next = next.replace(
      new RegExp(`${escapeRegExp(token)}(?![가-힣])`, "g"),
      "\u0001"
    );
  }
  return next;
}

function applyResBreaks(text: string, res: RegExp[]): string {
  let next = text;
  for (const re of res) {
    next = next.replace(new RegExp(re.source, re.flags), "\u0001");
  }
  return next;
}

function stripUsedFieldPhrases(
  text: string,
  parsed: IntakeParseResult
): string {
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
    ...(parsed.places ?? []).flatMap((p) => [p.gu, p.dong]),
    ...usedPlaceTokens(parsed),
  ].filter((v): v is string => Boolean(v && v.trim()));

  let next = replacePhraseBreaks(text, [
    ...filled,
    ...ROOM_TYPE_TOKENS,
    ...dealTokensToStrip(parsed),
  ]);
  next = applyResBreaks(next, STRUCTURAL_FIELD_RES);
  if (moneyFieldsFilled(parsed)) {
    next = applyResBreaks(next, MONEY_FIELD_RES);
  }
  next = applyResBreaks(next, usedFlagRes(parsed));
  if (parsed.moveInFrom || parsed.moveInImmediate) {
    next = next.replace(
      /\d{2,4}\s*[.\-/]\s*\d{1,2}\s*[.\-/]\s*\d{1,2}/g,
      "\u0001"
    );
    next = next.replace(/\d{1,2}\s*월\s*\d{1,2}\s*일/g, "\u0001");
    next = next.replace(/[~～〜∼\-]+/g, "\u0001");
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
  if (!parsed.dealType) empty.push("dealType");
  if (!parsed.deposit || parsed.deposit <= 0) empty.push("deposit");
  if (
    parsed.dealType !== "전세" &&
    parsed.dealType !== "매매" &&
    (!parsed.monthlyRent || parsed.monthlyRent <= 0)
  ) {
    empty.push("monthlyRent");
  }
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

  text = text
    .replace(
      /(?:메모|내용|추가\s*내용|추가\s*희망\s*사항|희망\s*사항|비고|특이\s*사항|참고|요청\s*사항|기타)\s*[:：。][\s\S]*$/i,
      " "
    )
    .trim();

  text = stripUsedFieldPhrases(text, parsed);

  const noteBits = parsed.notes
    .split(/\n+/)
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter((part) => part.length >= 2);
  text = replacePhraseBreaks(text, noteBits);

  const leftover = text
    .split(/[\n\u0001]+/)
    .map((part) =>
      part
        .replace(/[()[\]{}<>'"“”‘’]/g, " ")
        .replace(/[:：]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
    )
    .filter((part) => /[가-힣]{2,}/.test(part))
    .join(" ")
    .trim();

  if (!/[가-힣]{2,}/.test(leftover)) return "";
  const cleaned = scrubCorruptIntakeText(leftover).replace(/\s+/g, " ").trim();
  if (!/[가-힣]{2,}/.test(cleaned)) return "";
  return cleaned.slice(0, leftoverMaxForSource(source));
}

const DATE_HINT =
  /\d{2,4}\s*[.\-/]\s*\d{1,2}|\d+\s*월\s*\d+\s*일|즉시|바로\s*입주|실입주/;
const JIBUN_HINT = /\d{1,5}\s*-\s*\d{1,5}/;
const ROOM_HINT = /\d+\s*(?:동|층|호)/;
const FIELD_RESIDUE_HINT =
  /보증금|월세|매매가|거래가액|전세금|입주희망|희망일|\d{1,2}\s*월|\d{1,2}\s*일|\d+\s*(?:억|만)|메모/;
const FLAG_RESIDUE_HINT =
  /(?:대출|보증보험|주차|엘베|엘리베이터)\s*[유무있없가능불가]/;

const MEMO_ONLY_HINT =
  /일요일|불가|예약|저녁|남향|북향|동향|서향|저층|고층|중층|희망층|애완|반려|허그|있으면\s*좋|없어도\s*되/;

/** 일요일 불가처럼 숫자·칸 단어가 없으면 메모. 그 외 잔여는 DeepSeek. */
function leftoverLooksLikeMemoOnly(text: string): boolean {
  if (/\d/.test(text)) return false;
  if (FLAG_RESIDUE_HINT.test(text)) return false;
  if (FIELD_RESIDUE_HINT.test(text)) return false;
  if (SEOUL_GU_LIST.some((gu) => text.includes(gu))) return false;
  for (const m of text.matchAll(/[가-힣]{1,6}동/g)) {
    if (isKnownSeoulDong(m[0] ?? "")) return false;
  }
  if (JIBUN_HINT.test(text) || ROOM_HINT.test(text)) return false;
  return true;
}

/** 빈 칸을 채울 잔여·애매한 잔여는 DeepSeek. 분명한 메모만 내용에 붙인다. */
export function leftoverNeedsAi(
  leftover: string,
  parsed: IntakeParseResult
): boolean {
  const text = scrubCorruptIntakeText(leftover).replace(/\s+/g, " ").trim();
  if (text.length < 2) return false;
  if (MEMO_ONLY_HINT.test(text) && leftoverLooksLikeMemoOnly(text)) {
    return false;
  }

  const needName = !parsed.name?.trim();
  const needGu = !parsed.gu?.trim();
  const needDong = !parsed.dong?.trim();
  const needJibun = !parsed.jibun?.trim();
  const needRoom = !parsed.roomNo?.trim();
  const needMove = !parsed.moveInFrom && !parsed.moveInImmediate;
  const needDeal = !parsed.dealType;
  const needDeposit = !parsed.deposit || parsed.deposit <= 0;
  const needRent =
    parsed.dealType !== "전세" &&
    parsed.dealType !== "매매" &&
    (!parsed.monthlyRent || parsed.monthlyRent <= 0);

  if (needDeal && /매매|전세|월세/.test(text)) return true;
  if (needDeposit && /(?:보증금|전세가|매매가|\d+\s*(?:억|만))/.test(text)) {
    return true;
  }
  if (needRent && /월세\s*\d+|\d+\s*\/\s*\d+/.test(text)) return true;

  if (needDong) {
    for (const m of text.matchAll(/[가-힣]{1,6}동/g)) {
      if (isKnownSeoulDong(m[0] ?? "")) return true;
    }
  }
  if (needGu && SEOUL_GU_LIST.some((gu) => text.includes(gu))) return true;
  if (needJibun && JIBUN_HINT.test(text)) return true;
  if (needRoom && ROOM_HINT.test(text)) return true;
  if (needMove && DATE_HINT.test(text)) return true;
  if (
    needName &&
    /^[가-힣]{2,6}$/.test(text) &&
    !text.endsWith("동") &&
    !isKnownSeoulDong(text)
  ) {
    return true;
  }
  if (leftoverLooksLikeMemoOnly(text)) return false;
  return true;
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

function sanitizeDealType(value: unknown): IntakeAiPatch["dealType"] {
  if (value === "매매" || value === "전세" || value === "월세") return value;
  return undefined;
}

function toPositiveInt(value: unknown): number | undefined {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value.replace(/,/g, "").trim())
        : NaN;
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) return undefined;
  return n;
}

const MAX_DEPOSIT_MAN = 2_000_000;
const MIN_MONTHLY_RENT = 5;
const MAX_MONTHLY_RENT = 300;

function sanitizeDepositManwon(
  value: unknown,
  leftover: string
): number | undefined {
  const n = toPositiveInt(value);
  if (n == null) return undefined;
  const asEok = n >= 1 && n <= 99 && /억/.test(leftover) ? n * 10000 : n;
  if (asEok > MAX_DEPOSIT_MAN) return undefined;
  return asEok;
}

function sanitizeMonthlyRent(value: unknown): number | undefined {
  const n = toPositiveInt(value);
  if (n == null) return undefined;
  if (n < MIN_MONTHLY_RENT || n > MAX_MONTHLY_RENT) return undefined;
  return n;
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
  const dealType = sanitizeDealType(raw.dealType);
  if (dealType) patch.dealType = dealType;
  const deposit = sanitizeDepositManwon(raw.deposit, leftover);
  if (deposit) patch.deposit = deposit;
  const monthlyRent = sanitizeMonthlyRent(raw.monthlyRent);
  if (monthlyRent) patch.monthlyRent = monthlyRent;

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
  if (!next.dealType && patch.dealType) next.dealType = patch.dealType;
  if (!(next.deposit && next.deposit > 0) && patch.deposit) {
    next.deposit = patch.deposit;
  }
  if (
    !(next.monthlyRent && next.monthlyRent > 0) &&
    patch.monthlyRent &&
    (next.dealType === "월세" || next.dealType === undefined)
  ) {
    next.monthlyRent = patch.monthlyRent;
    if (!next.dealType) next.dealType = "월세";
  }

  if (!next.moveInFrom && !next.moveInImmediate) {
    if (patch.moveInFrom) {
      next.moveInFrom = patch.moveInFrom;
      next.moveInTo = patch.moveInTo || patch.moveInFrom;
    } else if (patch.moveInImmediate) {
      next.moveInImmediate = true;
    }
  }

  if (patch.buildingName) {
    next.notes = appendIntakeMemo(next.notes, scrubCorruptIntakeText(patch.buildingName));
  }
  if (patch.memo) {
    next.notes = appendIntakeMemo(next.notes, scrubCorruptIntakeText(patch.memo));
  }
  next.notes = scrubCorruptIntakeText(next.notes);
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
