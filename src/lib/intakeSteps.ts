import type { IntakeGuideKey } from "@/lib/intakeGuideHits";
import { intakeGuideHits } from "@/lib/intakeGuideHits";
import {
  normalizeIntakeInput,
  parseAllYesNoFields,
  parseIntakeText,
  consumeYesNoField,
  type IntakeKind,
  type IntakeParseResult,
  type IntakeYesNoField,
  formatTalkFlagValue,
} from "@/lib/intakeParse";

export type IntakeStepKey = IntakeGuideKey;

export type IntakeStepLine = {
  key: IntakeStepKey;
  name: string;
  example?: string;
};

export const INTAKE_GUIDE_STEPS: Record<IntakeKind, IntakeStepLine[]> = {
  customer: [
    { key: "name", name: "고객명 또는 명칭", example: "홍길동  ·  명칭 성내" },
    { key: "phone", name: "전화번호", example: "010-1234-5678" },
    { key: "roomType", name: "매물유형", example: "원룸 등" },
    { key: "dealType", name: "거래종류", example: "매매 전세 월세" },
    { key: "location", name: "선호위치", example: "강동구 oo동" },
    { key: "money", name: "거래가액", example: "매매가 보증금 월세(월세 시)" },
    {
      key: "dates",
      name: "입주희망일",
      example: "○○월 ○○일    부터    ○○월 ○○일",
    },
    {
      key: "flags",
      name: "대출 · 보증보험 · 주차 · 엘베 (가능 / 불가)",
      example: "대출 가능 · 보증 불가 · 주차 가능 · 엘베 불가",
    },
    { key: "share", name: "팀공유 (유 / 무)" },
    { key: "notes", name: "메모", example: "메모: 남향 저층" },
  ],
  property: [
    { key: "roomType", name: "매물유형", example: "원룸 등" },
    { key: "dealType", name: "거래종류", example: "매매 전세 월세" },
    { key: "location", name: "주소", example: "강동구 oo동, 101동 102호" },
    { key: "money", name: "거래가액", example: "매매가 보증금 월세(월세 시)" },
    {
      key: "dates",
      name: "임대가능일",
      example: "○○월 ○○일    부터    ○○월 ○○일",
    },
    {
      key: "flags",
      name: "대출 · 보증보험 · 주차 · 엘베 (가능 / 불가)",
      example: "대출 가능 · 보증 불가 · 주차 가능 · 엘베 불가",
    },
    {
      key: "contacts",
      name: "임차인 · 임대인 전화번호",
      example: "010-1234-5678",
    },
    { key: "share", name: "팀공유 (유 / 무)" },
    { key: "notes", name: "메모", example: "메모: 남향 저층" },
  ],
};

export type IntakeStepParseOutcome = {
  ok: boolean;
  partial: Partial<IntakeParseResult>;
  display: string;
};

export type IntakeStepCancelSplit = {
  cancel: boolean;
  remainder: string;
};

const CANCEL_ONLY =
  /^(?:삭제|지워(?:주세요|줘)?|지우기|취소|없애(?:줘|주세요)?|아니(?:야|요|인데)?|틀렸(?:어|어요|습니다)?|다시)$/;

export function splitIntakeStepCancel(text: string): IntakeStepCancelSplit {
  const trimmed = text.trim();
  if (!trimmed) return { cancel: false, remainder: "" };
  const prefixed = trimmed.match(
    /^(?:삭제|지워(?:주세요|줘)?|지우기|취소|없애(?:줘|주세요)?|아니(?:야|요|인데)?|틀렸(?:어|어요|습니다)?|다시)\s+(.+)$/
  );
  if (prefixed?.[1]) {
    return { cancel: true, remainder: prefixed[1].trim() };
  }
  if (CANCEL_ONLY.test(trimmed)) {
    return { cancel: true, remainder: "" };
  }
  return { cancel: false, remainder: trimmed };
}

const NAME_LABEL_WORD =
  /^(?:고객명|명칭|이름|성함|성명)(?:[:：.]?)$/;

function stripSpeechTail(word: string): string {
  return word.replace(/(?:입니다|습니까|이요|예요|에요|이야|야|요)$/, "");
}

