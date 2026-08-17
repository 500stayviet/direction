import { DEAL_TYPES, PROPERTY_OPTIONS, defaultRoomBathCounts, needsRoomBathCounts } from "@/lib/constants";
import {
  isoFollowingMonthDay,
  isoFromMonthDay,
  isoFromYearMonthDay,
  isoNotBeforeToday,
  clampMoveInToToday,
  todayISO,
} from "@/lib/date";
import { formatMoveInRange, formatPhoneInput, toKrPhoneDigits } from "@/lib/format";
import { encodePreferredDong } from "@/lib/preferredLocation";
import {
  composeSeoulAddress,
  findDongInText,
  findLastGuInText,
  findAllDongsInText,
  isKnownSeoulDong,
  resolveGuFromDong,
  SEOUL_DONG_BY_GU,
  SEOUL_GU_LIST,
} from "@/lib/seoulRegions";
import type { DealType, ParkingType, Property, RoomType } from "@/lib/types";

export type IntakeKind = "customer" | "property";
export type YesNo = "유" | "무";

export function formatTalkFlagValue(value: YesNo): string {
  return value === "유" ? "가" : "불";
}

export type IntakeParseResult = {
  name?: string;
  phone?: string;
  tenantPhone?: string;
  landlordPhone?: string;
  roomType?: RoomType;
  roomCount?: number;
  bathroomCount?: number;
  dealType?: DealType;
  deposit?: number;
  depositTo?: number;
  monthlyRent?: number;
  monthlyRentTo?: number;
  maintenanceFee?: number;
  gu?: string;
  dong?: string;
  jibun?: string;
  places?: { gu: string; dong: string }[];
  buildingName?: string;
  roomNo?: string;
  moveInImmediate?: boolean;
  moveInFrom?: string;
  moveInTo?: string;
  loan?: YesNo;
  insurance?: YesNo;
  parking?: YesNo;
  elevator?: YesNo;
  workspaceShared?: YesNo;
  options: string[];
  notes: string;
  nameLabeled?: boolean;
};

const SEOUL_GUS_LONGEST = [...SEOUL_GU_LIST].sort((a, b) => b.length - a.length);
const SEOUL_DONGS_LONGEST = [
  ...new Set(Object.values(SEOUL_DONG_BY_GU).flat()),
].sort((a, b) => b.length - a.length);

const ROOM_ALIASES: { keys: string[]; value: RoomType }[] = [
  { keys: ["3룸+", "쓰리룸+", "쓰리룸", "3룸", "쓰리 룸", "3R", "3r"], value: "3룸+" },
  { keys: ["오피스텔", "오피텔"], value: "오피스텔" },
  { keys: ["아파트"], value: "아파트" },
  { keys: ["투룸", "투 룸", "2룸", "2R", "2r"], value: "투룸" },
  { keys: ["원룸", "원 룸", "1룸", "1R", "1r"], value: "원룸" },
  { keys: ["사무실", "오피스"], value: "사무실" },
  { keys: ["오피"], value: "오피스텔" },
  { keys: ["상가", "점포"], value: "상가" },
  { keys: ["토지", "땅"], value: "토지" },
  { keys: ["건물", "통건물"], value: "건물" },
];

const ROOM_COUNT_WORDS: { keys: string[]; n: number }[] = [
  { keys: ["네룸", "네 룸", "포룸", "포 룸"], n: 4 },
  { keys: ["다섯룸", "다섯 룸"], n: 5 },
];

function isAdjacentSpans(
  text: string,
  a: { start: number; end: number },
  b: { start: number; end: number }
): boolean {
  if (a.end <= b.start) return /^\s*$/.test(text.slice(a.end, b.start));
  if (b.end <= a.start) return /^\s*$/.test(text.slice(b.end, a.start));
  return false;
}

function parseAdjacentBathroom(
  text: string,
  roomSpans: { start: number; end: number }[]
): number | undefined {
  let best: { n: number; index: number } | undefined;
  const keep = (n: number, index: number) => {
    if (!best || index >= best.index) best = { n, index };
  };

  const roomHwaRe = /룸\s*화(?:장실)?\s*([1-4])(?!\d)\s*개?/g;
  let m: RegExpExecArray | null;
  while ((m = roomHwaRe.exec(text))) {
    keep(Number(m[1]), m.index);
  }

  const bathRe = /(?<=^|[\s\d]|룸)화(?:장실)?\s*([1-4])(?!\d)\s*개?/g;
  while ((m = bathRe.exec(text))) {
    const span = { start: m.index, end: m.index + m[0].length };
    if (!roomSpans.some((room) => isAdjacentSpans(text, room, span))) continue;
    keep(Number(m[1]), span.start);
  }
  return best?.n;
}

function parseRoomSpec(text: string): {
  roomType?: RoomType;
  roomCount?: number;
  bathroomCount?: number;
} {
  const typeHit = roomAliasHits(text)[0];
  const roomType = typeHit?.value;
  const typeIndex = typeHit?.index ?? -1;

  const counts: { n: number; start: number; end: number }[] = [];
  const roomSpans: { start: number; end: number }[] = [];
  const nRoomRe = /(?<!\d)([1-5])\s*룸/g;
  let m: RegExpExecArray | null;
  while ((m = nRoomRe.exec(text))) {
    const start = m.index;
    const end = start + m[0].length;
    counts.push({ n: Number(m[1]), start, end });
    roomSpans.push({ start, end });
  }
  const bangRe = /방\s*([1-5])(?!\d)\s*개?/g;
  while ((m = bangRe.exec(text))) {
    const start = m.index;
    const end = start + m[0].length;
    counts.push({ n: Number(m[1]), start, end });
    roomSpans.push({ start, end });
  }
  for (const row of ROOM_COUNT_WORDS) {
    const hit = lastIndex(text, row.keys);
    if (hit) {
      const end = hit.index + hit.key.length;
      counts.push({ n: row.n, start: hit.index, end });
      roomSpans.push({ start: hit.index, end });
    }
  }
  if (typeHit) {
    roomSpans.push({
      start: typeHit.index,
      end: typeHit.index + typeHit.key.length,
    });
  }
  const lastCount = counts.reduce<(typeof counts)[number] | null>((best, hit) => {
    if (!best || hit.start > best.start) return hit;
    return best;
  }, null);
  const bathroomCount = parseAdjacentBathroom(text, roomSpans);

  const skipCount =
    roomType === "상가" ||
    roomType === "사무실" ||
    roomType === "토지" ||
    roomType === "건물";
  if (skipCount) return { roomType };

  const typeFromCount = (
    n: number
  ): { roomType: RoomType; roomCount?: number; bathroomCount?: number } => {
    if (n === 1) return { roomType: "원룸", bathroomCount };
    if (n === 2) return { roomType: "투룸", roomCount: 2, bathroomCount };
    return { roomType: "3룸+", roomCount: n, bathroomCount };
  };

  if (
    (roomType === "아파트" || roomType === "오피스텔") &&
    lastCount &&
    lastCount.start >= typeIndex
  ) {
    return { roomType, roomCount: lastCount.n, bathroomCount };
  }
  if (roomType === "오피스텔") {
    const nested = roomAliasHits(text).find(
      (hit) =>
        hit.value === "원룸" || hit.value === "투룸" || hit.value === "3룸+"
    );
    if (nested) {
      const n =
        nested.value === "원룸" ? 1 : nested.value === "투룸" ? 2 : 3;
      return {
        roomType,
        roomCount: nested.value === "3룸+" ? lastCount?.n ?? 3 : n,
        bathroomCount,
      };
    }
    return { roomType, roomCount: 1, bathroomCount };
  }
  // 원룸은 방·화 1/1이 기본. 양식에 2·3이 있어도 유형이 원룸이면 무시
  if (roomType === "원룸") {
    return { roomType: "원룸", roomCount: 1, bathroomCount: 1 };
  }
  if (lastCount && (!roomType || lastCount.start < typeIndex)) {
    return typeFromCount(lastCount.n);
  }
  if (roomType === "3룸+") {
    const n = lastCount && lastCount.n >= 3 ? lastCount.n : 3;
    return { roomType, roomCount: n, bathroomCount };
  }
  if (roomType === "투룸") return { roomType, roomCount: 2, bathroomCount };
  if (roomType === "아파트") return { roomType, roomCount: 2, bathroomCount };
  return { roomType, bathroomCount };
}

const PET_WORDS =
  /(?:강아지|고양이|반려(?:견|묘)?|애완(?:동물)?|펫)(?:\s*키우[요움]?)?|개\s*키우[요움]?/;
const LOAN_KIND = /디딤돌|버팀목|중금|보금자리|특례|전세대출|주택담보|주담대/;

function lastIndex(text: string, keys: string[]): { key: string; index: number } | null {
  let best: { key: string; index: number } | null = null;
  for (const key of keys) {
    const idx = text.lastIndexOf(key);
    if (idx < 0) continue;
    if (!best || idx > best.index || (idx === best.index && key.length > best.key.length)) {
      best = { key, index: idx };
    }
  }
  return best;
}

function roomAliasHits(
  text: string
): { key: string; value: RoomType; index: number }[] {
  const hits: { key: string; value: RoomType; index: number }[] = [];
  for (const row of ROOM_ALIASES) {
    for (const key of row.keys) {
      let from = 0;
      while (from < text.length) {
        const index = text.indexOf(key, from);
        if (index < 0) break;
        hits.push({ key, value: row.value, index });
        from = index + 1;
      }
    }
  }
  hits.sort((a, b) => a.index - b.index || b.key.length - a.key.length);
  const unique: { key: string; value: RoomType; index: number }[] = [];
  let lastEnd = -1;
  for (const hit of hits) {
    if (hit.index < lastEnd) continue;
    unique.push(hit);
    lastEnd = hit.index + hit.key.length;
  }
  return unique;
}

/** 전세대출·전세보증보험·전세가 안의 전세는 거래종류가 아님 */
function isJeonseDealToken(text: string, index: number): boolean {
  const rest = text.slice(index);
  if (rest.startsWith("전세대출")) return false;
  if (rest.startsWith("전세보증")) return false;
  if (rest.startsWith("전세금")) return false;
  if (rest.startsWith("전세가")) return false;
  return true;
}

function dealTypeHits(text: string): { key: DealType; index: number }[] {
  const hits: { key: DealType; index: number }[] = [];
  for (const key of DEAL_TYPES) {
    let from = 0;
    while (from < text.length) {
      const index = text.indexOf(key, from);
      if (index < 0) break;
      if (key === "매매" && text.slice(index + key.length).startsWith("가")) {
        from = index + key.length;
        continue;
      }
      if (key === "전세" && !isJeonseDealToken(text, index)) {
        from = index + key.length;
        continue;
      }
      hits.push({ key, index });
      from = index + 1;
    }
  }
  hits.sort((a, b) => a.index - b.index || b.key.length - a.key.length);
  const unique: { key: DealType; index: number }[] = [];
  let lastEnd = -1;
  for (const hit of hits) {
    if (hit.index < lastEnd) continue;
    unique.push(hit);
    lastEnd = hit.index + hit.key.length;
  }
  return unique;
}

/** 매매 1억·매매가 2억처럼 거래종류 토큰 뒤에 바로 가격이 오는지 */
function isSalePriceAfterMaemae(text: string, index: number): boolean {
  const tail = text.slice(index + "매매".length);
  return /^(?:가)?\s*\d+(?:\.\d+)?\s*억/.test(tail);
}

/** 월세 50·월세 80만처럼 뒤 월세는 금액 라벨 (거래종류 재등장 아님) */
function isMonthlyRentAfterWolse(text: string, index: number): boolean {
  const tail = text.slice(index + "월세".length);
  return /^\s*\d+(?:\.\d+)?/.test(tail);
}

/** 전세 2억·전세가 2억처럼 뒤 전세는 금액 라벨 (거래종류 재등장 아님) */
function isJeonsePriceAfterJeonse(text: string, index: number): boolean {
  const tail = text.slice(index + "전세".length);
  return /^(?:금|가)?\s*\d+(?:\.\d+)?/.test(tail);
}

/** 뒤 거래는 종류+금액만 내용으로 남기고, 이미 칸에 넣은 지역·날짜·유무는 넣지 않음 */
function leftoverSecondDealPhrase(
  text: string,
  index: number,
  key: DealType
): string {
  const tail = text.slice(index);
  const re = new RegExp(
    `^${key}(?:가|금)?(?:\\s*\\d+(?:\\.\\d+)?(?:\\s*(?:억(?:\\s*\\d+(?:\\.\\d+)?\\s*(?:천|만))?|만|천))?(?:\\s*[\\/／]\\s*\\d+(?:\\.\\d+)?)*)?`
  );
  const m = tail.match(re);
  return (m?.[0] ?? key).replace(/\s+/g, " ").trim();
}

