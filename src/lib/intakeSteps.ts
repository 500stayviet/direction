import type { IntakeGuideKey } from "@/lib/intakeGuideHits";
import { intakeGuideHits } from "@/lib/intakeGuideHits";
import {
  normalizeIntakeInput,
  parseAllYesNoFields,
  parseIntakeText,
  parseTalkDealTypeField,
  parseTalkRoomTypeField,
  lastTalkMobilePhone,
  consumeYesNoField,
  dateRangeLinkTail,
  hasDateRangeWord,
  type IntakeKind,
  type IntakeNormalizeMode,
  type IntakeParseResult,
  type IntakeYesNoField,
  MOVE_IN_IMMEDIATE_RE,
  MOVE_IN_NEGOTIABLE_RE,
} from "@/lib/intakeParse";
import {
  availFromYesNo,
  formatCustomerTalkFlagValue,
  formatPhoneInput,
  isTalkPhoneComplete,
  needsJeonseInsurance,
} from "@/lib/format";
import { skipsResidentialExtras, needsMaintenanceFee } from "@/lib/constants";
import { splitRestAddress } from "@/lib/propertyRoomNo";
import {
  findAllDongsInText,
  findLastGuInText,
  resolveGuFromDong,
} from "@/lib/seoulRegions";

export type IntakeStepKey = IntakeGuideKey;

/** 마이크 칸별 정규화. 메시지·사진용 spoken(전부)과 분리한다. */
export function talkNormalizeModeForStep(
  step: IntakeStepKey
): IntakeNormalizeMode {
  if (step === "location" || step === "restAddress") return "talk-location";
  if (step === "money") return "talk-money";
  if (step === "dates") return "talk-dates";
  if (
    step === "phone" ||
    step === "tenantPhone" ||
    step === "landlordPhone"
  ) {
    return "talk-phone";
  }
  return "talk-plain";
}

function normalizeTalkStep(raw: string, step: IntakeStepKey): string {
  return normalizeIntakeInput(raw, talkNormalizeModeForStep(step));
}

function pickTalkMobilePhone(
  text: string,
  step: "phone" | "tenantPhone" | "landlordPhone"
): string | undefined {
  const digits = digitsOnly(normalizeTalkStep(text, step));
  if (!/^01[016789]/.test(digits)) return undefined;
  if (digits.length === 11) return formatPhoneInput(digits);
  if (digits.length > 11) {
    const tail = digits.slice(-11);
    if (/^01[016789]/.test(tail)) return formatPhoneInput(tail);
  }
  return undefined;
}

function digitsOnly(text: string): string {
  return text.replace(/\D/g, "");
}

function resolveTalkPhoneCandidate(
  text: string,
  step: "phone" | "tenantPhone" | "landlordPhone",
  parsed: IntakeParseResult
): string | undefined {
  const normalized = normalizeTalkStep(text, step);

  if (step === "tenantPhone") {
    const tenant =
      parsed.tenantPhone ?? (!parsed.landlordPhone ? parsed.phone : undefined);
    return tenant && isTalkPhoneComplete(tenant) ? tenant : undefined;
  }

  if (step === "landlordPhone") {
    const landlord =
      parsed.landlordPhone ?? parsed.phone ?? parsed.tenantPhone;
    return landlord && isTalkPhoneComplete(landlord) ? landlord : undefined;
  }

  const last = lastTalkMobilePhone(normalized);
  if (last) return last;

  const mobile = pickTalkMobilePhone(text, step);
  return mobile && isTalkPhoneComplete(mobile) ? mobile : undefined;
}

export type IntakeStepLine = {
  key: IntakeStepKey;
  name: string;
  /** 유/무처럼 제목 옆 작은 안내 */
  nameHint?: string;
  example?: string;
};