/** 대화 고객명 줄: 단어 첫 번째(라벨이면 그다음)만 칸에 넣는다 */
function parseTalkNameStep(text: string): string | undefined {
  const inline = text.match(
    /^(?:고객명|명칭|이름|성함|성명)\s*[.:：]?\s*([가-힣]{2,6})/
  );
  if (inline?.[1]) return inline[1];

  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return undefined;

  const first = stripSpeechTail(words[0].replace(/[:：.]/g, ""));
  if (words.length >= 2 && NAME_LABEL_WORD.test(first)) {
    const next = stripSpeechTail(words[1].replace(/[:：.]/g, ""));
    return /^[가-힣]{2,6}$/.test(next) ? next : undefined;
  }

  return /^[가-힣]{2,6}$/.test(first) ? first : undefined;
}

function stepDisplay(
  partial: Partial<IntakeParseResult>,
  kind: IntakeKind,
  key: IntakeStepKey
): string {
  const parsed = {
    options: [],
    notes: "",
    ...partial,
  } as IntakeParseResult;
  return intakeGuideHits(parsed, kind)[key] ?? "";
}

function priorContext(
  prior: Partial<IntakeParseResult> | undefined,
  kind: IntakeKind
): string {
  if (!prior) return "";
  const bits: string[] = [];
  if (prior.roomType) bits.push(prior.roomType);
  if (prior.dealType) bits.push(prior.dealType);
  if (prior.dong) bits.push(prior.dong);
  if (prior.gu && kind === "property") bits.push(prior.gu);
  return bits.join(" ");
}

/** 거래종류 토큰이 단독으로 있는지 (매매가·전세대출 등은 제외) */
function hasStandaloneDealType(
  text: string,
  dealType: IntakeParseResult["dealType"]
): boolean {
  if (!dealType) return false;
  if (dealType === "매매") {
    return /(?:^|\s)매매(?!\s*가)(?:\s|$)/.test(text);
  }
  if (dealType === "전세") {
    return /(?:^|\s)전세(?!대출)(?:\s|$)/.test(text);
  }
  return new RegExp(`(?:^|\\s)${dealType}(?:\\s|$)`).test(text);
}

/** 짧은 답변에만 이전 단계 맥락을 붙인다. 전체 문장을 다시 말하면 중복 매매 등으로 파싱이 깨진다. */
function stepParseInput(
  text: string,
  step: IntakeStepKey,
  kind: IntakeKind,
  prior?: Partial<IntakeParseResult>
): string {
  if (step === "dealType" || step === "roomType") return text;
  const prefix = priorContext(prior, kind);
  if (!prefix) return text;
  if (prior?.dealType && hasStandaloneDealType(text, prior.dealType)) return text;
  return [prefix, text].filter(Boolean).join(" ");
}

const FLAG_FIELDS: IntakeYesNoField[] = [
  "loan",
  "insurance",
  "parking",
  "elevator",
];

export function nextFlagField(
  partial: Partial<IntakeParseResult>
): IntakeYesNoField | null {
  for (const field of FLAG_FIELDS) {
    if (!partial[field]) return field;
  }
  return null;
}

export function flagsStepComplete(
  partial: Partial<IntakeParseResult> | undefined
): boolean {
  if (!partial) return false;
  return FLAG_FIELDS.every((field) => partial[field]);
}

export function flagsHasAny(
  partial: Partial<IntakeParseResult> | undefined
): boolean {
  if (!partial) return false;
  return FLAG_FIELDS.some((field) => partial[field]);
}

export function formatFlagsValueLine(
  partial: Partial<IntakeParseResult>,
  compact = true
): string {
  const parts: string[] = [];
  if (partial.loan) {
    parts.push(
      compact
        ? `대출${formatTalkFlagValue(partial.loan)}`
        : `대출 ${formatTalkFlagValue(partial.loan)}`
    );
  }
  if (partial.insurance) {
    parts.push(
      compact
        ? `보증${formatTalkFlagValue(partial.insurance)}`
        : `보증보험 ${formatTalkFlagValue(partial.insurance)}`
    );
  }
  if (partial.parking) {
    parts.push(
      compact
        ? `주차${formatTalkFlagValue(partial.parking)}`
        : `주차 ${formatTalkFlagValue(partial.parking)}`
    );
  }
  if (partial.elevator) {
    parts.push(
      compact
        ? `엘베${formatTalkFlagValue(partial.elevator)}`
        : `엘베 ${formatTalkFlagValue(partial.elevator)}`
    );
  }
  return parts.join(" · ");
}