/** 처음 나온 거래종류만 쓰고, 뒤에 또 나온 매매·전세·월세는 칸에서 빼고 내용으로 남김 */
function firstDealFieldText(text: string): {
  dealType?: DealType;
  fieldText: string;
  moneyText: string;
  leftoverDeal?: string;
} {
  const hits = dealTypeHits(text);
  const first = hits[0];
  if (!first) return { fieldText: text, moneyText: text };
  const second = hits[1];
  if (!second) return { dealType: first.key, fieldText: text, moneyText: text };
  // 앞 거래가 매매일 때 뒤 "매매 1억"은 가격 표현 — 잘라내지 않음
  if (
    first.key === "매매" &&
    second.key === "매매" &&
    isSalePriceAfterMaemae(text, second.index)
  ) {
    return { dealType: first.key, fieldText: text, moneyText: text };
  }
  // 앞이 월세일 때 뒤 "월세 50"은 월세 금액 — 잘라내지 않음
  if (
    first.key === "월세" &&
    second.key === "월세" &&
    isMonthlyRentAfterWolse(text, second.index)
  ) {
    return { dealType: first.key, fieldText: text, moneyText: text };
  }
  // 앞이 전세일 때 뒤 "전세 2억"은 전세 금액 — 잘라내지 않음
  if (
    first.key === "전세" &&
    second.key === "전세" &&
    isJeonsePriceAfterJeonse(text, second.index)
  ) {
    return { dealType: first.key, fieldText: text, moneyText: text };
  }
  return {
    dealType: first.key,
    fieldText: text,
    moneyText: text.slice(0, second.index).trimEnd(),
    leftoverDeal: leftoverSecondDealPhrase(text, second.index, second.key),
  };
}

const MEMO_LABEL_RE =
  /(?:메모|내용|추가\s*내용|추가\s*희망\s*사항|희망\s*사항|비고|특이\s*사항|참고|요청\s*사항|기타)\s*[.:：。]/gi;

function splitLabeledMemo(text: string): { body: string; labeledMemo: string } {
  MEMO_LABEL_RE.lastIndex = 0;
  let earliest: { index: number; len: number } | null = null;
  let m: RegExpExecArray | null;
  while ((m = MEMO_LABEL_RE.exec(text))) {
    if (m.index == null) continue;
    if (!earliest || m.index < earliest.index) {
      earliest = { index: m.index, len: m[0].length };
    }
  }
  if (!earliest) return { body: text, labeledMemo: "" };
  return {
    body: text.slice(0, earliest.index).replace(/\s+/g, " ").trim(),
    labeledMemo: text
      .slice(earliest.index + earliest.len)
      .replace(/\s+/g, " ")
      .trim(),
  };
}

const INTENT_MEMO_PATTERNS: RegExp[] = [
  PET_WORDS,
  LOAN_KIND,
  /(?:남향|북향|동향|서향)/,
  /(?:저층|고층|중층|희망층)/,
  /\d+\s*층\s*이상/,
  /(?:저층|고층|중층)\s*싫어요/,
  /역세권|신축|리모델링|올수리|깨끗|조용/,
  /권리금(?:\s*협의)?|인테리어/,
  /현\s*임\s*차\s*인(?:\s*거주\s*중)?|현임차인(?:\s*거주\s*중)?/,
  /이사\s*협의\s*\d+\s*[~～〜∼~－-]\s*\d+\s*개월/,
  /(?:거실|주방|다용도실|화장실(?:\s*포함)?(?!\s*\d))/,
  /주차\s*\d+\s*대(?:\s*가능)?/,
  // 유/무 칸용 「엘리베이터 유」는 빼고, 옵션·희망 표현만 메모로
  /(?:엘리베이터|엘레베이터)(?!\s*(?:유|무|있음|없음|가능|불가|OK|ok))(?:\s*주차)?/,
  /(?:빌라|다세대|다가구|단독|연립|테라스|옥탑|복층|분리형|오픈형|투베이|쓰리베이)/,
  /전임차인/,
];