export const INTAKE_GUIDE_STEPS: Record<IntakeKind, IntakeStepLine[]> = {
  customer: [
    { key: "name", name: "고객명 또는 명칭", example: "홍길동" },
    { key: "phone", name: "전화번호", example: "010-1234-5678" },
    { key: "roomType", name: "매물유형", example: "원룸 · 오피스텔 등" },
    { key: "dealType", name: "거래종류", example: "매매 전세 월세" },
    { key: "location", name: "선호지역", example: "강동구 oo동" },
    { key: "money", name: "거래가액", example: "보증금 1억 · 월세 50 · 매매 3억 5천" },
    {
      key: "dates",
      name: "입주희망일",
      example: "oo월 oo일    에서    oo월 oo일 까지",
    },
    {
      key: "flags",
      name: "대출 · 보증보험 · 주차",
      nameHint: "(필요/불필요)",
      example: "대출필요 보증 필요 주차불필요",
    },
    {
      key: "elevator",
      name: "엘리베이터",
      nameHint: "(유/무)",
      example: "엘베 유",
    },
    { key: "notes", name: "메모", example: "남향 저층" },
  ],
  property: [
    { key: "location", name: "주소지", example: "강동구 성내동 111-1" },
    {
      key: "restAddress",
      name: "나머지 주소",
      example: "힐스테이트 ooo동 ooo호",
    },
    { key: "roomType", name: "매물유형", example: "원룸 · 오피스텔 등" },
    { key: "dealType", name: "거래종류", example: "매매 전세 월세" },
    { key: "money", name: "거래가액", example: "보증금 1억 · 월세 50 · 매매 3억 5천" },
    {
      key: "dates",
      name: "임대희망일",
      example: "oo월 oo일    에서    oo월 oo일 까지",
    },
    {
      key: "flags",
      name: "대출 · 보증보험 · 주차",
      nameHint: "(가능/불가)",
      example: "대출가능 보증보험 가능 주차불가",
    },
    {
      key: "elevator",
      name: "엘리베이터",
      nameHint: "(있음/없음)",
      example: "엘리베이터 있음",
    },
    {
      key: "tenantPhone",
      name: "임차인 전화번호",
      example: "010-1234-5678",
    },
    {
      key: "landlordPhone",
      name: "임대인 전화번호",
      example: "010-9876-5432",
    },
    { key: "notes", name: "메모", example: "관리비. 남향. 저층 등" },
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

const CANCEL_STEM =
  "삭제|지워(?:주세요|줘)?|지우기|취소|없애(?:줘|주세요)?|아니(?:야|요|인데)?|틀렸(?:어|어요|습니다)?";

export function talkDasiIsHyphen(
  kind: IntakeKind,
  key: IntakeStepKey
): boolean {
  return (
    kind === "property" && (key === "location" || key === "restAddress")
  );
}

export function splitIntakeStepCancel(
  text: string,
  opts?: { dasiIsHyphen?: boolean }
): IntakeStepCancelSplit {
  const trimmed = text.trim();
  if (!trimmed) return { cancel: false, remainder: "" };
  const dasi = opts?.dasiIsHyphen ? "" : "|다시";
  const prefixed = trimmed.match(
    new RegExp(`^(?:${CANCEL_STEM}${dasi})\\s+(.+)$`)
  );
  if (prefixed?.[1]) {
    return { cancel: true, remainder: prefixed[1].trim() };
  }
  if (new RegExp(`^(?:${CANCEL_STEM}${dasi})$`).test(trimmed)) {
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
  if (prior.gu && kind === "property") bits.push(prior.gu);
  if (prior.dong) bits.push(prior.dong);
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

/** STT가 구·동을 이미 말한 뒤 전체 주소를 다시 보낼 때 prior 접두를 붙이지 않는다 */
function textAlreadyHasPriorStepContext(
  text: string,
  step: IntakeStepKey,
  kind: IntakeKind,
  prior?: Partial<IntakeParseResult>
): boolean {
  if (!prior) return false;
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return false;
  if (step === "location") {
    if (prior.dong && normalized.includes(prior.dong)) return true;
    if (kind === "property" && prior.gu && normalized.includes(prior.gu)) {
      return true;
    }
  }
  return false;
}

/** 본번·부번이 나눠 들어올 때 더 완전한 지번을 유지한다 */
function mergeTalkLocationJibun(
  next?: string,
  keep?: string
): string | undefined {
  if (!next) return keep;
  if (!keep) return next;
  const nextSub = next.split("-")[1]?.trim();
  const keepSub = keep.split("-")[1]?.trim();
  if (nextSub && !keepSub) return next;
  if (keepSub && !nextSub) return keep;
  return next;
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
  if (textAlreadyHasPriorStepContext(text, step, kind, prior)) return text;
  return [prefix, text].filter(Boolean).join(" ");
}

const FLAG_FIELDS: IntakeYesNoField[] = [
  "loan",
  "insurance",
  "parking",
];

const ELEVATOR_FIELD: IntakeYesNoField = "elevator";

function flagFieldsForContext(
  dealType?: IntakeParseResult["dealType"],
  roomType?: IntakeParseResult["roomType"]
): IntakeYesNoField[] {
  if (skipsResidentialExtras(roomType)) return ["parking"];
  if (dealType && !needsJeonseInsurance(dealType, roomType)) {
    return ["loan", "parking"];
  }
  return FLAG_FIELDS;
}

export function flagsGuideCopy(
  kind: IntakeKind,
  dealType?: IntakeParseResult["dealType"],
  roomType?: IntakeParseResult["roomType"]
): { name: string; nameHint: string; example: string } {
  const customer = kind === "customer";
  if (skipsResidentialExtras(roomType)) {
    return {
      name: "주차",
      nameHint: customer ? "(필요/불필요)" : "(가능/불가)",
      example: customer ? "주차필요" : "주차가능",
    };
  }
  if (needsJeonseInsurance(dealType, roomType) || !dealType) {
    return {
      name: "대출 · 보증보험 · 주차",
      nameHint: customer ? "(필요/불필요)" : "(가능/불가)",
      example: customer
        ? "대출필요 보증 필요 주차불필요"
        : "대출가능 보증보험 가능 주차불가",
    };
  }
  return {
    name: "대출 · 주차",
    nameHint: customer ? "(필요/불필요)" : "(가능/불가)",
    example: customer ? "대출필요 주차불필요" : "대출가능 주차불가",
  };
}

function formatTalkFlagLabel(
  value: NonNullable<IntakeParseResult["loan"]>,
  kind: IntakeKind
): string {
  return kind === "customer"
    ? formatCustomerTalkFlagValue(value)
    : (availFromYesNo(value) ?? "");
}

export function flagsStepComplete(
  partial: Partial<IntakeParseResult> | undefined,
  dealType?: IntakeParseResult["dealType"],
  roomType?: IntakeParseResult["roomType"]
): boolean {
  if (!partial) return false;
  const deal = dealType ?? partial.dealType;
  const room = roomType ?? partial.roomType;
  return flagFieldsForContext(deal, room).every((field) => partial[field]);
}

export function elevatorStepComplete(
  partial: Partial<IntakeParseResult> | undefined
): boolean {
  return Boolean(partial?.elevator);
}

export type IntakeGuideStepRow = {
  partial?: Partial<IntakeParseResult>;
  display?: string;
  complete?: boolean;
};

export function stripTalkNotesPrefix(text: string): string {
  return text.replace(/^메모\s*[:：.]?\s*/, "").trim();
}

/** 월세는 보증금+월세, 그 외는 금액 하나면 됨 */
export function moneyFieldsComplete(
  partial: Partial<IntakeParseResult> | undefined,
  dealType?: IntakeParseResult["dealType"]
): boolean {
  if (!partial) return false;
  const deal = dealType ?? partial.dealType;
  if (deal === "월세") {
    return Boolean(partial.deposit) && Boolean(partial.monthlyRent);
  }
  return Boolean(partial.deposit || partial.monthlyRent);
}

export function moneyStepExample(
  dealType?: IntakeParseResult["dealType"]
): string {
  if (dealType === "월세") return "보증금 1억 · 월세 50";
  if (dealType === "매매") return "매매 3억 5천";
  if (dealType === "전세") return "보증금 1억";
  return "보증금 1억 · 월세 50 · 매매 3억 5천";
}

/** 거래가액이 먼저 오면 금액으로 거래종류를 짐작한다 */
export function inferDealTypeFromMoney(
  money?: Partial<IntakeParseResult>
): IntakeParseResult["dealType"] | undefined {
  if (!money) return undefined;
  if (money.dealType) return money.dealType;
  if (money.monthlyRent) return "월세";
  if (money.deposit) return "전세";
  return undefined;
}

export function resolveTalkDealType(
  dealPartial?: Partial<IntakeParseResult>,
  moneyPartial?: Partial<IntakeParseResult>
): IntakeParseResult["dealType"] | undefined {
  return dealPartial?.dealType ?? inferDealTypeFromMoney(moneyPartial);
}

export function dealTypeStepExample(
  dealType?: IntakeParseResult["dealType"]
): string {
  if (dealType === "월세") return "월세";
  if (dealType === "매매") return "매매";
  if (dealType === "전세") return "전세";
  return "매매 전세 월세";
}

export function guideStepComplete(
  key: IntakeStepKey,
  row: IntakeGuideStepRow | undefined,
  allSteps?: Partial<Record<IntakeStepKey, IntakeGuideStepRow>>
): boolean {
  if (key === "flags") {
    const deal = resolveTalkDealType(
      allSteps?.dealType?.partial,
      allSteps?.money?.partial
    );
    const room = allSteps?.roomType?.partial?.roomType;
    return flagsStepComplete(row?.partial, deal, room);
  }
  if (key === "elevator") return elevatorStepComplete(row?.partial);
  /** 선택 칸: 비어도 다음으로 넘어가지만, 대화 UI 초록은 display가 있을 때만 */
  if (key === "restAddress") return !row || Boolean(row?.display);
  if (key === "notes") return Boolean(row?.complete) || Boolean(row?.display);
  if (key === "money") {
    const deal = resolveTalkDealType(
      allSteps?.dealType?.partial,
      row?.partial
    );
    if (row?.partial) return moneyFieldsComplete(row.partial, deal);
    return Boolean(row?.display);
  }
  return Boolean(row?.display);
}

export function allGuideStepsComplete(
  kind: IntakeKind,
  steps: Partial<Record<IntakeStepKey, IntakeGuideStepRow>>
): boolean {
  return INTAKE_GUIDE_STEPS[kind].every((line) =>
    guideStepComplete(line.key, steps[line.key], steps)
  );
}

export function firstIncompleteGuideIndex(
  kind: IntakeKind,
  steps: Partial<Record<IntakeStepKey, IntakeGuideStepRow>>
): number {
  const guide = INTAKE_GUIDE_STEPS[kind];
  const idx = guide.findIndex(
    (line) => !guideStepComplete(line.key, steps[line.key], steps)
  );
  return idx < 0 ? Math.max(0, guide.length - 1) : idx;
}

export function formatFlagsValueLine(
  partial: Partial<IntakeParseResult>,
  kind: IntakeKind,
  dealType?: IntakeParseResult["dealType"],
  roomType?: IntakeParseResult["roomType"]
): string {
  const deal = dealType ?? partial.dealType;
  const room = roomType ?? partial.roomType;
  const keep = new Set(flagFieldsForContext(deal, room));
  const parts: string[] = [];
  if (keep.has("loan") && partial.loan) {
    parts.push(`대출${formatTalkFlagLabel(partial.loan, kind)}`);
  }
  if (keep.has("insurance") && partial.insurance) {
    parts.push(`보증${formatTalkFlagLabel(partial.insurance, kind)}`);
  }
  if (keep.has("parking") && partial.parking) {
    parts.push(`주차${formatTalkFlagLabel(partial.parking, kind)}`);
  }
  return parts.join(" · ");
}

function formatElevatorValueLine(
  partial: Partial<IntakeParseResult>
): string {
  return partial.elevator ? `엘베${partial.elevator}` : "";
}

function mergeFlagsFromText(
  existing: Partial<IntakeParseResult>,
  text: string,
  dealType?: IntakeParseResult["dealType"],
  roomType?: IntakeParseResult["roomType"]
): Partial<IntakeParseResult> | null {
  const parsed = parseAllYesNoFields(text);
  const keep = flagFieldsForContext(dealType, roomType);
  const partial: Partial<IntakeParseResult> = { ...existing, options: [] };
  if (!keep.includes("insurance")) delete partial.insurance;
  if (!keep.includes("loan")) delete partial.loan;
  let foundAny = false;
  for (const field of keep) {
    if (partial[field] || !parsed[field]) continue;
    partial[field] = parsed[field];
    foundAny = true;
  }
  return foundAny ? partial : null;
}

function mergeElevatorFromText(
  existing: Partial<IntakeParseResult>,
  text: string
): Partial<IntakeParseResult> | null {
  if (existing.elevator) return null;
  const parsed = parseAllYesNoFields(text);
  if (!parsed.elevator) return null;
  return { elevator: parsed.elevator, options: [] };
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

function consumeAfterPhoneDigits(text: string, phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const idx = text.replace(/\D/g, "").indexOf(digits);
  if (idx >= 0) {
    let seen = 0;
    for (let i = 0; i < text.length; i += 1) {
      if (/\d/.test(text[i] ?? "")) {
        if (seen === idx) {
          return text.slice(i + digits.length).replace(/^\s+/, "");
        }
        seen += 1;
      }
    }
  }
  return consumeAfterToken(text, phone, true);
}

function locationConsumedRange(
  text: string,
  partial: Partial<IntakeParseResult>,
  kind: IntakeKind
): { start: number; end: number } {
  if (kind === "customer") {
    const hits = findAllDongsInText(text);
    if (hits.length > 0) {
      let start = hits[0]!.start;
      const end = hits[hits.length - 1]!.end;
      for (const hit of hits) {
        const guBefore = findLastGuInText(text.slice(0, hit.start));
        if (guBefore) {
          const idx = text.lastIndexOf(guBefore, hit.start);
          if (idx >= 0 && idx + guBefore.length <= hit.start) {
            start = Math.min(start, idx);
          }
        }
      }
      return { start, end };
    }
  }
  let start = text.length;
  let end = 0;
  const bump = (token?: string) => {
    if (!token) return;
    const idx = text.lastIndexOf(token);
    if (idx < 0) return;
    start = Math.min(start, idx);
    end = Math.max(end, idx + token.length);
  };
  bump(partial.jibun);
  if (partial.jibun) {
    const [main, sub] = partial.jibun.split("-");
    if (main && sub) {
      const spoken = text.match(
        new RegExp(
          `${main}\\s*(?:[-−~]|에|의|에서|다시|대시|하이픈|빼기|내지)\\s*${sub}`
        )
      );
      if (spoken?.index != null) {
        start = Math.min(start, spoken.index);
        end = Math.max(end, spoken.index + spoken[0].length);
      }
    }
  }
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
  if (end <= 0) return { start: 0, end: 0 };
  return { start, end };
}

function restAddressConsumedRange(
  text: string,
  partial: Partial<IntakeParseResult>
): { start: number; end: number } {
  let start = text.length;
  let end = 0;
  const bump = (token?: string) => {
    if (!token) return;
    const idx = text.lastIndexOf(token);
    if (idx < 0) return;
    start = Math.min(start, idx);
    end = Math.max(end, idx + token.length);
  };
  bump(partial.roomNo);
  if (partial.roomNo) bump(partial.roomNo.replace(/\s+/g, ""));
  bump(partial.buildingName);
  if (end <= 0) return { start: 0, end: 0 };
  return { start, end };
}

/** 2억9천·3억6500(만 생략 2~4자리). 5억9처럼 한 자리는 억만 잡힌다 */
const TALK_MONEY_COMPOUND =
  String.raw`\d+(?:\.\d+)?\s*억(?:\s*\d+(?:\.\d+)?\s*천)?(?:\s*\d+(?:\.\d+)?\s*백)?(?:\s*\d+(?:\.\d+)?\s*만|\s*\d{2,4}(?!\d))?`;
const TALK_MONEY_SPAN = new RegExp(
  String.raw`(?:매매(?:가)?|전세(?:가)?|보증금|보증|월세|(?<![가-힣\d])월|거래\s*가액|금\s*액)\s*(?:${TALK_MONEY_COMPOUND}|\d+(?:\.\d+)?\s*만|\d+(?:\.\d+)?\s*/\s*\d+(?:\.\d+)?|\d+(?:\.\d+)?)|(?:^|\s)(${TALK_MONEY_COMPOUND})`,
  "g"
);

function moneyConsumedEnd(text: string): number {
  let end = 0;
  for (const m of text.matchAll(TALK_MONEY_SPAN)) {
    if (m.index != null) end = Math.max(end, m.index + m[0].length);
  }
  return end;
}

const TALK_DATE_SPAN = new RegExp(
  `(?:${MOVE_IN_NEGOTIABLE_RE.source}|${MOVE_IN_IMMEDIATE_RE.source}|\\d+\\s*월\\s*\\d+\\s*일(?:\\s*(?:부터(?:는)?|까지(?:는)?|에서|와|과|하고|내지))?\\s*[-~～〜∼]?|\\d+\\s*월\\s*\\d+|\\d{2}\\s*[./／.,．]\\s*\\d{1,2}\\s*[./／.,．]\\s*\\d{1,2}|\\d{1,2}\\s*[./／.,．-]\\s*\\d{1,2})`,
  "g"
);

function datesConsumedEnd(text: string): number {
  let end = 0;
  for (const m of text.matchAll(TALK_DATE_SPAN)) {
    if (m.index != null) end = Math.max(end, m.index + m[0].length);
  }
  return end;
}

const NEXT_AFTER_LOCATION =
  /^(?:매매(?:가)?|전세(?:가)?|보증금|월세|거래\s*가액|금\s*액|대출|주차|엘베|엘리베이터|바로\s*입주|즉시|공실|빈방|공가|비어|(?:\d+(?:\.\d+)?\s*(?:억|만))|(?:\d+\s*\/\s*\d+)|원룸|투룸|쓰리룸|오피스텔|아파트|상가|건물|토지|\d\s*룸)/;

const NEXT_AFTER_MONEY =
  /^(?:바로\s*입주|즉시\s*입주|공실|빈방|공가|비어|\d+\s*월|\d{1,2}\s*[./／.,．-]|\d{2}\s*[./／.,．]|대출|보증보험|보증\s*보험|주차|엘베|엘리베이터|팀공유|메모|임차인|임대인|주인|세입자|전화)/;

const NEXT_AFTER_DATES =
  /^(?:대출|보증|주차|엘베|엘리베이터|팀공유|메모|임차인|임대인|주인|세입자|전화)/;

const NEXT_AFTER_CONTACTS = /^(?:메모|내용)/;

function customerPlacesFromPartial(
  partial: Partial<IntakeParseResult> | undefined
): { gu: string; dong: string }[] {
  if (!partial) return [];
  const places = (partial.places ?? []).filter((p) => p.gu && p.dong);
  const seen = new Set<string>();
  const out: { gu: string; dong: string }[] = [];
  const push = (gu: string, dong: string) => {
    const key = `${gu}|${dong}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ gu, dong });
  };
  for (const place of places) push(place.gu, place.dong);
  if (out.length > 0) return out;
  if (!partial.dong) return [];
  const gu = partial.gu || resolveGuFromDong(partial.dong);
  if (gu) push(gu, partial.dong);
  return out;
}

function mergeCustomerPlaces(
  prior: Partial<IntakeParseResult> | undefined,
  parsed: Partial<IntakeParseResult>
): { gu?: string; dong?: string; places: { gu: string; dong: string }[] } {
  const seen = new Set<string>();
  const places: { gu: string; dong: string }[] = [];
  for (const place of [
    ...customerPlacesFromPartial(prior),
    ...customerPlacesFromPartial(parsed),
  ]) {
    const key = `${place.gu}|${place.dong}`;
    if (seen.has(key)) continue;
    seen.add(key);
    places.push(place);
  }
  const last = places[places.length - 1];
  return {
    places,
    gu: last?.gu ?? parsed.gu,
    dong: last?.dong ?? parsed.dong,
  };
}

function customerLocationDongCount(
  partial: Partial<IntakeParseResult> | undefined
): number {
  return customerPlacesFromPartial(partial).length;
}

/** 시작일 다음에 끝일을 말하면 기간으로 이어 붙인다 */
function mergeTalkDates(
  prior: Partial<IntakeParseResult> | undefined,
  parsed: Partial<IntakeParseResult>
): Partial<IntakeParseResult> {
  if (parsed.moveInNegotiable && !parsed.moveInFrom) {
    return { moveInNegotiable: true };
  }
  if (parsed.moveInImmediate && !parsed.moveInFrom) {
    return { moveInImmediate: true };
  }
  const newFrom = parsed.moveInFrom;
  const newTo = parsed.moveInTo || newFrom;
  if (!newFrom) {
    return {
      moveInFrom: prior?.moveInFrom,
      moveInTo: prior?.moveInTo,
      moveInImmediate: prior?.moveInImmediate,
    };
  }
  if (newFrom !== newTo) {
    return { moveInFrom: newFrom, moveInTo: newTo };
  }
  const priorFrom = prior?.moveInFrom;
  const priorTo = prior?.moveInTo || priorFrom;
  if (!priorFrom || prior?.moveInImmediate) {
    return { moveInFrom: newFrom, moveInTo: newTo };
  }
  if (priorFrom === (priorTo || priorFrom) && priorFrom !== newFrom) {
    const from = priorFrom < newFrom ? priorFrom : newFrom;
    const to = priorFrom < newFrom ? newFrom : priorFrom;
    return { moveInFrom: from, moveInTo: to };
  }
  if (priorFrom !== priorTo) {
    if (newFrom < priorFrom) return { moveInFrom: newFrom, moveInTo: priorTo };
    return { moveInFrom: priorFrom, moveInTo: newFrom };
  }
  return { moveInFrom: newFrom, moveInTo: newTo };
}

function propertyJibunHasMainAndSub(jibun?: string): boolean {
  if (!jibun) return false;
  const sub = jibun.split("-")[1]?.trim();
  return Boolean(sub);
}

/** 선호지역·주소지: 말이 끊긴 뒤 머문다.
 *  매물 주소지: 본번·부번이면 바로, 본번만 있으면 2초, 구·동만 있으면 4초. */
export function locationStepNeedsHold(
  partial: Partial<IntakeParseResult> | undefined,
  kind: IntakeKind
): boolean {
  if (!partial) return false;
  if (kind === "customer") {
    return customerLocationDongCount(partial) >= 1;
  }
  if (propertyJibunHasMainAndSub(partial.jibun)) return false;
  return Boolean(partial.dong || partial.jibun);
}

export function restAddressStepNeedsHold(
  partial: Partial<IntakeParseResult> | undefined
): boolean {
  if (!partial) return false;
  return Boolean(partial.buildingName || partial.roomNo);
}

/** 고객 선호지역: 동이 있어야 하고, 다른 구·동을 더 고를 수 있으면 넘기지 않는다.
 *  매물 주소지: 본번·부번이면 바로 다음 칸. 아니면 말이 끊긴 뒤 홀드. */
export function locationStepReadyToAdvance(
  text: string,
  partial: Partial<IntakeParseResult>,
  kind: IntakeKind
): boolean {
  const normalized = normalizeTalkStep(text, "location");
  if (kind === "property") {
    if (!partial.dong) return false;
    const remainder = extractTalkStepRemainder(
      normalized,
      "location",
      partial,
      kind
    );
    if (propertyJibunHasMainAndSub(partial.jibun)) return true;
    if (!remainder) return false;
    return NEXT_AFTER_LOCATION.test(remainder);
  }
  const dongs = customerLocationDongCount(partial);
  if (dongs < 1) return false;
  const remainder = extractTalkStepRemainder(
    normalized,
    "location",
    partial,
    kind
  );
  if (
    /(?:그리고|또는|아니면|이랑|랑|하고|와|과|또|,)\s*$/.test(normalized)
  ) {
    return false;
  }
  if (!remainder) return false;
  if (/^(?:그리고|또는|아니면|이랑|랑|하고|와|과|또|,)/.test(remainder)) {
    return false;
  }
  return NEXT_AFTER_LOCATION.test(remainder);
}

export function restAddressStepReadyToAdvance(
  text: string,
  partial: Partial<IntakeParseResult>
): boolean {
  if (!partial.buildingName && !partial.roomNo) return false;
  const normalized = normalizeTalkStep(text, "restAddress");
  const remainder = extractTalkStepRemainder(
    normalized,
    "restAddress",
    partial,
    "property"
  );
  if (!remainder) return true;
  return NEXT_AFTER_LOCATION.test(remainder);
}

/** 금액만 있고 다음 칸 말이 없으면 잠시 머문다. 다음 내용이 보이면 바로 넘긴다.
 *  월세는 보증금·월세가 둘 다 있어야 다음으로 간다. */
export function moneyStepReadyToAdvance(
  text: string,
  partial: Partial<IntakeParseResult>,
  dealType?: IntakeParseResult["dealType"]
): boolean {
  if (!moneyFieldsComplete(partial, dealType)) return false;
  const normalized = normalizeTalkStep(text, "money");
  const end = moneyConsumedEnd(normalized);
  const rest = (end > 0 ? normalized.slice(end) : "").trim();
  if (!rest) return false;
  return NEXT_AFTER_MONEY.test(rest);
}

/** 날짜가 채워져도 다음 칸 말이 없으면 2초를 기다린다 */
export function datesStepReadyToAdvance(
  text: string,
  partial: Partial<IntakeParseResult>
): boolean {
  if (!partial.moveInFrom && !partial.moveInImmediate && !partial.moveInNegotiable) {
    return false;
  }

  const normalized = normalizeTalkStep(text, "dates");
  const end = datesConsumedEnd(normalized);
  const rest = (end > 0 ? normalized.slice(end) : "").trim();
  if (partial.moveInNegotiable || partial.moveInImmediate) {
    return Boolean(rest) && NEXT_AFTER_DATES.test(rest);
  }
  if (dateRangeLinkTail(normalized)) return false;
  if (hasDateRangeWord(normalized) && !NEXT_AFTER_DATES.test(rest)) return false;
  if (!rest) return false;
  return true;
}

/** 임대·입주희망일이 있으면 2초 홀드 (다음 칸 말이 없을 때) */
export function datesStepNeedsHold(
  partial: Partial<IntakeParseResult> | undefined
): boolean {
  if (!partial) return false;
  return Boolean(
    partial.moveInFrom || partial.moveInImmediate || partial.moveInNegotiable
  );
}

export function contactPhoneStepReadyToAdvance(
  text: string,
  step: "tenantPhone" | "landlordPhone",
  partial: Partial<IntakeParseResult>
): boolean {
  const phone =
    step === "tenantPhone" ? partial.tenantPhone : partial.landlordPhone;
  if (!phone) return false;
  const remainder = extractTalkStepRemainder(text, step, partial, "property");
  if (!remainder) return false;
  return NEXT_AFTER_CONTACTS.test(remainder);
}

/** 한 발화에서 현재 단계를 채운 뒤, 남은 글을 다음 단계 입력으로 넘긴다 */
export function extractTalkStepRemainder(
  raw: string,
  step: IntakeStepKey,
  partial: Partial<IntakeParseResult>,
  kind: IntakeKind
): string {
  const text = normalizeTalkStep(raw, step);
  if (!text) return "";

  if (step === "name" && partial.name) {
    return consumeAfterToken(text, partial.name);
  }
  if (step === "phone" && partial.phone) {
    return consumeAfterPhoneDigits(text, partial.phone);
  }
  if (step === "roomType" && partial.roomType) {
    return consumeAfterToken(text, partial.roomType);
  }
  if (step === "dealType" && partial.dealType) {
    return consumeAfterToken(text, partial.dealType);
  }
  if (step === "location") {
    const { start, end } = locationConsumedRange(text, partial, kind);
    if (end <= 0) return "";
    const before = text.slice(0, start).trim();
    const after = text.slice(end).replace(/^\s+/, "");
    return [before, after].filter(Boolean).join(" ");
  }
  if (step === "restAddress") {
    const { start, end } = restAddressConsumedRange(text, partial);
    if (end <= 0) return "";
    const before = text.slice(0, start).trim();
    const after = text.slice(end).replace(/^\s+/, "");
    return [before, after].filter(Boolean).join(" ");
  }
  if (step === "money" && (partial.deposit || partial.monthlyRent)) {
    const end = moneyConsumedEnd(text);
    return end > 0 ? text.slice(end).replace(/^\s+/, "") : "";
  }
  if (
    step === "dates" &&
    (partial.moveInFrom || partial.moveInImmediate || partial.moveInNegotiable)
  ) {
    const end = datesConsumedEnd(text);
    return end > 0 ? text.slice(end).replace(/^\s+/, "") : "";
  }
  if (step === "flags") {
    let remainder = text;
    const parsed = parseAllYesNoFields(text);
    for (const field of FLAG_FIELDS) {
      if (!partial[field] && !parsed[field]) continue;
      const hit = consumeYesNoField(remainder, field);
      if (hit) remainder = hit.remainder;
    }
    return remainder;
  }
  if (step === "elevator" && partial.elevator) {
    const hit = consumeYesNoField(text, ELEVATOR_FIELD);
    return hit ? hit.remainder : "";
  }
  if (step === "tenantPhone" && partial.tenantPhone) {
    return consumeAfterPhoneDigits(text, partial.tenantPhone);
  }
  if (step === "landlordPhone" && partial.landlordPhone) {
    return consumeAfterPhoneDigits(text, partial.landlordPhone);
  }
  if (step === "share" && partial.workspaceShared) {
    return consumeAfterToken(text, `팀공유 ${partial.workspaceShared}`, true);
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
  // 칸별 parseIntakeStep이 talk-* 모드로 정규화한다. 여기서는 원문만 넘긴다.
  let text = raw.replace(/\s+/g, " ").trim();
  let index = startIndex;

  while (index < guide.length && text) {
    const key = guide[index]?.key;
    if (!key || key === "notes") break;

    const { cancel, remainder: cancelText } = splitIntakeStepCancel(text, {
      dasiIsHyphen: talkDasiIsHyphen(kind, key),
    });
    if (cancel && !cancelText) break;
    if (cancelText) text = cancelText;

    const prior = priorStepsMerged(steps, kind, index);
    const mergedPrior =
      key === "flags" && steps.flags
        ? { ...prior, ...steps.flags }
        : key === "elevator" && steps.elevator
          ? { ...prior, ...steps.elevator }
          : key === "location" && steps.location
            ? { ...prior, ...steps.location }
            : key === "restAddress" && steps.restAddress
              ? { ...prior, ...steps.restAddress }
              : key === "dates" && steps.dates
              ? { ...prior, ...steps.dates }
              : key === "money" && steps.money
                ? { ...prior, ...steps.money }
                : key === "tenantPhone" && steps.tenantPhone
                  ? { ...prior, ...steps.tenantPhone }
                  : key === "landlordPhone" && steps.landlordPhone
                    ? { ...prior, ...steps.landlordPhone }
                    : prior;
    const parsed = parseIntakeStep(text, key, kind, mergedPrior, today);
    if (!parsed.ok) {
      if (
        key === "restAddress" &&
        NEXT_AFTER_LOCATION.test(normalizeTalkStep(text, "restAddress").trim())
      ) {
        index += 1;
        continue;
      }
      if (
        key === "restAddress" &&
        kind === "property" &&
        steps.location?.dong &&
        !steps.location.jibun
      ) {
        const locParsed = parseIntakeStep(
          text,
          "location",
          kind,
          steps.location,
          today
        );
        if (locParsed.ok && locParsed.partial.jibun) {
          commits.push({
            key: "location",
            partial: locParsed.partial,
            display: locParsed.display,
          });
          steps.location = locParsed.partial;
          text = extractTalkStepRemainder(
            text,
            "location",
            locParsed.partial,
            kind
          );
          continue;
        }
      }
      break;
    }

    commits.push({
      key,
      partial: parsed.partial,
      display: parsed.display,
    });
    steps[key] = parsed.partial;
    if (key === "dates" && !datesStepReadyToAdvance(text, parsed.partial)) {
      break;
    }
    if (
      key === "location" &&
      !locationStepReadyToAdvance(text, parsed.partial, kind)
    ) {
      break;
    }
    if (
      key === "restAddress" &&
      !restAddressStepReadyToAdvance(text, parsed.partial)
    ) {
      break;
    }
    if (
      key === "money" &&
      !moneyStepReadyToAdvance(
        text,
        parsed.partial,
        prior.dealType ?? steps.dealType?.dealType ?? parsed.partial.dealType
      )
    ) {
      break;
    }
    text = extractTalkStepRemainder(text, key, parsed.partial, kind);
    if (
      key === "flags" &&
      !flagsStepComplete(
        parsed.partial,
        resolveTalkDealType(steps.dealType, steps.money),
        steps.roomType?.roomType
      )
    ) {
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
  const mode = talkNormalizeModeForStep(step);
  const text = normalizeTalkStep(raw, step);
  if (!text) return { ok: false, partial: {}, display: "" };

  if (step === "notes") {
    const notes = stripTalkNotesPrefix(text);
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
    const deal = prior?.dealType;
    const room = prior?.roomType;
    const existing: Partial<IntakeParseResult> = {
      loan: prior?.loan,
      insurance: prior?.insurance,
      parking: prior?.parking,
      options: [],
    };
    if (flagsStepComplete(existing, deal, room)) {
      return { ok: false, partial: {}, display: "" };
    }
    const merged = mergeFlagsFromText(existing, text, deal, room);
    if (!merged) return { ok: false, partial: {}, display: "" };
    return {
      ok: true,
      partial: merged,
      display: formatFlagsValueLine(merged, kind, deal, room),
    };
  }

  if (step === "elevator") {
    const existing: Partial<IntakeParseResult> = {
      elevator: prior?.elevator,
      options: [],
    };
    if (elevatorStepComplete(existing)) {
      return { ok: false, partial: {}, display: "" };
    }
    const merged = mergeElevatorFromText(existing, text);
    if (!merged) return { ok: false, partial: {}, display: "" };
    return {
      ok: true,
      partial: merged,
      display: formatElevatorValueLine(merged),
    };
  }

  if (step === "share") {
    const shared = parseIntakeText(text, kind, today, mode).workspaceShared;
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

  if (step === "roomType") {
    const room = parseTalkRoomTypeField(text);
    if (!room.roomType) return { ok: false, partial: {}, display: "" };
    const partial: Partial<IntakeParseResult> = {
      roomType: room.roomType,
      roomCount: room.roomCount,
      bathroomCount: room.bathroomCount,
      options: [],
    };
    return {
      ok: true,
      partial,
      display: stepDisplay(partial, kind, step),
    };
  }

  if (step === "dealType") {
    const dealType = parseTalkDealTypeField(text);
    if (!dealType) return { ok: false, partial: {}, display: "" };
    const partial: Partial<IntakeParseResult> = {
      dealType,
      options: [],
    };
    return {
      ok: true,
      partial,
      display: dealType,
    };
  }

  // 주소·금액·날짜·전화: 칸 모드로 정규화한 뒤 해당 칸 필드만 커밋
  const scoped = stepParseInput(raw, step, kind, prior);
  const parsed = parseIntakeText(scoped, kind, today, mode);

  if (step === "phone") {
    const phone = resolveTalkPhoneCandidate(scoped, "phone", parsed);
    if (!phone) {
      return { ok: false, partial: {}, display: "" };
    }
    const partial: Partial<IntakeParseResult> = { phone, options: [] };
    return {
      ok: true,
      partial,
      display: stepDisplay(partial, kind, step),
    };
  }

  if (step === "location") {
    const mergedPlaces =
      kind === "customer" ? mergeCustomerPlaces(prior, parsed) : null;
    const hasCustomerLoc =
      kind === "customer" && (mergedPlaces?.places.length ?? 0) > 0;
    const hasPropertyLoc =
      kind === "property" && (parsed.dong || parsed.jibun);
    if (!hasCustomerLoc && !hasPropertyLoc) {
      return { ok: false, partial: {}, display: "" };
    }
    const partial: Partial<IntakeParseResult> = {
      gu: mergedPlaces?.gu ?? parsed.gu ?? prior?.gu,
      dong: mergedPlaces?.dong ?? parsed.dong ?? prior?.dong,
      jibun: mergeTalkLocationJibun(parsed.jibun, prior?.jibun),
      places: mergedPlaces?.places ?? parsed.places,
      options: [],
    };
    return {
      ok: true,
      partial,
      display: stepDisplay(partial, kind, step),
    };
  }

  if (step === "restAddress") {
    let buildingName = parsed.buildingName;
    let roomNo = parsed.roomNo;
    if (!buildingName && !roomNo) {
      const rest = splitRestAddress(text);
      const name = rest.buildingName;
      const looksLikeNextField =
        /^(?:매매|전세|월세|보증금|대출|주차|원룸|투룸|쓰리룸|오피스텔|아파트|상가|건물|토지)/.test(
          (name ?? "").replace(/\s+/g, "")
        );
      const looksLikeSpokenNumber = (name ?? "")
        .trim()
        .split(/\s+/)
        .every(
          (part) =>
            /^(?:영|공|일|이|삼|사|오|육|륙|칠|팔|구|십|백|천|만|억|하나|둘|셋|넷|다섯|여섯|일곱|여덟|아홉|열|스물)/.test(
              part
            ) || /^\d+$/.test(part)
        );
      const looksLikeDate = /\d+\s*월|\d+\s*일/.test(name ?? "");
      if (
        name &&
        /[가-힣A-Za-z]/.test(name) &&
        !looksLikeNextField &&
        !looksLikeSpokenNumber &&
        !looksLikeDate
      ) {
        buildingName = name;
        roomNo = rest.roomNo || undefined;
      }
    }
    if (!buildingName && !roomNo) {
      return { ok: false, partial: {}, display: "" };
    }
    const partial: Partial<IntakeParseResult> = {
      buildingName: buildingName ?? prior?.buildingName,
      roomNo: roomNo ?? prior?.roomNo,
      options: [],
    };
    return {
      ok: true,
      partial,
      display: stepDisplay(
        { options: [], notes: "", ...prior, ...partial },
        kind,
        step
      ),
    };
  }

  if (step === "money") {
    const deposit = parsed.deposit ?? prior?.deposit;
    const monthlyRent = parsed.monthlyRent ?? prior?.monthlyRent;
    if (!deposit && !monthlyRent) {
      return { ok: false, partial: {}, display: "" };
    }
    const dealType = parsed.dealType ?? prior?.dealType;
    const partial: Partial<IntakeParseResult> = {
      deposit,
      depositTo: parsed.depositTo ?? prior?.depositTo,
      monthlyRent,
      monthlyRentTo: parsed.monthlyRentTo ?? prior?.monthlyRentTo,
      maintenanceFee: parsed.maintenanceFee ?? prior?.maintenanceFee,
      dealType,
      options: [],
    };
    return {
      ok: true,
      partial,
      display: stepDisplay(
        { ...prior, ...partial, dealType },
        kind,
        step
      ),
    };
  }

  if (step === "dates") {
    if (!parsed.moveInFrom && !parsed.moveInImmediate && !parsed.moveInNegotiable) {
      return { ok: false, partial: {}, display: "" };
    }
    const merged = mergeTalkDates(prior, parsed);
    const partial: Partial<IntakeParseResult> = {
      moveInFrom: merged.moveInFrom,
      moveInTo: merged.moveInTo,
      moveInImmediate: merged.moveInImmediate,
      moveInNegotiable: merged.moveInNegotiable,
      options: [],
    };
    return {
      ok: true,
      partial,
      display: stepDisplay(partial, kind, step),
    };
  }

  if (step === "tenantPhone") {
    if (prior?.tenantPhone) {
      return { ok: false, partial: {}, display: "" };
    }
    const tenant = resolveTalkPhoneCandidate(scoped, "tenantPhone", parsed);
    if (!tenant) {
      return { ok: false, partial: {}, display: "" };
    }
    const partial: Partial<IntakeParseResult> = {
      tenantPhone: tenant,
      options: [],
    };
    return {
      ok: true,
      partial,
      display: stepDisplay(partial, kind, step),
    };
  }

  if (step === "landlordPhone") {
    if (prior?.landlordPhone) {
      return { ok: false, partial: {}, display: "" };
    }
    let landlord = parsed.landlordPhone;
    if (!landlord) {
      const hasTenantLabel =
        /세입자|(?<![현전])임차인|(?<![가-힣])세(?![가-힣])/.test(text);
      const hasLandlordLabel =
        /임대인|(?<![가-힣])임(?![가-힣])|주인/.test(text);
      if (hasTenantLabel && !hasLandlordLabel) {
        return { ok: false, partial: {}, display: "" };
      }
      landlord = parsed.phone ?? parsed.tenantPhone;
    }
    landlord = resolveTalkPhoneCandidate(scoped, "landlordPhone", {
      ...parsed,
      landlordPhone: landlord,
    });
    if (!landlord || !isTalkPhoneComplete(landlord)) {
      return { ok: false, partial: {}, display: "" };
    }
    if (prior?.tenantPhone && landlord === prior.tenantPhone) {
      return { ok: false, partial: {}, display: "" };
    }
    const partial: Partial<IntakeParseResult> = {
      landlordPhone: landlord,
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
  if (
    partial.maintenanceFee != null &&
    needsMaintenanceFee(target.dealType, target.roomType)
  ) {
    target.maintenanceFee = partial.maintenanceFee;
  }
  if (partial.places?.length) {
    const merged = mergeCustomerPlaces(
      { places: target.places, gu: target.gu, dong: target.dong },
      { places: partial.places, gu: partial.gu, dong: partial.dong }
    );
    target.places = merged.places;
    if (merged.gu) target.gu = merged.gu;
    if (merged.dong) target.dong = merged.dong;
  } else if (partial.gu) {
    target.gu = partial.gu;
  } else if (partial.dong) {
    target.dong = partial.dong;
  }
  if (partial.jibun) target.jibun = partial.jibun;
  if (partial.buildingName) target.buildingName = partial.buildingName;
  if (partial.roomNo) target.roomNo = partial.roomNo;
  if (partial.moveInFrom) {
    target.moveInFrom = partial.moveInFrom;
    target.moveInTo = partial.moveInTo ?? partial.moveInFrom;
  }
  if (partial.moveInImmediate) target.moveInImmediate = true;
  if (partial.moveInNegotiable) target.moveInNegotiable = true;
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