function mergeFlagsFromText(
  existing: Partial<IntakeParseResult>,
  text: string
): Partial<IntakeParseResult> | null {
  const parsed = parseAllYesNoFields(text);
  const partial: Partial<IntakeParseResult> = { ...existing, options: [] };
  let foundAny = false;
  for (const field of FLAG_FIELDS) {
    if (partial[field] || !parsed[field]) continue;
    partial[field] = parsed[field];
    foundAny = true;
  }
  return foundAny ? partial : null;
}

const FLAG_FIELD_EXAMPLES: Record<IntakeYesNoField, string> = {
  loan: "대출 가능",
  insurance: "보증 불가",
  parking: "주차 가능",
  elevator: "엘베 불가",
};

export function formatFlagsActiveExample(
  partial: Partial<IntakeParseResult> | undefined
): string {
  const missing = FLAG_FIELDS.filter((field) => !partial?.[field]);
  if (missing.length === 0) return "";
  return `순서 상관없이 · 예) ${FLAG_FIELD_EXAMPLES[missing[0]!]}`;
}


function consumeAfterToken(
  text: string,
  token: string,
  preferLast = false
): string {
  const idx = preferLast ? text.lastIndexOf(token) : text.indexOf(token);
  if (idx < 0) return text;
  return text.slice(idx + token.length).replace(/^\s+/, "");
}

function locationConsumedEnd(
  text: string,
  partial: Partial<IntakeParseResult>,
  kind: IntakeKind
): number {
  let end = 0;
  const bump = (token?: string) => {
    if (!token) return;
    const idx = text.lastIndexOf(token);
    if (idx >= 0) end = Math.max(end, idx + token.length);
  };
  bump(partial.roomNo);
  bump(partial.jibun);
  bump(partial.dong);
  if (kind === "property") bump(partial.gu);
  if (kind === "customer") {
    for (const place of partial.places ?? []) {
      bump(place.dong);
      bump(place.gu);
    }
    bump(partial.gu);
    bump(partial.dong);
  }
  return end;
}

const TALK_MONEY_SPAN =
  /(?:매매(?:가)?|전세(?:가)?|보증금|보증|월세)\s*(?:\d+(?:\.\d+)?\s*(?:억(?:\s*\d+(?:\.\d+)?\s*(?:천|만))?|만)|\d+(?:\.\d+)?\s*\/\s*\d+(?:\.\d+)?)|(?:^|\s)(\d+(?:\.\d+)?\s*억(?:\s*\d+(?:\.\d+)?\s*(?:천|만))?)/g;

function moneyConsumedEnd(text: string): number {
  let end = 0;
  for (const m of text.matchAll(TALK_MONEY_SPAN)) {
    if (m.index != null) end = Math.max(end, m.index + m[0].length);
  }
  return end;
}

const TALK_DATE_SPAN =
  /(?:바로\s*입주|즉시\s*입주|\d+\s*월\s*\d+\s*일(?:\s*(?:부터|까지))?|\d+\s*월\s*\d+)/g;

function datesConsumedEnd(text: string): number {
  let end = 0;
  for (const m of text.matchAll(TALK_DATE_SPAN)) {
    if (m.index != null) end = Math.max(end, m.index + m[0].length);
  }
  return end;
}