function extractIntentMemoNotes(text: string): string[] {
  const hits: { index: number; text: string }[] = [];
  for (const pattern of INTENT_MEMO_PATTERNS) {
    const re = new RegExp(
      pattern.source,
      pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`
    );
    for (const m of text.matchAll(re)) {
      if (m.index == null) continue;
      const chunk = (m[0] ?? "").replace(/\s+/g, " ").trim();
      if (!chunk) continue;
      hits.push({ index: m.index, text: chunk });
    }
  }
  hits.sort((a, b) => a.index - b.index);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const hit of hits) {
    if (seen.has(hit.text)) continue;
    seen.add(hit.text);
    out.push(hit.text);
  }
  return out;
}

function splitNoteChunks(value: string): string[] {
  return value
    .split(/\n+|\s*\/\s*/)
    .map((part) => part.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean);
}

function noteKey(value: string): string {
  return value.replace(/\s+/g, "").replace(/주차/g, "");
}

function uniqueNoteParts(parts: string[]): string {
  const out: string[] = [];
  for (const part of parts) {
    for (const chunk of splitNoteChunks(part)) {
      const key = noteKey(chunk);
      if (key.length < 2) continue;
      const idx = out.findIndex((prev) => {
        const pk = noteKey(prev);
        return pk.includes(key) || key.includes(pk);
      });
      if (idx < 0) {
        out.push(chunk);
        continue;
      }
      if (key.length > noteKey(out[idx]).length) out[idx] = chunk;
    }
  }
  return out.join("\n");
}

function buildIntakeMemoNotes(body: string, labeledMemo: string): string {
  const parts: string[] = [];
  if (labeledMemo) parts.push(labeledMemo);
  parts.push(...extractIntentMemoNotes(body));
  return uniqueNoteParts(parts);
}

function appendMemoPart(notes: string, extra: string): string {
  const cleanExtra = scrubCorruptIntakeText(extra);
  if (!cleanExtra) return scrubCorruptIntakeText(notes);
  return scrubCorruptIntakeText(
    uniqueNoteParts([notes, cleanExtra].filter(Boolean))
  );
}

export function appendIntakeMemo(notes: string, extra: string): string {
  return appendMemoPart(notes, extra);
}

function extractAmbiguousDotNotes(text: string): string[] {
  const tripleSpans: { start: number; end: number }[] = [];
  const tripleRe = /(?<!\d)(\d{2})\s*[.．]\s*(\d{1,2})\s*[.．]\s*(\d{1,2})(?!\d)/g;
  for (const m of text.matchAll(tripleRe)) {
    if (m.index == null) continue;
    const year = expandShortYear(Number(m[1]));
    if (isYearMonthDayTriple(year, Number(m[2]), Number(m[3]))) {
      tripleSpans.push({ start: m.index, end: m.index + m[0].length });
    }
  }
  const out: string[] = [];
  const re = /(?<!\d)(\d{1,2})\s*[.,，．]\s*(\d{1,2})(?!\d)(?!\s*(?:억|만|천))/g;
  for (const m of text.matchAll(re)) {
    if (m.index == null) continue;
    if (tripleSpans.some((s) => m.index >= s.start && m.index < s.end)) continue;
    const left = Number(m[1]);
    const right = Number(m[2]);
    if (isMoneySlashPair(left, right)) continue;
    // 달력 월·일은 입주/임대희망일로 가므로 메모에 안 넣음
    if (isCalendarMonthDay(left, right)) continue;
    const chunk = (m[0] ?? "").replace(/\s+/g, "");
    if (chunk) out.push(chunk);
  }
  return out;
}

function expandShortYear(year: number): number {
  return year < 100 ? 2000 + year : year;
}

function parseShortYearDateToken(
  chunk: string,
  today: Date
): string | null {
  const dot = chunk.match(
    new RegExp(
      `(\\d{2})\\s*[${PAIR_SEP_CLS}.]\\s*(\\d{1,2})\\s*[${PAIR_SEP_CLS}.]\\s*(\\d{1,2})`
    )
  );
  if (!dot) return null;
  const year = expandShortYear(Number(dot[1]));
  const month = Number(dot[2]);
  const day = Number(dot[3]);
  if (!isYearMonthDayTriple(year, month, day)) return null;
  const iso = isoFromYearMonthDay(year, month, day);
  return iso ? isoNotBeforeToday(iso, today) : null;
}

function findShortYearDateSpan(
  text: string,
  today: Date
): { from: string; start: number; end: number } | null {
  const re = new RegExp(
    `(?<![\\d])(\\d{2})\\s*[${PAIR_SEP_CLS}.]\\s*(\\d{1,2})\\s*[${PAIR_SEP_CLS}.]\\s*(\\d{1,2})(?!\\d)`,
    "g"
  );
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const from = parseShortYearDateToken(m[0], today);
    if (from && m.index != null) {
      return { from, start: m.index, end: m.index + m[0].length };
    }
  }
  return null;
}

function normalizeFieldShorthands(text: string): string {
  return text
    .replace(/주차\s*(\d+)\s*대\s*(?=가능|유|있)/gi, "주차 가능 ")
    .replace(/(\d)\s*억\s*[\/／.,．，]\s*(\d+)\s*[\/／.,．，]\s*관\s*(\d+)/g, "$1억/$2/관$3")
    .replace(/(\d)\s*억\s*\/\s*(\d+)\s*\/\s*관\s*(\d+)/g, "$1억/$2/관$3");
}

function parseFieldEokSlashMoney(text: string): {
  deposit: number;
  monthlyRent: number;
  maintenanceFee?: number;
  index: number;
  end: number;
} | null {
  const m = text.match(
    /(\d+(?:\.\d+)?)\s*억\s*[\/／.,．，]\s*(\d+(?:\.\d+)?)(?:\s*[\/／.,．，]\s*관?\s*(\d+))?/
  );
  if (!m || m.index == null) return null;
  const deposit = Math.round(Number(m[1]) * 10000);
  const monthlyRent = Math.round(Number(m[2]));
  if (!isPlausibleUnlabeledDeposit(deposit) || monthlyRent <= 0) return null;
  const maintenanceFee = m[3] ? Math.round(Number(m[3])) : undefined;
  if (maintenanceFee != null && !isMaintenanceFee(maintenanceFee)) return null;
  return {
    deposit,
    monthlyRent,
    maintenanceFee,
    index: m.index,
    end: m.index + m[0].length,
  };
}

const YESNO_VALUE =
  "(?:있음|있어요|있고|있습니다|가능(?:해요|합니다|함)?|유|됨|돼요|돼|가능|" +
  "가|불|" +
  "안(?:됨|돼(?:요)?|됩니다|되)?|안\\s*돼(?:요)?|안\\s*됨|안돼(?:요)?|안됩니다|" +
  "없(?:음|어요|어|습니다)?|불가(?:능)?(?:해요|합니다|함)?|무)";

function yesNoFromToken(token: string): YesNo {
  const compact = token.replace(/\s+/g, "");
  if (/^(불|무)$/.test(compact)) return "무";
  if (/^(가|유)$/.test(compact)) return "유";
  return /없|불가|무|안돼|안됨|안되/.test(compact) ? "무" : "유";
}

function yesNoLabelPattern(label: string): string {
  if (label === "주차") return "(?:주차(?:장)?)";
  if (label === "주") return "(?<![가-힣])주(?![가-힣소거인상담민상])";
  if (label === "보증") return "(?:보증(?!보험|금))";
  if (label === "엘") return "(?<![가-힣])엘(?![가-힣지베레])";
  return label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export const INTAKE_YESNO_FIELDS = {
  loan: ["대출"],
  insurance: ["보증보험", "전세보증보험", "보증 보험", "보증"],
  parking: ["주차", "주"],
  elevator: ["엘리베이터", "엘레베이터", "엘베", "E/V", "EV", "승강기", "엘"],
} as const;

export type IntakeYesNoField = keyof typeof INTAKE_YESNO_FIELDS;

/** 엘베는 없어도 되는데처럼 희망 문장은 유/무 칸에 넣지 않음. 엘베 유는 그대로 둔다. */
function isYesNoPreferenceMatch(
  text: string,
  index: number,
  end: number
): boolean {
  const matched = text.slice(index, end).replace(/\s+/g, " ").trim();
  if (
    /^(?:엘리베이터|엘레베이터|엘베|승강기|주차(?:장)?|대출|(?:전세)?보증보험|보증)\s*(?:유|무|있음|없음|있어요|없어요|가능|불가|안됨|안돼|안돼요)$/.test(
      matched
    )
  ) {
    return false;
  }
  if (/[가-힣]는/.test(matched) || /는\s/.test(matched)) return true;
  const after = text.slice(end);
  if (
    /^(?:도\s*되|는데|으면\s*좋|면\s*좋|고\s*(?:저층|고층|있으면|없어도))/.test(
      after
    )
  ) {
    return true;
  }
  return false;
}

function matchYesNo(text: string, labels: string[]): { value: YesNo; end: number } | null {
  let found: { index: number; value: YesNo; end: number } | null = null;
  for (const label of labels) {
    const re = new RegExp(
      `${yesNoLabelPattern(label)}(?:\\s*(?:가입|입)?\\s*)?\\s*(${YESNO_VALUE})`,
      "gi"
    );
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const token = m[1] ?? "";
      const value = yesNoFromToken(token);
      const index = m.index;
      const end = index + m[0].length;
      if (isYesNoPreferenceMatch(text, index, end)) continue;
      if (!found || index < found.index) found = { index, value, end };
    }
  }
  return found ? { value: found.value, end: found.end } : null;
}

export function parseYesNoField(
  text: string,
  field: IntakeYesNoField
): YesNo | undefined {
  return matchYesNo(text, [...INTAKE_YESNO_FIELDS[field]])?.value;
}

export function consumeYesNoField(
  text: string,
  field: IntakeYesNoField
): { value: YesNo; remainder: string } | null {
  const hit = matchYesNo(text, [...INTAKE_YESNO_FIELDS[field]]);
  if (!hit) return null;
  return {
    value: hit.value,
    remainder: text.slice(hit.end).replace(/^\s+/, ""),
  };
}

function parseYesNo(text: string, labels: string[]): YesNo | undefined {
  return matchYesNo(text, labels)?.value;
}

export function parseAllYesNoFields(
  text: string
): Pick<IntakeParseResult, "loan" | "insurance" | "parking" | "elevator"> {
  const juPhone = /(?<![가-힣])주(?:인)?\s*(?:0?1[016789]|\+?82)/.test(text);
  let parking = parseYesNo(text, [...INTAKE_YESNO_FIELDS.parking]);
  if (parking == null && !juPhone) {
    if (/(?<![가-힣])주무|(?<![가-힣])주\s*(?:무|불가)/.test(text)) {
      parking = "무";
    } else if (
      /(?<![가-힣])주유(?![수소])|(?<![가-힣])주\s*(?:\d+\s*대|세단|SUV|suv|가능|유|엘)|(?<![가-힣])주\s*\/\s*엘/.test(
        text
      )
    ) {
      parking = "유";
    } else if (
      /(?<![가-힣])주(?![가-힣소거인상담민상\d])(?!\s*(?:0?1|\d{2,3}[-.\s]))/.test(
        text
      )
    ) {
      parking = "유";
    }
  }
  let elevator = parseYesNo(text, [...INTAKE_YESNO_FIELDS.elevator]);
  if (elevator == null && /(?:주\s*\/\s*엘|엘\s*\/\s*주)/.test(text)) {
    elevator = "유";
  }
  return {
    loan: parseYesNo(text, [...INTAKE_YESNO_FIELDS.loan]),
    insurance: parseYesNo(text, [...INTAKE_YESNO_FIELDS.insurance]),
    parking,
    elevator,
  };
}

const PAIR_SEP_CLS = "\\/／.,．，";

/** 달력: 월 1–12, 일 1–31. 이 밖이면 보증금/월세 */
function isMonthDaySlash(left: number, right: number): boolean {
  return left >= 1 && left <= 12 && right >= 1 && right <= 31;
}

/** 실제 존재하는 월·일 (2/30 등은 제외). 윤년 기준으로 검사 */
function isCalendarMonthDay(month: number, day: number): boolean {
  return Boolean(isoFromYearMonthDay(2000, month, day));
}

function isDepositRentPair(left: number, right: number): boolean {
  return !isMonthDaySlash(left, right);
}

/** 라벨·억 없이 나온 보증금. 현장은 보통 100만 이상, 1만원 단위는 거의 없음 */
const MIN_UNLABELED_DEPOSIT = 100;
const MIN_MONTHLY = 5;
const MAX_MONTHLY_RANGE = 200;

/** 보증금은 10만 단위. 111·222처럼 세 자리 반복만 1단위 예외 */
function isRoundDeposit(n: number): boolean {
  if (!Number.isFinite(n) || n <= 0) return false;
  if (n % 10 === 0) return true;
  return n >= 111 && n <= 999 && n % 111 === 0;
}

function isPlausibleUnlabeledDeposit(n: number): boolean {
  return n >= MIN_UNLABELED_DEPOSIT && isRoundDeposit(n);
}

function isPlausibleDeposit(n: number, asSale: boolean): boolean {
  if (asSale) return n > 0;
  return isRoundDeposit(n);
}

/** 아파트·3룸+·건물·토지는 매매 숫자 1~99를 억으로 봄. 원룸·상가 등은 30억까지만 */
const UNLIMITED_BARE_SALE_EOK: RoomType[] = ["아파트", "오피스텔", "3룸+", "건물", "토지"];
const MAX_BARE_SALE_EOK_SMALL = 30;

function maxBareSaleEok(roomType?: RoomType): number | null {
  if (roomType && UNLIMITED_BARE_SALE_EOK.includes(roomType)) return null;
  return MAX_BARE_SALE_EOK_SMALL;
}

/** 매매 1~99(억 없음) → N억. 세 자리 509는 건물·토지만 509억 */
function saleBareToManwon(
  n: number,
  allowTripleEok: boolean,
  maxBareEok: number | null = MAX_BARE_SALE_EOK_SMALL
): number | null {
  if (n >= 1 && n <= 99) {
    if (maxBareEok != null && n > maxBareEok) return null;
    return n * 10000;
  }
  if (n >= 100 && n <= 999) {
    if (!allowTripleEok) return null;
    return n * 10000;
  }
  return n;
}

function classifyBareRange(
  a: number,
  b: number,
  opts: {
    asSale?: boolean;
    allowTripleEok?: boolean;
    maxBareEok?: number | null;
    preferMonthly?: boolean;
    preferDeposit?: boolean;
  } = {}
): { from: number; to: number; monthly?: boolean } | null {
  const from = Math.min(a, b);
  const to = Math.max(a, b);
  const asSale = Boolean(opts.asSale);
  const allowTripleEok = Boolean(opts.allowTripleEok);
  const maxBareEok =
    opts.maxBareEok === undefined ? MAX_BARE_SALE_EOK_SMALL : opts.maxBareEok;
  if (asSale) {
    const fromN = saleBareToManwon(from, allowTripleEok, maxBareEok);
    const toN = saleBareToManwon(to, allowTripleEok, maxBareEok);
    if (fromN == null || toN == null) return null;
    return { from: fromN, to: toN };
  }
  if (opts.preferMonthly && !opts.preferDeposit) {
    if (from >= MIN_MONTHLY && to <= MAX_MONTHLY_RANGE) {
      return { from, to, monthly: true };
    }
  }
  if (opts.preferDeposit && !opts.preferMonthly) {
    if (isRoundDeposit(from) && isRoundDeposit(to)) return { from, to };
    return null;
  }
  if (
    from < MIN_UNLABELED_DEPOSIT &&
    from >= MIN_MONTHLY &&
    to <= MAX_MONTHLY_RANGE
  ) {
    return { from, to, monthly: true };
  }
  if (
    from >= MIN_UNLABELED_DEPOSIT &&
    isRoundDeposit(from) &&
    isRoundDeposit(to)
  ) {
    return { from, to };
  }
  return null;
}

function isMoneySlashPair(left: number, right: number): boolean {
  return (
    isDepositRentPair(left, right) &&
    isPlausibleUnlabeledDeposit(left) &&
    right > 0
  );
}

function isMoneySlashTriple(a: number, b: number, c: number): boolean {
  return (
    !isYearMonthDayTriple(a, b, c) &&
    isPlausibleUnlabeledDeposit(a) &&
    b > 0
  );
}

function collapseThousandCommas(text: string): string {
  let next = text;
  let prev = "";
  while (prev !== next) {
    prev = next;
    next = next.replace(/(\d{1,3}),(\d{3})(?!\d)/g, "$1$2");
  }
  return next;
}

function isYearMonthDayTriple(a: number, b: number, c: number): boolean {
  return a >= 1900 && a <= 2100 && b >= 1 && b <= 12 && c >= 1 && c <= 31;
}

const TILDE_CLS = "~～〜∼";
/**
 * 기간(단일 아님) 연결. 날짜 토큰과 토큰 사이에서만 씀.
 * ~ 계열은 기존, 하이픈은 날짜-날짜일 때만.
 * . , / 는 PAIR_SEP(날짜 안·금액)이라 여기 넣지 않음.
 */
const DATE_RANGE_LINK_INNER = `부터(?:는)?|까지(?:는)?|에서|와|과|하고|내지|[${TILDE_CLS}\\-]`;
const DATE_RANGE_LINK = `(?:${DATE_RANGE_LINK_INNER})`;

export function dateRangeLinkTail(text: string): boolean {
  return new RegExp(`(?:${DATE_RANGE_LINK_INNER})\\s*$`).test(text);
}

export function hasDateRangeWord(text: string): boolean {
  return /부터(?:는)?|까지(?:는)?|에서|와|과|하고|내지/.test(text);
}

function rangeLabelPrefs(text: string): {
  preferMonthly: boolean;
  preferDeposit: boolean;
} {
  const preferMonthly = /월세/.test(text);
  const preferDeposit =
    /보증금/.test(text) ||
    /(?<![가-힣])보증(?!보험)/.test(text) ||
    /전세/.test(text);
  return { preferMonthly, preferDeposit };
}

function parseTildeMoneyRange(
  text: string,
  asSale = false,
  allowTripleEok = false,
  maxBareEok: number | null = MAX_BARE_SALE_EOK_SMALL
): {
  from: number;
  to: number;
  monthly?: boolean;
  start: number;
  end: number;
} | null {
  const prefs = rangeLabelPrefs(text);
  const rangeOpts = { asSale, allowTripleEok, maxBareEok, ...prefs };
  const rent = text.match(
    new RegExp(
      `월세\\s*(\\d+(?:\\.\\d+)?)\\s*[${TILDE_CLS}]\\s*(\\d+(?:\\.\\d+)?)`
    )
  );
  if (rent && rent.index != null) {
    const a = Math.round(Number(rent[1]));
    const b = Math.round(Number(rent[2]));
    if (a > 0 && b > 0) {
      return {
        from: Math.min(a, b),
        to: Math.max(a, b),
        monthly: true,
        start: rent.index,
        end: rent.index + rent[0].length,
      };
    }
  }

  const eok = text.match(
    new RegExp(
      `(\\d+(?:\\.\\d+)?)\\s*억\\s*[${TILDE_CLS}]\\s*(\\d+(?:\\.\\d+)?)\\s*억`
    )
  );
  if (eok && eok.index != null) {
    const a = Math.round(Number(eok[1]) * 10000);
    const b = Math.round(Number(eok[2]) * 10000);
    if (a > 0 && b > 0) {
      return {
        from: Math.min(a, b),
        to: Math.max(a, b),
        start: eok.index,
        end: eok.index + eok[0].length,
      };
    }
  }

  const eokRight = text.match(
    new RegExp(
      `(?<![년월일\\d])(\\d+(?:\\.\\d+)?)\\s*[${TILDE_CLS}]\\s*(\\d+(?:\\.\\d+)?)\\s*억`
    )
  );
  if (eokRight && eokRight.index != null) {
    const a = Math.round(Number(eokRight[1]) * 10000);
    const b = Math.round(Number(eokRight[2]) * 10000);
    if (a > 0 && b > 0) {
      return {
        from: Math.min(a, b),
        to: Math.max(a, b),
        start: eokRight.index,
        end: eokRight.index + eokRight[0].length,
      };
    }
  }

  const man = text.match(
    new RegExp(
      `(\\d+(?:\\.\\d+)?)\\s*만\\s*[${TILDE_CLS}]\\s*(\\d+(?:\\.\\d+)?)\\s*만`
    )
  );
  if (man && man.index != null) {
    const a = Math.round(Number(man[1]));
    const b = Math.round(Number(man[2]));
    if (a > 0 && b > 0) {
      const classified = classifyBareRange(a, b, rangeOpts);
      if (classified) {
        return {
          ...classified,
          start: man.index,
          end: man.index + man[0].length,
        };
      }
    }
  }

  const bare = text.match(
    new RegExp(
      `(?<![년월일${PAIR_SEP_CLS}\\d])(\\d{1,5}(?:\\.\\d+)?)\\s*[${TILDE_CLS}]\\s*(\\d{1,5}(?:\\.\\d+)?)(?!\\s*(?:년|월|일|억|만|원|개월|[${PAIR_SEP_CLS}]))`
    )
  );
  if (bare && bare.index != null) {
    const rawA = bare[1] ?? "";
    const rawB = bare[2] ?? "";
    if (rawA.startsWith("0") || rawB.startsWith("0")) return null;
    const a = Math.round(Number(rawA));
    const b = Math.round(Number(rawB));
    if (a > 0 && b > 0) {
      const classified = classifyBareRange(a, b, rangeOpts);
      if (classified) {
        return {
          ...classified,
          start: bare.index,
          end: bare.index + bare[0].length,
        };
      }
    }
  }
  return null;
}

function isMaintenanceFee(n: number): boolean {
  return n >= 1 && n <= 100;
}

function parseSlashTriples(
  text: string
): { a: number; b: number; c: number; index: number; end: number }[] {
  const triples: { a: number; b: number; c: number; index: number; end: number }[] =
    [];
  const re = new RegExp(
    `(?<![${PAIR_SEP_CLS}\\d])(\\d{1,5})\\s*[${PAIR_SEP_CLS}]\\s*(\\d{1,5})\\s*[${PAIR_SEP_CLS}]\\s*(\\d{1,5})(?!\\s*[${PAIR_SEP_CLS}])(?!\\s*(?:억|만|원))`,
    "g"
  );
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    triples.push({
      a: Number(m[1]),
      b: Number(m[2]),
      c: Number(m[3]),
      index: m.index,
      end: m.index + m[0].length,
    });
  }
  return triples;
}

function parseSlashPairs(
  text: string
): { left: number; right: number; index: number; end: number; sep: string }[] {
  const pairs: {
    left: number;
    right: number;
    index: number;
    end: number;
    sep: string;
  }[] = [];
  const re = new RegExp(
    `(?<![${PAIR_SEP_CLS}\\d])(\\d{1,5})\\s*([${PAIR_SEP_CLS}])\\s*(\\d{1,5})(?!\\s*[${PAIR_SEP_CLS}])(?!\\s*(?:억|만|원))`,
    "g"
  );
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    pairs.push({
      left: Number(m[1]),
      right: Number(m[3]),
      index: m.index,
      end: m.index + m[0].length,
      sep: m[2] ?? "/",
    });
  }
  return pairs;
}

/** 8/25 · 8.25 · 8,25 · 8-25 처럼 쓴 월·일 (실제 달력만) */
function collectMonthDayDatePairs(
  text: string
): { month: number; day: number; index: number; end: number }[] {
  const out: { month: number; day: number; index: number; end: number }[] = [];
  const seen = new Set<string>();
  const push = (month: number, day: number, index: number, end: number) => {
    if (!isCalendarMonthDay(month, day)) return;
    const key = `${index}:${end}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ month, day, index, end });
  };
  for (const p of parseSlashPairs(text)) {
    push(p.left, p.right, p.index, p.end);
  }
  // 동 뒤 10-20 은 지번. 단독 8-25 만 월·일로 본다
  const hy =
    /(?<![가-힣]동\s*)(?<![\d./／.,．，-])(\d{1,2})\s*-\s*(\d{1,2})(?!\d)/g;
  for (const m of text.matchAll(hy)) {
    if (m.index == null) continue;
    push(Number(m[1]), Number(m[2]), m.index, m.index + m[0].length);
  }
  out.sort((a, b) => a.index - b.index);
  return out;
}

function maskSlashDates(text: string): string {
  const shortYearRe = new RegExp(
    `(?<![\\d])(\\d{2})\\s*[${PAIR_SEP_CLS}.]\\s*(\\d{1,2})\\s*[${PAIR_SEP_CLS}.]\\s*(\\d{1,2})(?!\\d)`,
    "g"
  );
  const masked = text.replace(shortYearRe, (full, yy, month, day) => {
    const year = expandShortYear(Number(yy));
    return isYearMonthDayTriple(year, Number(month), Number(day))
      ? " ".repeat(full.length)
      : full;
  });
  const yearRe = new RegExp(
    `(?<![${PAIR_SEP_CLS}\\d])(\\d{4})\\s*[${PAIR_SEP_CLS}]\\s*(\\d{1,2})\\s*[${PAIR_SEP_CLS}]\\s*(\\d{1,2})(?!\\s*[${PAIR_SEP_CLS}])(?!\\s*(?:억|만|원))`,
    "g"
  );
  // / . , 모두 — 달력에 맞는 월·일은 금액으로 안 읽게 가림
  const pairRe = new RegExp(
    `(?<![${PAIR_SEP_CLS}\\d])(\\d{1,2})\\s*[${PAIR_SEP_CLS}]\\s*(\\d{1,2})(?!\\d)(?!\\s*[${PAIR_SEP_CLS}])(?!\\s*(?:억|만|원))`,
    "g"
  );
  return masked
    .replace(yearRe, (full, year, month, day) =>
      isYearMonthDayTriple(Number(year), Number(month), Number(day))
        ? " ".repeat(full.length)
        : full
    )
    .replace(pairRe, (full, left, right) =>
      isCalendarMonthDay(Number(left), Number(right))
        ? " ".repeat(full.length)
        : full
    );
}

/** 5억9처럼 억 뒤에 단위 없는 숫자는 애매해서 그 억은 쓰지 않음 */
function isIncompleteEokTail(text: string, afterEok: number): boolean {
  const rest = text.slice(afterEok);
  return /^\s*\d+(?:\.\d+)?(?!\s*(?:억|천|백|만|년|월|일|층|호|동|룸))/.test(rest);
}

/** 1억 2억·1억~2억만 구간. 1억 암사동 2억처럼 가운데 글이 있으면 뒤 억은 버림 */
function isAdjacentEokGap(text: string, from: number, to: number): boolean {
  return new RegExp(`^[\\s${TILDE_CLS}]*$`).test(text.slice(from, to));
}

/** 월세 50은 월세 금액, 월세 2000/65는 보증/월세 쌍 */
function findLabeledMonthlyRent(
  moneyText: string
): RegExpMatchArray | null {
  const patterns = [
    /월세\s*(\d+(?:\.\d+)?)\s*만(?!\s*월)/,
    /(?<!\d)월\s*(\d+(?:\.\d+)?)\s*만(?!\s*월)/,
    /월세\s*(\d+(?:\.\d+)?)(?!\d)(?!\s*(?:억|천|백|만|월|일))/,
    /(?<!\d)월\s*(\d{1,4})(?!\d)(?!\s*(?:억|천|백|만|월|일))/,
  ];
  for (const re of patterns) {
    const m = moneyText.match(re);
    if (!m || m.index == null || !m[1]) continue;
    const after = moneyText.slice(m.index + m[0].length);
    if (/^\s*[\/／]\s*\d+/.test(after)) continue;
    return m;
  }
  return null;
}

function parseMoneyManwon(
  text: string,
  opts: {
    asSale?: boolean;
    allowTripleEok?: boolean;
    maxBareEok?: number | null;
  } = {}
): {
  deposit?: number;
  depositTo?: number;
  monthlyRent?: number;
  monthlyRentTo?: number;
  maintenanceFee?: number;
  twoPartSlash?: boolean;
  usedSpans: { start: number; end: number }[];
} {
  const asSale = Boolean(opts.asSale);
  const allowTripleEok = Boolean(opts.allowTripleEok);
  const maxBareEok =
    opts.maxBareEok === undefined ? MAX_BARE_SALE_EOK_SMALL : opts.maxBareEok;
  const usedSpans: { start: number; end: number }[] = [];
  const pushSpan = (start: number, end: number) => {
    usedSpans.push({ start, end });
  };
  const moneyText = maskSlashDates(text);
  let monthlyRent: number | undefined;
  let deposit: number | undefined;
  let depositTo: number | undefined;
  let monthlyRentTo: number | undefined;
  let maintenanceFee: number | undefined;
  let twoPartSlash = false;
  let fieldSlashHit = false;

  if (!asSale) {
    const fieldSlash = parseFieldEokSlashMoney(moneyText);
    if (fieldSlash) {
      fieldSlashHit = true;
      deposit = fieldSlash.deposit;
      monthlyRent = fieldSlash.monthlyRent;
      if (fieldSlash.maintenanceFee != null) {
        maintenanceFee = fieldSlash.maintenanceFee;
      } else {
        twoPartSlash = true;
      }
      pushSpan(fieldSlash.index, fieldSlash.end);
    }
  }

  const monthly = findLabeledMonthlyRent(moneyText);
  if (monthly && !asSale && !fieldSlashHit && monthly.index != null) {
    monthlyRent = Math.round(Number(monthly[1]));
    pushSpan(monthly.index, monthly.index + monthly[0].length);
  }

  const tildeMoney = parseTildeMoneyRange(
    moneyText,
    asSale,
    allowTripleEok,
    maxBareEok
  );
  const compoundEok = parseCompoundEokMoney(moneyText);
  const eok = [...moneyText.matchAll(/(\d+(?:\.\d+)?)\s*억/g)];
  const saleLabeled = moneyText.match(
    /(?:매매(?:가)?|(?<![가-힣물])매(?:가)?)\s*(\d+(?:\.\d+)?)\s*억(?:\s*(\d+(?:\.\d+)?)\s*(천|만)|\s*(\d{2,4})(?!\d))?/
  );
  if (asSale && saleLabeled && saleLabeled.index != null && deposit == null) {
    const eokPart = Number(saleLabeled[1]);
    const rest = saleLabeled[2] ? Number(saleLabeled[2]) : 0;
    const unit = saleLabeled[3];
    const bareMan = saleLabeled[4] ? Number(saleLabeled[4]) : 0;
    deposit = Math.round(
      eokPart * 10000 +
        (unit === "천" ? rest * 1000 : unit === "만" ? rest : bareMan)
    );
    pushSpan(saleLabeled.index, saleLabeled.index + saleLabeled[0].length);
  }

  const labeledCheon = moneyText.match(
    /(?:보증금|전세가|매매(?:가)?|매가|(?<![가-힣물])매|(?<![가-힣])보|보증|전세)\s*(\d+(?:\.\d+)?)\s*천/
  );
  const cheonSlash = moneyText.match(
    /(\d+(?:\.\d+)?)\s*천\s*[\/／]\s*(\d+(?:\.\d+)?)/
  );

  const man = moneyText.match(
    new RegExp(
      `(?:보증금|전세가|매매(?:가)?|매가|(?<![가-힣물])매|(?<![가-힣])보|매매|전세)\\s*(\\d+(?:\\.\\d+)?)\\s*만?(?!\\s*[${TILDE_CLS}억천백])|보증\\s*(\\d+(?:\\.\\d+)?)(?!\\s*[${TILDE_CLS}억천백])|(\\d+(?:\\.\\d+)?)\\s*만(?!\\s*원)`
    )
  );

  if (tildeMoney?.monthly) {
    monthlyRent = tildeMoney.from;
    monthlyRentTo = tildeMoney.to;
    pushSpan(tildeMoney.start, tildeMoney.end);
  }

  if (compoundEok) {
    deposit = compoundEok.deposit;
    pushSpan(compoundEok.index, compoundEok.end);
  } else if (tildeMoney && !tildeMoney.monthly) {
    deposit = tildeMoney.from;
    depositTo = tildeMoney.to;
    pushSpan(tildeMoney.start, tildeMoney.end);
  } else if (!fieldSlashHit && eok.length > 0) {
    const amounts = eok
      .filter((hit) => {
        const start = hit.index ?? 0;
        return !isIncompleteEokTail(moneyText, start + hit[0].length);
      })
      .map((hit) => ({
        value: Math.round(Number(hit[1]) * 10000),
        start: hit.index ?? 0,
        end: (hit.index ?? 0) + hit[0].length,
      }))
      .filter((hit) => hit.value > 0);
    const chain = amounts[0] ? [amounts[0]] : [];
    for (let i = 1; i < amounts.length; i += 1) {
      const prev = chain[chain.length - 1];
      const next = amounts[i];
      if (!prev || !next || !isAdjacentEokGap(moneyText, prev.end, next.start)) {
        break;
      }
      chain.push(next);
    }
    if (chain.length >= 2) {
      const values = chain.map((hit) => hit.value);
      deposit = Math.min(...values);
      depositTo = Math.max(...values);
      for (const hit of chain) pushSpan(hit.start, hit.end);
    } else if (chain[0]) {
      deposit = chain[0].value;
      pushSpan(chain[0].start, chain[0].end);
    }
  } else if (labeledCheon && labeledCheon.index != null) {
    const n = Math.round(Number(labeledCheon[1]) * 1000);
    if (n > 0 && isPlausibleDeposit(n, asSale)) {
      deposit = n;
      pushSpan(labeledCheon.index, labeledCheon.index + labeledCheon[0].length);
    }
  } else if (man && man.index != null) {
    const labeled = Boolean(man[1] || man[2]);
    const raw = man[1] || man[2] || man[3];
    if (raw && !isKrPhoneDigitRun(raw.replace(/\D/g, ""))) {
      const n = Math.round(Number(raw));
      if (labeled ? isPlausibleDeposit(n, asSale) : isPlausibleUnlabeledDeposit(n)) {
        if (asSale) {
          const sale = saleBareToManwon(n, allowTripleEok, maxBareEok);
          if (sale != null) {
            deposit = sale;
            pushSpan(man.index, man.index + man[0].length);
          }
        } else {
          deposit = n;
          pushSpan(man.index, man.index + man[0].length);
        }
      }
    }
  }

  if (
    !asSale &&
    !fieldSlashHit &&
    deposit == null &&
    monthlyRent == null &&
    cheonSlash &&
    cheonSlash.index != null
  ) {
    const dep = Math.round(Number(cheonSlash[1]) * 1000);
    const rent = Math.round(Number(cheonSlash[2]));
    if (dep > 0 && rent > 0 && isPlausibleDeposit(dep, false)) {
      deposit = dep;
      monthlyRent = rent;
      pushSpan(cheonSlash.index, cheonSlash.index + cheonSlash[0].length);
    }
  }

  if (asSale && allowTripleEok && deposit == null) {
    const bareSale = moneyText.match(
      /(?<![년월일\d])(\d{3})(?!\d)(?!\s*(?:년|월|일|억|만|원|천|층|호|동|번))/
    );
    if (bareSale && bareSale.index != null) {
      const n = Number(bareSale[1]);
      if (n >= 100 && n <= 999 && !isKrPhoneDigitRun(String(n))) {
        const sale = saleBareToManwon(n, true, null);
        if (sale != null) {
          deposit = sale;
          pushSpan(bareSale.index, bareSale.index + bareSale[0].length);
        }
      }
    }
  }

  const feeLabel = moneyText.match(/관리비\s*(\d+(?:\.\d+)?)/);
  if (feeLabel && feeLabel.index != null) {
    const n = Math.round(Number(feeLabel[1]));
    if (isMaintenanceFee(n)) {
      maintenanceFee = n;
      pushSpan(feeLabel.index, feeLabel.index + feeLabel[0].length);
    }
  }
  if (maintenanceFee == null) {
    const feeShort = moneyText.match(/(?:^|[\s/／])관\s*(\d{1,2})(?!\d)/);
    if (feeShort && feeShort.index != null) {
      const n = Math.round(Number(feeShort[1]));
      if (isMaintenanceFee(n)) {
        maintenanceFee = n;
        pushSpan(feeShort.index, feeShort.index + feeShort[0].length);
      }
    }
  }

  if (!asSale && deposit == null) {
    const slashTriple = parseSlashTriples(text).find((t) =>
      isMoneySlashTriple(t.a, t.b, t.c)
    );
    if (slashTriple) {
      if (deposit == null) deposit = slashTriple.a;
      if (monthlyRent == null) monthlyRent = slashTriple.b;
      if (maintenanceFee == null && isMaintenanceFee(slashTriple.c)) {
        maintenanceFee = slashTriple.c;
      }
      pushSpan(slashTriple.index, slashTriple.end);
    } else {
      const slashMoney = parseSlashPairs(text).find((p) =>
        isMoneySlashPair(p.left, p.right)
      );
      if (slashMoney) {
        if (deposit == null) deposit = slashMoney.left;
        if (monthlyRent == null) monthlyRent = slashMoney.right;
        twoPartSlash = true;
        pushSpan(slashMoney.index, slashMoney.end);
      }
    }
  }

  return {
    deposit,
    depositTo,
    monthlyRent,
    monthlyRentTo,
    maintenanceFee,
    twoPartSlash,
    usedSpans,
  };
}