/** 한 발화에서 현재 단계를 채운 뒤, 남은 글을 다음 단계 입력으로 넘긴다 */
export function extractTalkStepRemainder(
  raw: string,
  step: IntakeStepKey,
  partial: Partial<IntakeParseResult>,
  kind: IntakeKind
): string {
  const text = normalizeIntakeInput(raw);
  if (!text) return "";

  if (step === "name" && partial.name) {
    return consumeAfterToken(text, partial.name);
  }
  if (step === "phone" && partial.phone) {
    const digits = partial.phone.replace(/\D/g, "");
    const idx = text.replace(/\D/g, "").indexOf(digits);
    if (idx >= 0) {
      let seen = 0;
      for (let i = 0; i < text.length; i += 1) {
        if (/\d/.test(text[i] ?? "")) {
          if (seen === idx) return text.slice(i + digits.length).replace(/^\s+/, "");
          seen += 1;
        }
      }
    }
    return consumeAfterToken(text, partial.phone, true);
  }
  if (step === "roomType" && partial.roomType) {
    return consumeAfterToken(text, partial.roomType);
  }
  if (step === "dealType" && partial.dealType) {
    return consumeAfterToken(text, partial.dealType);
  }
  if (step === "location") {
    const end = locationConsumedEnd(text, partial, kind);
    return end > 0 ? text.slice(end).replace(/^\s+/, "") : "";
  }
  if (step === "money" && (partial.deposit || partial.monthlyRent)) {
    const end = moneyConsumedEnd(text);
    return end > 0 ? text.slice(end).replace(/^\s+/, "") : "";
  }
  if (
    step === "dates" &&
    (partial.moveInFrom || partial.moveInImmediate)
  ) {
    const end = datesConsumedEnd(text);
    return end > 0 ? text.slice(end).replace(/^\s+/, "") : "";
  }
  if (step === "flags") {
    let remainder = text;
    for (const field of FLAG_FIELDS) {
      if (!partial[field]) continue;
      const hit = consumeYesNoField(remainder, field);
      if (hit) remainder = hit.remainder;
    }
    return remainder;
  }
  if (step === "share" && partial.workspaceShared) {
    return consumeAfterToken(text, `팀공유 ${partial.workspaceShared}`, true);
  }
  if (
    step === "contacts" &&
    (partial.phone || partial.tenantPhone || partial.landlordPhone)
  ) {
    const phone = partial.landlordPhone || partial.tenantPhone || partial.phone;
    if (phone) return consumeAfterToken(text, phone.replace(/-/g, ""), true);
  }
  return "";
}

export type IntakeStepChainResult = {
  commits: Array<{
    key: IntakeStepKey;
    partial: Partial<IntakeParseResult>;
    display: string;
  }>;
  nextIndex: number;
  leftover: string;
};

/** 현재 줄부터 연속으로 맞는 칸을 채운다. 메모 줄은 자동으로 넘기지 않는다 */
export function parseIntakeStepChain(
  raw: string,
  startIndex: number,
  kind: IntakeKind,
  existingSteps: Partial<Record<IntakeStepKey, Partial<IntakeParseResult>>>,
  today: Date = new Date()
): IntakeStepChainResult {
  const guide = INTAKE_GUIDE_STEPS[kind];
  const steps = { ...existingSteps };
  const commits: IntakeStepChainResult["commits"] = [];
  let text = normalizeIntakeInput(raw);
  let index = startIndex;

  while (index < guide.length && text) {
    const key = guide[index]?.key;
    if (!key || key === "notes") break;

    const { cancel, remainder: cancelText } = splitIntakeStepCancel(text);
    if (cancel && !cancelText) break;
    if (cancelText) text = cancelText;

    const prior = priorStepsMerged(steps, kind, index);
    const mergedPrior =
      key === "flags" && steps.flags
        ? { ...prior, ...steps.flags }
        : prior;
    const parsed = parseIntakeStep(text, key, kind, mergedPrior, today);
    if (!parsed.ok) break;

    commits.push({
      key,
      partial: parsed.partial,
      display: parsed.display,
    });
    steps[key] = parsed.partial;
    text = extractTalkStepRemainder(text, key, parsed.partial, kind);
    if (key === "flags" && !flagsStepComplete(parsed.partial)) {
      continue;
    }
    index += 1;
  }

  return { commits, nextIndex: index, leftover: text.trim() };
}