function maskUsedSpans(
  text: string,
  spans: { start: number; end: number }[]
): string {
  if (spans.length === 0) return text;
  const chars = text.split("");
  for (const span of spans) {
    const from = Math.max(0, span.start);
    const to = Math.min(chars.length, span.end);
    for (let i = from; i < to; i += 1) chars[i] = " ";
  }
  return chars.join("");
}

function parseJibunFromAfter(after: string): string | undefined {
  // 111-1 · 111−1 · 111~1
  const pair = after.match(
    new RegExp(
      `^\\s*(\\d{1,5})\\s*[-−${TILDE_CLS}]\\s*(\\d{1,5})(?!\\d)`
    )
  );
  if (pair?.[1] && !pair[1].startsWith("0")) {
    return `${pair[1]}-${pair[2]}`;
  }
  // 음성: 111에1 · 111 에 1 · 111다시1 · 111 다시 1
  const spokenPair = after.match(
    /^\s*(\d{1,5})\s*(?:에|의|다시)\s*(\d{1,5})(?!\d)/
  );
  if (spokenPair?.[1] && !spokenPair[1].startsWith("0")) {
    return `${spokenPair[1]}-${spokenPair[2]}`;
  }
  const bunji = after.match(/^\s*(\d{1,5})\s*번지/);
  if (bunji?.[1] && !bunji[1].startsWith("0")) return bunji[1];
  const main = after.match(
    new RegExp(
      `^\\s*(\\d{1,5})(?!\\d)(?!\\s*(?:년|월|일|억|만|원(?!룸)|천|층|호|동|룸|번|에|의|다시|[${PAIR_SEP_CLS}]))`
    )
  );
  if (!main?.[1] || main[1].startsWith("0")) return undefined;
  const n = Number(main[1]);
  if (n >= 1900 && n <= 2100) return undefined;
  return main[1];
}

function parseLocation(
  locText: string,
  sourceText: string
): { gu?: string; dong?: string; jibun?: string } {
  const hintedGu = findLastGuInText(locText);
  const dongHit = findDongInText(locText, hintedGu);
  const dong = dongHit?.dong;
  const gu = dongHit?.gu ?? hintedGu;
  if (!dongHit || !dong) return { gu, dong, jibun: undefined };

  const sourceHit = findDongInText(sourceText, hintedGu);
  const after =
    sourceHit && sourceHit.dong === dong
      ? sourceText.slice(sourceHit.end)
      : locText.slice(dongHit.end);
  return { gu, dong, jibun: parseJibunFromAfter(after) };
}

function parseRoomNo(text: string): string | undefined {
  const dongHo = text.match(/(?<![가-힣])(\d{1,4})\s*동\s*(\d{1,4})\s*호/);
  if (dongHo) return `${dongHo[1]}동 ${dongHo[2]}호`;
  const floorHo = text.match(/(\d{1,3})\s*층\s*(\d{1,4})\s*호/);
  if (floorHo) return `${floorHo[1]}층 ${floorHo[2]}호`;
  const ho = text.match(/(\d{1,4})\s*호/);
  if (ho) return `${ho[1]}호`;
  const dongOnly = text.match(/(?<![가-힣])(\d{1,4})\s*동(?!\s*\d)/);
  if (dongOnly) return `${dongOnly[1]}동`;
  const floor = text.match(/(\d+)\s*층/);
  if (floor && floor.index != null) {
    const before = text.slice(Math.max(0, floor.index - 6), floor.index);
    if (/희망층?\s*$/.test(before)) return undefined;
    return `${floor[1]}층`;
  }
  return undefined;
}

const BUILDING_NAME_TOKEN =
  String.raw`[가-힣A-Za-z][가-힣A-Za-z0-9]{1,24}`;

function isBuildingNameCandidate(raw: string): boolean {
  const word = raw.replace(/\s+/g, "").trim();
  if (word.length < 2 || word.length > 24) return false;
  if (NAME_STOP.has(word)) return false;
  if (isKnownSeoulDong(word)) return false;
  if (SEOUL_GU_LIST.includes(word as (typeof SEOUL_GU_LIST)[number])) {
    return false;
  }
  if (!/^[가-힣A-Za-z][가-힣A-Za-z0-9]*$/.test(word)) return false;
  return true;
}

function parseBuildingName(text: string): string | undefined {
  const labeled = text.match(
    new RegExp(
      String.raw`(?:단지명|건물명)\s*[:：]?\s*(${BUILDING_NAME_TOKEN})`
    )
  );
  if (labeled?.[1] && isBuildingNameCandidate(labeled[1])) {
    return labeled[1].trim();
  }
  const beforeRoom = text.match(
    new RegExp(
      String.raw`(?:\d{1,5}\s*[-−~]\s*\d{1,5}|\d{1,5}|[가-힣]+동)\s+(${BUILDING_NAME_TOKEN})\s+(?=\d+\s*동|\d+\s*호)`
    )
  );
  if (beforeRoom?.[1] && isBuildingNameCandidate(beforeRoom[1])) {
    return beforeRoom[1].trim();
  }
  const afterJibun = text.match(
    new RegExp(
      String.raw`\d{1,5}(?:\s*[-−~]\s*\d{1,5})?\s+(${BUILDING_NAME_TOKEN})(?=\s|$)`
    )
  );
  if (afterJibun?.[1] && isBuildingNameCandidate(afterJibun[1])) {
    return afterJibun[1].trim();
  }
  const beforeDongHo = text.match(
    new RegExp(
      String.raw`(${BUILDING_NAME_TOKEN})\s+(?=\d+\s*동(?:\s*\d+\s*호)?|\d+\s*호)`
    )
  );
  if (beforeDongHo?.[1] && isBuildingNameCandidate(beforeDongHo[1])) {
    return beforeDongHo[1].trim();
  }
  return undefined;
}

function isKrPhoneDigitRun(digits: string): boolean {
  return /^0[1-9]\d{7,9}$/.test(toKrPhoneDigits(digits));
}

function isLikelyPhone(
  digits: string,
  text: string,
  index: number,
  end: number
) {
  const n = digits.length;
  const raw = text.slice(index, end);
  const after = text.slice(end).trimStart();
  if (/^(억|만|원)(?![가-힣])/.test(after)) return false;
  // 날짜(3월·1일·2024년)는 제외. 월세(거래)는 허용.
  if (/^[일년]/.test(after)) return false;
  if (/^월(?!세)/.test(after)) return false;
  const before = text.slice(Math.max(0, index - 4), index);
  if (/\d\s*월\s*$/.test(before) || /년\s*$/.test(before)) return false;
  if (/[\/／.,．，~～〜∼]/.test(raw)) return false;
  if (isKrPhoneDigitRun(digits)) return true;
  if (n === 7 && /^[1-9]\d{6}$/.test(digits)) {
    if (/\s/.test(raw) || /^(동|호|층)/.test(after)) return false;
    return true;
  }
  return false;
}

type PhoneHit = { raw: string; formatted: string; index: number; end: number };

function parsePhoneHits(text: string): PhoneHit[] {
  const source = text.replace(/다시|하이픈|빼기/g, " ");
  const hits: PhoneHit[] = [];
  type Cell = { d: string; i: number };
  const groups: Cell[][] = [[]];
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    if (/\d/.test(ch)) {
      groups[groups.length - 1].push({ d: ch, i });
      continue;
    }
    const hangulBreak = /[가-힣a-zA-Z]/.test(ch) && ch !== "에" && ch !== "의";
    const moneyBreak = /[\/／.,．，~～〜∼]/.test(ch);
    if ((hangulBreak || moneyBreak) && groups[groups.length - 1].length) {
      groups.push([]);
    }
  }

  for (const g of groups) {
    if (g.length < 7) continue;
    const ds = g.map((c) => c.d).join("");
    let i = ds.startsWith("82") && ds.length >= 10 ? 2 : 0;
    while (i < ds.length) {
      const aligned = i === 0 || (ds.startsWith("82") && i === 2);
      if (ds[i] !== "0" && !aligned) {
        i += 1;
        continue;
      }
      let taken = false;
      for (const len of [11, 10, 9, 8]) {
        if (i + len > ds.length) continue;
        const slice = ds.slice(i, i + len);
        const start = g[i].i;
        const end = g[i + len - 1].i + 1;
        if (!isLikelyPhone(slice, source, start, end)) continue;
        const formatted = formatPhoneInput(slice);
        if (!formatted.startsWith("0")) continue;
        hits.push({ raw: slice, formatted, index: start, end });
        i += len;
        taken = true;
        break;
      }
      if (!taken) i += 1;
    }
    if (ds.length === 7 && hits.every((h) => h.index !== g[0].i)) {
      const start = g[0].i;
      const end = g[6].i + 1;
      if (isLikelyPhone(ds, source, start, end) && /^[2-9]/.test(ds)) {
        const formatted = formatPhoneInput(ds);
        if (formatted) {
          hits.push({ raw: ds, formatted, index: start, end });
        }
      }
    }
  }
  return hits;
}

const NAME_STOP = new Set([
  "원룸",
  "투룸",
  "쓰리룸",
  "4룸",
  "5룸",
  "오피스텔",
  "오피텔",
  "아파트",
  "빌라",
  "다세대",
  "다가구",
  "사무실",
  "상가",
  "토지",
  "건물",
  "전세",
  "월세",
  "매매",
  "입주",
  "보증금",
  "대출",
  "주차",
  "엘베",
  "엘리베이터",
  "팀공유",
  "메모",
  "강아지",
  "고양이",
  "디딤돌",
  "버팀목",
  "허그",
  "에어컨",
  "냉장고",
  "세탁기",
  "인덕션",
  "가능",
  "희망",
  "선호",
  "위치",
  "유무",
  "즉시",
  "매물유형",
  "남향",
  "북향",
  "동향",
  "서향",
  "역세권",
  "신축",
  "리모델링",
  "보증보험",
  "저층",
  "고층",
  "중층",
  "희망층",
]);

function isSeoulGuDongPhrase(word: string): boolean {
  const compact = word.replace(/\s+/g, "");
  if (compact.length < 4) return false;
  for (const gu of SEOUL_GUS_LONGEST) {
    if (!compact.startsWith(gu)) continue;
    const rest = compact.slice(gu.length);
    if (!rest) continue;
    for (const dong of SEOUL_DONGS_LONGEST) {
      if (rest === dong) return true;
      if (!dong.endsWith("동")) continue;
      const stem = dong.slice(0, -1);
      if (new RegExp(`^${stem}\\d+동$`).test(rest)) return true;
    }
  }
  return false;
}

function isNameCandidate(word: string): boolean {
  if (!/^[가-힣]{2,6}$/.test(word)) return false;
  if (/는$/.test(word)) return false;
  if (/없|는데|으면|좋아요/.test(word)) return false;
  if (NAME_STOP.has(word)) return false;
  if (
    [...NAME_STOP].some(
      (stop) => stop.length >= 2 && word.length > stop.length && word.startsWith(stop)
    )
  ) {
    return false;
  }
  if (/층$/.test(word)) return false;
  if (isKnownSeoulDong(word)) return false;
  if (isSeoulGuDongPhrase(word)) return false;
  if (SEOUL_GU_LIST.some((gu) => gu === word)) return false;
  if (SEOUL_GU_LIST.some((gu) => gu.replace(/구$/, "") === word)) return false;
  return true;
}

function nearestPhoneAfter(
  hits: PhoneHit[],
  from: number,
  within = 80
): PhoneHit | undefined {
  return hits.find((h) => h.index >= from && h.index - from <= within);
}

/** 대화에서 「공일공…」처럼 나온 숫자를 번호로 */
function expandSpokenPhones(text: string): string {
  const token = "(?:공|영|일|이|삼|사|오|육|칠|팔|구)";
  const re = new RegExp(
    `${token}(?:\\s*(?:다시|에|의|하이픈|빼기)?\\s*${token}){6,10}`,
    "g"
  );
  const map: Record<string, string> = {
    공: "0",
    영: "0",
    일: "1",
    이: "2",
    삼: "3",
    사: "4",
    오: "5",
    육: "6",
    칠: "7",
    팔: "8",
    구: "9",
  };
  return text.replace(re, (chunk) =>
    [...chunk.replace(/\s/g, "").replace(/다시|에|의|하이픈|빼기/g, "")]
      .map((ch) => map[ch] ?? "")
      .join("")
  );
}

const SPOKEN_MONEY_DIGIT: Record<string, string> = {
  한: "1",
  일: "1",
  이: "2",
  삼: "3",
  사: "4",
  오: "5",
  육: "6",
  륙: "6",
  칠: "7",
  팔: "8",
  구: "9",
};

const SPOKEN_MONTH_WORD: Record<string, string> = {
  일월: "1월",
  이월: "2월",
  삼월: "3월",
  사월: "4월",
  오월: "5월",
  유월: "6월",
  육월: "6월",
  칠월: "7월",
  팔월: "8월",
  구월: "9월",
  시월: "10월",
  십월: "10월",
  십일월: "11월",
  십이월: "12월",
};

const SPOKEN_MONTH_DIGIT: Record<string, string> = {
  일: "1",
  이: "2",
  삼: "3",
  사: "4",
  오: "5",
  육: "6",
  륙: "6",
  칠: "7",
  팔: "8",
  구: "9",
  십: "10",
  시: "10",
  십일: "11",
  십이: "12",
};

/** 「십오」「이십일」→ 1~31. 날짜 일수에만 쓴다 */
function hangulDayNumber(raw: string): number | null {
  const t = raw.replace(/\s+/g, "");
  if (!t) return null;
  const ones: Record<string, number> = {
    한: 1,
    일: 1,
    이: 2,
    삼: 3,
    사: 4,
    오: 5,
    육: 6,
    륙: 6,
    칠: 7,
    팔: 8,
    구: 9,
  };
  if (t === "십") return 10;
  if (t.startsWith("이십")) {
    const rest = t.slice(2);
    if (!rest) return 20;
    const n = ones[rest];
    return n != null ? 20 + n : null;
  }
  if (t.startsWith("삼십")) {
    const rest = t.slice(2);
    if (!rest) return 30;
    const n = ones[rest];
    return n != null ? 30 + n : null;
  }
  if (t.startsWith("십")) {
    const rest = t.slice(1);
    if (!rest) return 10;
    const n = ones[rest];
    return n != null ? 10 + n : null;
  }
  return ones[t] ?? null;
}

/**
 * 음성인식 「삼월 일일 사월 십오일」「삼 월 일 일」→ 「3월 1일 4월 15일」
 */
function expandSpokenDates(text: string): string {
  let s = text.replace(
    /십이월|십일월|시월|십월|일월|이월|삼월|사월|오월|유월|육월|칠월|팔월|구월/g,
    (w) => SPOKEN_MONTH_WORD[w] ?? w
  );
  s = s.replace(
    /(?<![가-힣\d])(십이|십일|시|십|일|이|삼|사|오|육|륙|칠|팔|구)\s*월/g,
    (_, w: string) => `${SPOKEN_MONTH_DIGIT[w] ?? w}월`
  );
  s = s.replace(
    /(\d{1,2}\s*월\s*)((?:이\s*십|삼\s*십|십)?\s*(?:한|일|이|삼|사|오|육|륙|칠|팔|구)?)(\s*일)(?!\d)/g,
    (full, mon: string, numPart: string) => {
      const day = hangulDayNumber(numPart);
      if (day == null || day < 1 || day > 31) return full;
      return `${mon.trimEnd()} ${day}일`;
    }
  );
  return s;
}

function dongMatchLengthAt(text: string, index: number, dong: string): number {
  const rest = text.slice(index);
  if (rest.startsWith(dong)) return dong.length;
  if (!dong.endsWith("동")) return 0;
  const stem = dong.slice(0, -1);
  const admin = rest.match(new RegExp(`^${stem}\\d+동`));
  return admin?.[0]?.length ?? 0;
}

/**
 * 강동구천호동·구로구 천왕동처럼 목록에 있는 구+동은 금액 읽기 전에 잠시 가린다.
 */
function protectSeoulGuDongPlaces(text: string): {
  text: string;
  restore: (s: string) => string;
} {
  const spans: { start: number; end: number }[] = [];
  for (const gu of SEOUL_GUS_LONGEST) {
    let from = 0;
    while (from < text.length) {
      const gStart = text.indexOf(gu, from);
      if (gStart < 0) break;
      let i = gStart + gu.length;
      while (text[i] === " " || text[i] === "\t") i += 1;
      for (const dong of SEOUL_DONGS_LONGEST) {
        const n = dongMatchLengthAt(text, i, dong);
        if (n <= 0) continue;
        const span = { start: gStart, end: i + n };
        if (!spans.some((s) => span.start < s.end && span.end > s.start)) {
          spans.push(span);
        }
        break;
      }
      from = gStart + 1;
    }
  }
  spans.sort((a, b) => b.start - a.start);
  const saved: string[] = [];
  let masked = text;
  for (const span of spans) {
    saved.push(masked.slice(span.start, span.end));
    masked = `${masked.slice(0, span.start)}\uE000${saved.length - 1}\uE001${masked.slice(span.end)}`;
  }
  return {
    text: masked,
    restore: (s) =>
      s.replace(/\uE000(\d+)\uE001/g, (_, n) => saved[Number(n)] ?? ""),
  };
}

/**
 * 음성인식 「삼억 오천」「월세 오십」「이억구천」→ 「3억 5천」「월세 50」「2억9천」
 * 구·동 주소는 protectSeoulGuDongPlaces로 가린 뒤에만 돌린다.
 */
function expandSpokenMoney(text: string): string {
  const digit = "(?:한|일|이|삼|사|오|육|륙|칠|팔|구)";
  const notDong = "(?![가-힣]{0,8}동)";
  const tens: Record<string, string> = {
    십: "10",
    일십: "10",
    이십: "20",
    삼십: "30",
    사십: "40",
    오십: "50",
    육십: "60",
    륙십: "60",
    칠십: "70",
    팔십: "80",
    구십: "90",
  };
  return text
    .replace(
      new RegExp(
        `(이십|삼십|사십|오십|육십|륙십|칠십|팔십|구십|일십|십)\\s*(억|천|백|만)${notDong}`,
        "g"
      ),
      (_, w: string, unit: string) => `${tens[w] ?? w}${unit}`
    )
    .replace(
      new RegExp(`(${digit})\\s*(억|천|백|만)${notDong}`, "g"),
      (_, w: string, unit: string) => `${SPOKEN_MONEY_DIGIT[w] ?? w}${unit}`
    )
    .replace(
      /((?:월세|보증금|보증|(?<![가-힣\d])월|(?<![가-힣])보)\s*)(이십|삼십|사십|오십|육십|륙십|칠십|팔십|구십|일십|십)(?!\s*(?:억|천|백|만))/g,
      (_, pre: string, w: string) => `${pre}${tens[w] ?? w}`
    )
    .replace(
      /([\/／]\s*)(이십|삼십|사십|오십|육십|륙십|칠십|팔십|구십|일십|십)(?!\s*(?:억|천|백|만))/g,
      (_, pre: string, w: string) => `${pre}${tens[w] ?? w}`
    );
}

/**
 * 금액 읽기 오염(강동9천호동)처럼 칸에 쓴 주소가 깨진 토큰은 내용·잔여에서 버린다.
 * 암사1동·천호2동 같은 행정동 숫자 표기는 유지한다.
 */
export function scrubCorruptIntakeText(text: string): string {
  if (!text.trim()) return "";
  return text
    .split(/\n+/)
    .map((line) => scrubCorruptIntakeLine(line))
    .filter(Boolean)
    .join("\n");
}

function scrubCorruptIntakeLine(line: string): string {
  let s = line.replace(/[가-힣]{2,12}\d+[가-힣]{0,12}동/g, (tok) => {
    if (/^[가-힣]+\d{1,2}동$/.test(tok)) {
      const base = tok.replace(/\d+동$/, "동");
      if (isKnownSeoulDong(base)) return tok;
    }
    return " ";
  });
  // 동만 빠진 뒤 남은 「강동9」「강동9천」도 버린다
  for (const gu of SEOUL_GU_LIST) {
    const stem = gu.replace(/구$/, "");
    if (stem.length < 2) continue;
    s = s.replace(
      new RegExp(`${stem}\\d+(?:천|억|백|만)?`, "g"),
      " "
    );
  }
  return s.replace(/\s+/g, " ").trim();
}