export function parseIntakeStep(
  raw: string,
  step: IntakeStepKey,
  kind: IntakeKind,
  prior?: Partial<IntakeParseResult>,
  today: Date = new Date()
): IntakeStepParseOutcome {
  const text = normalizeIntakeInput(raw);
  if (!text) return { ok: false, partial: {}, display: "" };

  if (step === "notes") {
    const notes = text.replace(/^메모\s*[:：.]?\s*/, "").trim();
    if (!notes) return { ok: false, partial: {}, display: "" };
    const partial: Partial<IntakeParseResult> = { notes, options: [] };
    return { ok: true, partial, display: notes };
  }

  if (step === "name") {
    const name = parseTalkNameStep(text);
    if (!name) return { ok: false, partial: {}, display: "" };
    const partial: Partial<IntakeParseResult> = {
      name,
      nameLabeled: true,
      options: [],
    };
    return {
      ok: true,
      partial,
      display: name,
    };
  }

  if (step === "flags") {
    const existing: Partial<IntakeParseResult> = {
      loan: prior?.loan,
      insurance: prior?.insurance,
      parking: prior?.parking,
      elevator: prior?.elevator,
      options: [],
    };
    if (flagsStepComplete(existing)) {
      return { ok: false, partial: {}, display: "" };
    }
    const merged = mergeFlagsFromText(existing, text);
    if (!merged) return { ok: false, partial: {}, display: "" };
    return {
      ok: true,
      partial: merged,
      display: formatFlagsValueLine(merged),
    };
  }

  if (step === "share") {
    const shared = parseIntakeText(text, kind, today).workspaceShared;
    if (!shared) return { ok: false, partial: {}, display: "" };
    const partial: Partial<IntakeParseResult> = {
      workspaceShared: shared,
      options: [],
    };
    return {
      ok: true,
      partial,
      display: stepDisplay(partial, kind, step),
    };
  }

  const scoped = stepParseInput(text, step, kind, prior);
  const parsed = parseIntakeText(scoped, kind, today);

  if (step === "phone") {
    const phone = parsed.phone;
    if (!phone) return { ok: false, partial: {}, display: "" };
    const partial: Partial<IntakeParseResult> = { phone, options: [] };
    return {
      ok: true,
      partial,
      display: stepDisplay(partial, kind, step),
    };
  }

  if (step === "roomType") {
    if (!parsed.roomType) return { ok: false, partial: {}, display: "" };
    const partial: Partial<IntakeParseResult> = {
      roomType: parsed.roomType,
      roomCount: parsed.roomCount,
      bathroomCount: parsed.bathroomCount,
      options: [],
    };
    return {
      ok: true,
      partial,
      display: stepDisplay(partial, kind, step),
    };
  }

  if (step === "dealType") {
    if (!parsed.dealType) return { ok: false, partial: {}, display: "" };
    const partial: Partial<IntakeParseResult> = {
      dealType: parsed.dealType,
      options: [],
    };
    return {
      ok: true,
      partial,
      display: parsed.dealType,
    };
  }

  if (step === "location") {
    const hasCustomerLoc =
      kind === "customer" &&
      ((parsed.places?.length ?? 0) > 0 || parsed.dong || parsed.gu);
    const hasPropertyLoc =
      kind === "property" && (parsed.dong || parsed.jibun || parsed.roomNo);
    if (!hasCustomerLoc && !hasPropertyLoc) {
      return { ok: false, partial: {}, display: "" };
    }
    const partial: Partial<IntakeParseResult> = {
      gu: parsed.gu,
      dong: parsed.dong,
      jibun: parsed.jibun,
      places: parsed.places,
      roomNo: parsed.roomNo,
      options: [],
    };
    return {
      ok: true,
      partial,
      display: stepDisplay(partial, kind, step),
    };
  }

  if (step === "money") {
    if (!parsed.deposit && !parsed.monthlyRent) {
      return { ok: false, partial: {}, display: "" };
    }
    const partial: Partial<IntakeParseResult> = {
      deposit: parsed.deposit,
      depositTo: parsed.depositTo,
      monthlyRent: parsed.monthlyRent,
      monthlyRentTo: parsed.monthlyRentTo,
      maintenanceFee: parsed.maintenanceFee,
      options: [],
    };
    return {
      ok: true,
      partial,
      display: stepDisplay({ ...prior, ...partial, dealType: parsed.dealType ?? prior?.dealType }, kind, step),
    };
  }

  if (step === "dates") {
    if (!parsed.moveInFrom && !parsed.moveInImmediate) {
      return { ok: false, partial: {}, display: "" };
    }
    const partial: Partial<IntakeParseResult> = {
      moveInFrom: parsed.moveInFrom,
      moveInTo: parsed.moveInTo,
      moveInImmediate: parsed.moveInImmediate,
      options: [],
    };
    return {
      ok: true,
      partial,
      display: stepDisplay(partial, kind, step),
    };
  }

  if (step === "contacts") {
    if (!parsed.tenantPhone && !parsed.landlordPhone && !parsed.phone) {
      return { ok: false, partial: {}, display: "" };
    }
    const partial: Partial<IntakeParseResult> = {
      phone: parsed.phone,
      tenantPhone: parsed.tenantPhone,
      landlordPhone: parsed.landlordPhone,
      options: [],
    };
    return {
      ok: true,
      partial,
      display: stepDisplay(partial, kind, step),
    };
  }

  return { ok: false, partial: {}, display: "" };
}