/**
 * 2억9천2백10만 → 29210(만원). 억·천·백·만 조각을 합친다.
 * 3억6500 · 3억 6500처럼 만 없이 2~4자리만 오면 만으로 본다(음성·속기).
 * 5억9처럼 한 자리는 애매해서 여기서 잡지 않는다.
 */
function parseCompoundEokMoney(text: string): {
  deposit: number;
  index: number;
  end: number;
} | null {
  const re =
    /(\d+(?:\.\d+)?)\s*억(?:\s*(\d+(?:\.\d+)?)\s*천)?(?:\s*(\d+(?:\.\d+)?)\s*백)?(?:\s*(\d+(?:\.\d+)?)\s*만)?/g;
  let best: { deposit: number; index: number; end: number } | null = null;
  const consider = (hit: { deposit: number; index: number; end: number }) => {
    if (
      !best ||
      hit.index < best.index ||
      hit.end - hit.index > best.end - best.index
    ) {
      best = hit;
    }
  };
  for (const m of text.matchAll(re)) {
    if (m.index == null) continue;
    const eok = Number(m[1]);
    if (!Number.isFinite(eok) || eok <= 0) continue;
    const cheon = m[2] != null ? Number(m[2]) : 0;
    const baek = m[3] != null ? Number(m[3]) : 0;
    const man = m[4] != null ? Number(m[4]) : 0;
    if ([cheon, baek, man].some((n) => !Number.isFinite(n) || n < 0)) continue;
    // 억만 단독(1억·2억·1억~2억)은 기존 억·구간 규칙에 맡긴다
    if (!m[2] && !m[3] && !m[4]) continue;
    const deposit = Math.round(eok * 10000 + cheon * 1000 + baek * 100 + man);
    if (deposit <= 0) continue;
    consider({ deposit, index: m.index, end: m.index + m[0].length });
  }
  // 3억6500 · 3억 6500 (만 생략). 5억9(한 자리)는 제외
  const bareManRe =
    /(\d+(?:\.\d+)?)\s*억\s*(\d{2,4})(?!\d)(?!\s*(?:억|천|백|만|년|월|일|층|호|동|룸))/g;
  for (const m of text.matchAll(bareManRe)) {
    if (m.index == null) continue;
    const eok = Number(m[1]);
    const man = Number(m[2]);
    if (!Number.isFinite(eok) || eok <= 0) continue;
    if (!Number.isFinite(man) || man < 0) continue;
    const deposit = Math.round(eok * 10000 + man);
    if (deposit <= 0) continue;
    consider({ deposit, index: m.index, end: m.index + m[0].length });
  }
  return best;
}

function findCustomerName(text: string): string | undefined {
  const trimmed = text.trim();
  if (/^[가-힣]{2,6}$/.test(trimmed) && isNameCandidate(trimmed)) {
    return trimmed;
  }

  const lead = trimmed.match(/^([가-힣]{2,6})(?:\s|$)/);
  if (lead && isNameCandidate(lead[1] ?? "")) {
    return lead[1];
  }

  for (const hit of trimmed.matchAll(/(?:^|\s)([가-힣]{2,6})(?=\s|$)/g)) {
    const word = hit[1] ?? "";
    if (isNameCandidate(word)) return word;
  }
  return undefined;
}

function labeledPhoneAfter(
  text: string,
  phones: PhoneHit[],
  pattern: RegExp,
  within = 24
): string | undefined {
  for (const m of text.matchAll(pattern)) {
    if (m.index == null) continue;
    const from = m.index + m[0].length;
    const phone = phones.find(
      (h) => h.index >= from && h.index - from <= within
    );
    if (phone) return phone.formatted;
  }
  return undefined;
}

function parseContacts(
  text: string,
  kind: IntakeKind = "property"
): {
  name?: string;
  nameLabeled?: boolean;
  phone?: string;
  tenantPhone?: string;
  landlordPhone?: string;
} {
  const phones = parsePhoneHits(text);
  const labeledName = text.match(
    /(?:고객명|명칭|이름|성함|성명)\s*[:\s]?\s*([가-힣]{2,6})/
  );
  let name =
    labeledName && isNameCandidate(labeledName[1] ?? "")
      ? labeledName[1]
      : undefined;
  let nameLabeled = Boolean(name);

  if (!name && kind === "customer") {
    const found = findCustomerName(text);
    if (found) {
      name = found;
      nameLabeled = true;
    }
  }

  if (!name && phones[0]) {
    const before = text.slice(
      Math.max(0, phones[0].index - (kind === "customer" ? 12 : 8)),
      phones[0].index
    );
    const near = before.match(/([가-힣]{2,6})\s*$/);
    if (near && isNameCandidate(near[1] ?? "")) {
      name = near[1];
      if (kind === "customer") nameLabeled = true;
    }
  }

  const tenantPhone =
    labeledPhoneAfter(
      text,
      phones,
      /세입자|(?<![현전])임차인|(?<![가-힣])세(?![가-힣])/g
    ) ?? undefined;
  const landlordPhone =
    labeledPhoneAfter(
      text,
      phones,
      /임대인|(?<![가-힣])임(?![가-힣])|주인|(?<![가-힣])주(?![가-힣소거상담민상])/g
    ) ?? undefined;
  const phoneLabelIdx = text.search(/전화번호|연락처/);

  const used = new Set(
    [tenantPhone, landlordPhone].filter(Boolean) as string[]
  );
  const leftover = phones.find((h) => !used.has(h.formatted));
  const labeled =
    phoneLabelIdx >= 0
      ? nearestPhoneAfter(phones, phoneLabelIdx)?.formatted
      : undefined;
  const mobile = phones.find((h) => {
    if (used.has(h.formatted)) return false;
    return /^01/.test(toKrPhoneDigits(h.formatted));
  });

  return {
    name,
    nameLabeled,
    phone:
      labeled ??
      mobile?.formatted ??
      leftover?.formatted ??
      phones[0]?.formatted,
    tenantPhone,
    landlordPhone,
  };
}

function stripContactNoise(text: string, name?: string): string {
  let next = text;
  const hits = [...parsePhoneHits(text)].sort((a, b) => b.index - a.index);
  for (const hit of hits) {
    next = `${next.slice(0, hit.index)} ${next.slice(hit.end)}`;
  }
  if (name) next = next.replaceAll(name, " ");
  return next.replace(/\s+/g, " ").trim();
}

function applyDateCorrectionSlice(text: string): string {
  const re = /(?:^|\s)(?:아니(?:야|요|인데)?|틀렸(?:어|어요|습니다)?)\s+/g;
  let sliceFrom = -1;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    sliceFrom = m.index + m[0].length;
  }
  return sliceFrom >= 0 ? text.slice(sliceFrom).trim() : text;
}

const MDAY_RE =
  /(?:(\d{4})\s*년\s*)?(\d{1,2})\s*월\s*(\d{1,2})(?:\s*일(?!\d)|(?!\d))/g;

function dateHitToIso(
  hit: RegExpMatchArray,
  today: Date,
  after?: string
): string | null {
  const year = hit[1] ? Number(hit[1]) : undefined;
  const month = Number(hit[2]);
  const day = Number(hit[3]);
  if (year) {
    const iso = isoFromYearMonthDay(year, month, day);
    return iso ? isoNotBeforeToday(iso, today) : null;
  }
  if (after) return isoFollowingMonthDay(after, month, day);
  return isoFromMonthDay(month, day, today);
}

function parseDateToken(
  chunk: string,
  today: Date,
  after?: string
): string | null {
  const ymd = chunk.match(
    /(?:(\d{4})\s*년\s*)?(\d{1,2})\s*월\s*(\d{1,2})(?:\s*일(?!\d)|(?!\d))/
  );
  if (ymd) return dateHitToIso(ymd, today, after);
  const shortYear = parseShortYearDateToken(chunk, today);
  if (shortYear) return shortYear;
  const yslash = chunk.match(
    new RegExp(
      `(\\d{4})\\s*[${PAIR_SEP_CLS}]\\s*(\\d{1,2})\\s*[${PAIR_SEP_CLS}]\\s*(\\d{1,2})`
    )
  );
  if (
    yslash &&
    isYearMonthDayTriple(Number(yslash[1]), Number(yslash[2]), Number(yslash[3]))
  ) {
    const iso = isoFromYearMonthDay(
      Number(yslash[1]),
      Number(yslash[2]),
      Number(yslash[3])
    );
    return iso ? isoNotBeforeToday(iso, today) : null;
  }
  const slash = chunk.match(
    new RegExp(`(\\d{1,2})\\s*[${PAIR_SEP_CLS}]\\s*(\\d{1,2})`)
  );
  if (slash && isMonthDaySlash(Number(slash[1]), Number(slash[2]))) {
    const month = Number(slash[1]);
    const day = Number(slash[2]);
    if (after) return isoFollowingMonthDay(after, month, day);
    return isoFromMonthDay(month, day, today);
  }
  return null;
}

function parseLinkedDateRange(
  text: string,
  today: Date
): { from: string; to: string } | null {
  const chunk = [
    `(?:\\d{4}\\s*년\\s*)?\\d{1,2}\\s*월\\s*\\d{1,2}(?:\\s*일(?!\\d)|(?!\\d))`,
    `\\d{4}\\s*[${PAIR_SEP_CLS}]\\s*\\d{1,2}\\s*[${PAIR_SEP_CLS}]\\s*\\d{1,2}`,
    `\\d{2}\\s*[${PAIR_SEP_CLS}.]\\s*\\d{1,2}\\s*[${PAIR_SEP_CLS}.]\\s*\\d{1,2}`,
    `\\d{1,2}\\s*[${PAIR_SEP_CLS}]\\s*\\d{1,2}`,
  ].join("|");
  const re = new RegExp(`(${chunk})\\s*${DATE_RANGE_LINK}\\s*(${chunk})`);
  const m = text.match(re);
  if (!m?.[1] || !m[2]) return null;
  const from = parseDateToken(m[1], today);
  if (!from) return null;
  const to = parseDateToken(m[2], today, from);
  if (!to) return null;
  return { from, to };
}

function asFutureMoveIn(
  from: string | null | undefined,
  to: string | null | undefined,
  today: Date
): { from: string; to: string } | null {
  if (!from) return null;
  return clampMoveInToToday(from, to || from, today);
}

function parseMoveInDates(
  text: string,
  today: Date
): { from?: string; to?: string; immediate?: boolean } {
  const corrected = applyDateCorrectionSlice(text);
  if (
    /즉시\s*입주|바로\s*입주|즉시입주|바로입주|실\s*입주(?:\s*가능)?|실입주(?:\s*가능)?|즉시/.test(
      corrected
    )
  ) {
    return { immediate: true };
  }
  const linked = parseLinkedDateRange(corrected, today);
  if (linked) {
    const clamped = asFutureMoveIn(linked.from, linked.to, today);
    if (clamped) return clamped;
  }
  const shortDate = findShortYearDateSpan(corrected, today);
  if (shortDate) {
    const clamped = asFutureMoveIn(shortDate.from, shortDate.from, today);
    if (clamped) return clamped;
  }
  const hits = [...corrected.matchAll(MDAY_RE)];
  if (hits.length >= 2 && hits[0] && hits[1]) {
    const from = dateHitToIso(hits[0], today);
    const to = from ? dateHitToIso(hits[1], today, from) : null;
    if (from && to) {
      const clamped = asFutureMoveIn(from, to, today);
      if (clamped) return clamped;
    }
  }
  if (hits.length === 1 && hits[0]) {
    const iso = dateHitToIso(hits[0], today);
    const clamped = asFutureMoveIn(iso, iso, today);
    if (clamped) return clamped;
  }
  const ymds = parseSlashTriples(corrected)
    .filter((t) => isYearMonthDayTriple(t.a, t.b, t.c))
    .map((t) => {
      const iso = isoFromYearMonthDay(t.a, t.b, t.c);
      return iso ? isoNotBeforeToday(iso, today) : null;
    })
    .filter((iso): iso is string => Boolean(iso));
  if (ymds.length >= 2 && ymds[0] && ymds[1]) {
    const clamped = asFutureMoveIn(ymds[0], ymds[1], today);
    if (clamped) return clamped;
  }
  if (ymds.length === 1 && ymds[0]) {
    const clamped = asFutureMoveIn(ymds[0], ymds[0], today);
    if (clamped) return clamped;
  }
  const monthDays = collectMonthDayDatePairs(corrected);
  if (monthDays.length >= 2 && monthDays[0] && monthDays[1]) {
    const from = isoFromMonthDay(
      monthDays[0].month,
      monthDays[0].day,
      today
    );
    const to = from
      ? isoFollowingMonthDay(
          from,
          monthDays[1].month,
          monthDays[1].day
        )
      : null;
    if (from && to) {
      const clamped = asFutureMoveIn(from, to, today);
      if (clamped) return clamped;
    }
  }
  if (monthDays.length === 1 && monthDays[0]) {
    const iso = isoFromMonthDay(
      monthDays[0].month,
      monthDays[0].day,
      today
    );
    const clamped = asFutureMoveIn(iso, iso, today);
    if (clamped) return clamped;
  }
  return {};
}

export type IntakeNormalizeMode = "text" | "spoken";

/** 구·동은 가리고, 이억·구천·삼월 등 음성 읽기만 숫자로 바꾼다. 메시지·사진·마이크 공통. */
export function normalizeIntakeInput(
  raw: string,
  _mode: IntakeNormalizeMode = "text"
): string {
  const base = normalizeFieldShorthands(
    raw
      .replace(/[\u200B-\u200D\uFEFF\u00AD]/g, "")
      .replace(/[０-９]/g, (ch) =>
        String.fromCharCode(ch.charCodeAt(0) - 0xff10 + 0x30)
      )
      .replace(/[\u2212\u2013\u2014\u2010\u2011]/g, "-")
      .replace(/\s+/g, " ")
      .trim()
  );
  const protectedPlaces = protectSeoulGuDongPlaces(base);
  return collapseThousandCommas(
    protectedPlaces.restore(
      expandSpokenMoney(
        expandSpokenDates(expandSpokenPhones(protectedPlaces.text))
      )
    )
  );
}

export function parseIntakeText(
  raw: string,
  kind: IntakeKind,
  today: Date = new Date(),
  mode: IntakeNormalizeMode = "text"
): IntakeParseResult {
  const text = normalizeIntakeInput(raw, mode);
  const result: IntakeParseResult = { options: [], notes: "" };
  if (!text) return result;

  const { body, labeledMemo } = splitLabeledMemo(text);
  if (!body) {
    result.notes = labeledMemo;
    return result;
  }

  const { dealType: firstDeal, fieldText, moneyText, leftoverDeal } =
    firstDealFieldText(body);
  const room = parseRoomSpec(fieldText);
  if (room.roomType) result.roomType = room.roomType;
  if (room.roomCount) result.roomCount = room.roomCount;
  if (room.bathroomCount) result.bathroomCount = room.bathroomCount;

  if (firstDeal) result.dealType = firstDeal;
  if (!result.dealType) {
    if (
      /(?<![가-힣물])매(?:가)?\s*\d/.test(moneyText) ||
      /매가/.test(moneyText)
    ) {
      result.dealType = "매매";
    } else if (
      /전세가/.test(moneyText) ||
      /(?<![가-힣])전\s*\d+(?:\.\d+)?\s*억/.test(moneyText)
    ) {
      result.dealType = "전세";
    }
  }

  const phoneSpans = parsePhoneHits(moneyText).map((hit) => ({
    start: hit.index,
    end: hit.end,
  }));
  const asSale =
    result.dealType === "매매" ||
    result.roomType === "토지" ||
    result.roomType === "건물" ||
    (result.dealType === undefined && /매가/.test(fieldText));
  const allowTripleEok =
    result.roomType === "토지" || result.roomType === "건물";
  const money = parseMoneyManwon(maskUsedSpans(moneyText, phoneSpans), {
    asSale,
    allowTripleEok,
    maxBareEok: maxBareSaleEok(result.roomType),
  });
  result.deposit = money.deposit;
  if (money.depositTo && money.depositTo !== money.deposit) {
    result.depositTo = money.depositTo;
  }
  if (
    money.monthlyRent &&
    (result.dealType === "월세" || result.dealType === undefined)
  ) {
    result.monthlyRent = money.monthlyRent;
    if (money.monthlyRentTo && money.monthlyRentTo !== money.monthlyRent) {
      result.monthlyRentTo = money.monthlyRentTo;
    }
    if (!result.dealType) result.dealType = "월세";
  }
  if (kind === "property") {
    if (money.maintenanceFee) {
      result.maintenanceFee = money.maintenanceFee;
    } else if (money.twoPartSlash) {
      result.maintenanceFee = 0;
    }
  }

  const leftoverText = maskUsedSpans(fieldText, money.usedSpans);
  const contacts = parseContacts(leftoverText, kind);
  result.name = contacts.name;
  if (contacts.nameLabeled) result.nameLabeled = true;
  result.phone = contacts.phone;
  result.tenantPhone = contacts.tenantPhone;
  result.landlordPhone = contacts.landlordPhone;
  if (
    kind === "property" &&
    !result.tenantPhone &&
    !result.landlordPhone &&
    result.phone
  ) {
    result.tenantPhone = result.phone;
  }

  const locText = stripContactNoise(leftoverText, contacts.name);
  const loc = parseLocation(locText, fieldText);
  result.gu = loc.gu;
  result.dong = loc.dong;
  result.jibun = loc.jibun;
  result.places = findAllDongsInText(locText)
    .filter((p): p is { dong: string; gu: string; start: number; end: number } =>
      Boolean(p.gu)
    )
    .map((p) => ({ gu: p.gu, dong: p.dong }));
  result.roomNo = parseRoomNo(fieldText);

  const moveIn = parseMoveInDates(leftoverText, today);
  if (moveIn.from) {
    result.moveInFrom = moveIn.from;
    result.moveInTo = moveIn.to ?? moveIn.from;
  } else if (moveIn.immediate) {
    result.moveInImmediate = true;
  }

  const allFlags = parseAllYesNoFields(fieldText);
  result.loan = allFlags.loan;
  result.insurance = allFlags.insurance;
  result.parking = allFlags.parking;
  result.elevator = allFlags.elevator;
  result.workspaceShared = parseYesNo(fieldText, ["팀공유", "팀 공유"]);

  if (LOAN_KIND.test(fieldText)) {
    result.loan = "유";
  }

  const options: string[] = [];
  for (const opt of PROPERTY_OPTIONS) {
    if (fieldText.includes(opt)) options.push(opt);
  }
  result.options = options;

  result.notes = buildIntakeMemoNotes(body, labeledMemo);
  const buildingName = parseBuildingName(fieldText);
  if (buildingName) {
    result.buildingName = buildingName;
    result.notes = appendMemoPart(result.notes, buildingName);
  }
  if (leftoverDeal) {
    result.notes = appendMemoPart(result.notes, leftoverDeal);
  }
  const extraTypes = roomAliasHits(fieldText)
    .filter((hit) => {
      if (hit.value === result.roomType) return false;
      if (
        result.roomType === "오피스텔" &&
        (hit.value === "원룸" || hit.value === "투룸" || hit.value === "3룸+")
      ) {
        return false;
      }
      return true;
    })
    .map((hit) => hit.key);
  if (extraTypes.length) {
    result.notes = appendMemoPart(result.notes, uniqueNoteParts(extraTypes));
  }
  const usedPhones = new Set(
    [result.phone, result.tenantPhone, result.landlordPhone].filter(Boolean)
  );
  for (const hit of parsePhoneHits(fieldText)) {
    if (!usedPhones.has(hit.formatted)) {
      result.notes = appendMemoPart(result.notes, hit.formatted);
    }
  }
  if (!result.moveInFrom && !result.moveInImmediate) {
    result.notes = appendMemoPart(
      result.notes,
      uniqueNoteParts(extractAmbiguousDotNotes(body))
    );
  }

  result.notes = scrubCorruptIntakeText(result.notes);
  return result;
}

export function intakePreferredLocation(parsed: IntakeParseResult): {
  preferredGus: string[];
  preferredDongs: string[];
} {
  let places = (parsed.places ?? []).filter((p) => p.gu && p.dong);
  if (places.length === 0 && parsed.dong) {
    const gu = parsed.gu || resolveGuFromDong(parsed.dong) || "";
    if (gu) places = [{ gu, dong: parsed.dong }];
  }
  if (places.length === 0) {
    return {
      preferredGus: parsed.gu ? [parsed.gu] : [],
      preferredDongs: [],
    };
  }
  return {
    preferredGus: [...new Set(places.map((p) => p.gu))],
    preferredDongs: places.map((p) => encodePreferredDong(p.gu, p.dong)),
  };
}

export function intakeMoveInPeriod(parsed: IntakeParseResult): {
  from: string;
  to: string;
  single: boolean;
} | null {
  if (parsed.moveInFrom) {
    const to = parsed.moveInTo || parsed.moveInFrom;
    return {
      from: parsed.moveInFrom,
      to,
      single: parsed.moveInFrom === to,
    };
  }
  if (parsed.moveInImmediate) {
    const day = todayISO();
    return { from: day, to: day, single: true };
  }
  return null;
}

export function intakeMoveInDate(parsed: IntakeParseResult): string {
  return intakeMoveInPeriod(parsed)?.from ?? "";
}

export function applyIntakeToProperty(
  current: Property,
  parsed: IntakeParseResult
): Property {
  const next: Property = { ...current };
  if (parsed.roomType) {
    next.roomType = parsed.roomType;
    if (needsRoomBathCounts(parsed.roomType)) {
      const defaults = defaultRoomBathCounts(parsed.roomType);
      next.roomCount = parsed.roomCount ?? defaults.roomCount;
      next.bathroomCount = parsed.bathroomCount ?? defaults.bathroomCount;
    }
  }
  if (parsed.dealType) next.dealType = parsed.dealType;
  if (parsed.deposit && parsed.deposit > 0) next.deposit = parsed.deposit;
  if (parsed.monthlyRent && parsed.monthlyRent > 0) {
    next.monthlyRent = parsed.monthlyRent;
    if (!parsed.dealType) next.dealType = "월세";
  }
  if (parsed.maintenanceFee != null) {
    next.maintenanceFee = parsed.maintenanceFee;
  }
  if (parsed.gu || parsed.dong || parsed.jibun) {
    const gu =
      parsed.gu ||
      (parsed.dong ? resolveGuFromDong(parsed.dong) : undefined) ||
      "";
    next.address = composeSeoulAddress(
      gu,
      parsed.dong ?? "",
      parsed.jibun ?? ""
    );
  }
  if (parsed.roomNo) next.roomNo = parsed.roomNo;
  if (parsed.buildingName) next.buildingName = parsed.buildingName;
  const move = intakeMoveInPeriod(parsed);
  if (move) {
    next.moveInFrom = move.from;
    next.moveInTo = move.to;
    next.moveInSingle = move.single;
    next.moveInDate = formatMoveInRange(move.from, move.to);
  }
  if (parsed.loan) next.loanAvailable = parsed.loan as ParkingType;
  if (parsed.insurance) next.insuranceType = parsed.insurance;
  if (parsed.parking) next.parkingType = parsed.parking as ParkingType;
  if (parsed.elevator) next.elevator = parsed.elevator === "유";
  if (next.hasPartnerAgency) {
    if (parsed.phone && !next.partnerAgency?.phone) {
      next.partnerAgency = {
        ...next.partnerAgency,
        phone: parsed.phone,
      };
    }
  } else {
    if (parsed.tenantPhone) next.tenantPhone = parsed.tenantPhone;
    if (parsed.landlordPhone) next.landlordPhone = parsed.landlordPhone;
  }
  if (parsed.workspaceShared) next.workspaceShared = parsed.workspaceShared === "유";
  if (parsed.options.length > 0) {
    const set = new Set([...(next.options ?? []), ...parsed.options]);
    next.options = [...set];
  }
  if (parsed.notes) {
    let notes = parsed.notes;
    if (parsed.buildingName) {
      notes = notes
        .split(/\n/)
        .map((line) => line.trim())
        .filter((line) => line && line !== parsed.buildingName)
        .join("\n");
    }
    if (notes) {
      const prev = (next.notes ?? "").trim();
      next.notes = prev ? `${prev}\n${notes}` : notes;
    }
  }
  return next;
}