function mergePartial(
  target: IntakeParseResult,
  partial: Partial<IntakeParseResult>
) {
  if (partial.name) {
    target.name = partial.name;
    if (partial.nameLabeled) target.nameLabeled = true;
  }
  if (partial.phone) target.phone = partial.phone;
  if (partial.tenantPhone) target.tenantPhone = partial.tenantPhone;
  if (partial.landlordPhone) target.landlordPhone = partial.landlordPhone;
  if (partial.roomType) {
    target.roomType = partial.roomType;
    target.roomCount = partial.roomCount;
    target.bathroomCount = partial.bathroomCount;
  }
  if (partial.dealType) target.dealType = partial.dealType;
  if (partial.deposit) target.deposit = partial.deposit;
  if (partial.depositTo) target.depositTo = partial.depositTo;
  if (partial.monthlyRent) target.monthlyRent = partial.monthlyRent;
  if (partial.monthlyRentTo) target.monthlyRentTo = partial.monthlyRentTo;
  if (partial.maintenanceFee != null) {
    target.maintenanceFee = partial.maintenanceFee;
  }
  if (partial.gu) target.gu = partial.gu;
  if (partial.dong) target.dong = partial.dong;
  if (partial.jibun) target.jibun = partial.jibun;
  if (partial.places?.length) target.places = partial.places;
  if (partial.roomNo) target.roomNo = partial.roomNo;
  if (partial.moveInFrom) {
    target.moveInFrom = partial.moveInFrom;
    target.moveInTo = partial.moveInTo ?? partial.moveInFrom;
  }
  if (partial.moveInImmediate) target.moveInImmediate = true;
  if (partial.loan) target.loan = partial.loan;
  if (partial.insurance) target.insurance = partial.insurance;
  if (partial.parking) target.parking = partial.parking;
  if (partial.elevator) target.elevator = partial.elevator;
  if (partial.workspaceShared) target.workspaceShared = partial.workspaceShared;
  if (partial.notes) target.notes = partial.notes;
  if (partial.options?.length) {
    target.options = [...new Set([...target.options, ...partial.options])];
  }
}

export function buildIntakeFromSteps(
  steps: Partial<Record<IntakeStepKey, Partial<IntakeParseResult>>>,
  kind: IntakeKind
): IntakeParseResult {
  const result: IntakeParseResult = { options: [], notes: "" };
  for (const line of INTAKE_GUIDE_STEPS[kind]) {
    const partial = steps[line.key];
    if (!partial) continue;
    mergePartial(result, partial);
  }
  return result;
}

export function priorStepsMerged(
  steps: Partial<Record<IntakeStepKey, Partial<IntakeParseResult>>>,
  kind: IntakeKind,
  beforeIndex: number
): Partial<IntakeParseResult> {
  const lines = INTAKE_GUIDE_STEPS[kind];
  const merged: Partial<IntakeParseResult> = { options: [] };
  for (let i = 0; i < beforeIndex; i += 1) {
    const key = lines[i]?.key;
    if (!key || !steps[key]) continue;
    mergePartial(merged as IntakeParseResult, steps[key]!);
  }
  return merged;
}

export function stepPartialsFromRecords(
  steps: Partial<
    Record<
      IntakeStepKey,
      { partial?: Partial<IntakeParseResult>; display?: string }
    >
  >
): Partial<Record<IntakeStepKey, Partial<IntakeParseResult>>> {
  return Object.fromEntries(
    Object.entries(steps)
      .filter(([, row]) => row?.partial)
      .map(([key, row]) => [key, row!.partial!])
  ) as Partial<Record<IntakeStepKey, Partial<IntakeParseResult>>>;
}
