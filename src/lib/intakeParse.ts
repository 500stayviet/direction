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
  SEOUL_GU_LIST,
} from "@/lib/seoulRegions";
import type { DealType, ParkingType, Property, RoomType } from "@/lib/types";

export type IntakeKind = "customer" | "property";
export type YesNo = "유" | "무";

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
};

const ROOM_ALIASES: { keys: string[]; value: RoomType }[] = [
  { keys: ["3룸+", "쓰리룸+", "쓰리룸", "3룸", "쓰리 룸"], value: "3룸+" },
  { keys: ["오피스텔", "아파트"], value: "아파트" },
  { keys: ["투룸", "투 룸", "2룸"], value: "투룸" },
  { keys: ["원룸", "원 룸", "1룸"], value: "원룸" },
  { keys: ["사무실", "오피스"], value: "사무실" },
  { keys: ["상가"], value: "상가" },
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
  const typeHit = lastIndex(
    text,
    ROOM_ALIASES.flatMap((a) => a.keys)
  );
  const roomType = typeHit
    ? ROOM_ALIASES.find((a) => a.keys.includes(typeHit.key))?.value
    : undefined;
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

  if (roomType === "아파트" && lastCount) {
    return { roomType: "아파트", roomCount: lastCount.n, bathroomCount };
  }
  if (lastCount && (!roomType || lastCount.start >= typeIndex)) {
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
const LOAN_KIND = /디딤돌|버팀목|중금|보금자리|특례|전세대출|주택담보/;

const MEMO_WEAK_TOKENS = new Set([
  "유",
  "무",
  "있음",
  "없어요",
  "없고",
  "있고",
  "있어요",
  "있습니다",
  "가능",
  "불가",
  "없",
  "없음",
  "부터",
  "까지",
  "입주",
  "키워요",
  "키움",
  "개",
  "및",
  "또",
  "또는",
  "등",
  "좀",
  "요",
  "희망",
  "선호",
]);

const INTAKE_FIELD_LABELS = [
  ...ROOM_ALIASES.flatMap((row) => row.keys),
  ...ROOM_COUNT_WORDS.flatMap((row) => row.keys),
  ...DEAL_TYPES,
  ...PROPERTY_OPTIONS,
  "3룸+",
  "보증금",
  "관리비",
  "매가",
  "보증",
  "대출",
  "주차",
  "입주",
  "엘리베이터",
  "엘베",
  "E/V",
  "EV",
  "보증보험",
  "전세보증보험",
  "보증 보험",
  "팀공유",
  "팀 공유",
  "임차인",
  "임대인",
  "전화번호",
  "연락처",
  "고객명",
  "명칭",
  "이름",
  "성함",
  "성명",
  "바로입주",
  "즉시입주",
  "바로 입주",
  "즉시 입주",
  "즉시",
  "화장실",
  "메모",
];

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

/** 전세대출 안의 전세는 거래종류가 아님 */
function dealTypeHits(text: string): { key: DealType; index: number }[] {
  const hits: { key: DealType; index: number }[] = [];
  for (const key of DEAL_TYPES) {
    let from = 0;
    while (from < text.length) {
      const index = text.indexOf(key, from);
      if (index < 0) break;
      if (!(key === "전세" && text.slice(index).startsWith("전세대출"))) {
        hits.push({ key, index });
      }
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

/** 처음 나온 거래종류만 쓰고, 뒤에 또 나온 매매·전세·월세부터는 칸에서 뺌 */
function firstDealFieldText(text: string): {
  dealType?: DealType;
  fieldText: string;
  laterText: string;
  laterDeal?: DealType;
} {
  const hits = dealTypeHits(text);
  const first = hits[0];
  if (!first) return { fieldText: text, laterText: "" };
  const second = hits[1];
  if (!second) return { dealType: first.key, fieldText: text, laterText: "" };
  return {
    dealType: first.key,
    fieldText: maskUsedSpans(text, [{ start: second.index, end: text.length }]),
    laterText: text.slice(second.index).trim(),
    laterDeal: second.key,
  };
}

function splitLabeledMemo(text: string): { body: string; labeledMemo: string } {
  const m = text.match(/메모\s*[.:：。]/);
  if (!m || m.index == null) return { body: text, labeledMemo: "" };
  return {
    body: text.slice(0, m.index).replace(/\s+/g, " ").trim(),
    labeledMemo: text.slice(m.index + m[0].length).replace(/\s+/g, " ").trim(),
  };
}

function compactOccupancyNote(raw: string, extraWords: string[]): string {
  let next = raw.replace(/\s+/g, " ").trim();
  const words = [...extraWords].sort((a, b) => b.length - a.length);
  for (const word of words) {
    if (!word) continue;
    next = next.split(word).join(" ");
  }
  return next.replace(/\s+/g, " ").trim();
}

function parseYesNo(text: string, labels: string[]): YesNo | undefined {
  let found: { index: number; value: YesNo } | null = null;
  for (const label of labels) {
    const re = new RegExp(
      `${label}\\s*(있음|있어요|있고|있습니다|가능|유|없(?:음|어요)?|불가|무)`,
      "g"
    );
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const token = m[1] ?? "";
      const value: YesNo = /없|불가|무/.test(token) ? "무" : "유";
      const index = m.index;
      if (!found || index >= found.index) found = { index, value };
    }
  }
  return found?.value;
}

const PAIR_SEP_CLS = "\\/／.,．，";

/** 달력: 월 1–12, 일 1–31. 이 밖이면 보증금/월세 */
function isMonthDaySlash(left: number, right: number): boolean {
  return left >= 1 && left <= 12 && right >= 1 && right <= 31;
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
const UNLIMITED_BARE_SALE_EOK: RoomType[] = ["아파트", "3룸+", "건물", "토지"];
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
      `(?<![년월일${PAIR_SEP_CLS}\\d])(\\d{1,5}(?:\\.\\d+)?)\\s*[${TILDE_CLS}]\\s*(\\d{1,5}(?:\\.\\d+)?)(?!\\s*[년월일${PAIR_SEP_CLS}억만])`
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
): { left: number; right: number; index: number; end: number }[] {
  const pairs: { left: number; right: number; index: number; end: number }[] =
    [];
  const re = new RegExp(
    `(?<![${PAIR_SEP_CLS}\\d])(\\d{1,5})\\s*[${PAIR_SEP_CLS}]\\s*(\\d{1,5})(?!\\s*[${PAIR_SEP_CLS}])(?!\\s*(?:억|만|원))`,
    "g"
  );
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    pairs.push({
      left: Number(m[1]),
      right: Number(m[2]),
      index: m.index,
      end: m.index + m[0].length,
    });
  }
  return pairs;
}

function maskSlashDates(text: string): string {
  const yearRe = new RegExp(
    `(?<![${PAIR_SEP_CLS}\\d])(\\d{4})\\s*[${PAIR_SEP_CLS}]\\s*(\\d{1,2})\\s*[${PAIR_SEP_CLS}]\\s*(\\d{1,2})(?!\\s*[${PAIR_SEP_CLS}])(?!\\s*(?:억|만|원))`,
    "g"
  );
  const pairRe = new RegExp(
    `(?<![${PAIR_SEP_CLS}\\d])(\\d{1,2})\\s*[${PAIR_SEP_CLS}]\\s*(\\d{1,2})(?!\\s*[${PAIR_SEP_CLS}])(?!\\s*(?:억|만|원))`,
    "g"
  );
  return text
    .replace(yearRe, (full, year, month, day) =>
      isYearMonthDayTriple(Number(year), Number(month), Number(day))
        ? " ".repeat(full.length)
        : full
    )
    .replace(pairRe, (full, left, right) =>
      isMonthDaySlash(Number(left), Number(right)) ? " ".repeat(full.length) : full
    );
}

/** 5억9처럼 억 뒤에 단위 없는 숫자는 애매해서 그 억은 쓰지 않음 */
function isIncompleteEokTail(text: string, afterEok: number): boolean {
  const rest = text.slice(afterEok);
  return /^\s*\d+(?:\.\d+)?(?!\s*(?:억|천|만|년|월|일|층|호|동|룸))/.test(rest);
}

/** 1억 2억·1억~2억만 구간. 1억 암사동 2억처럼 가운데 글이 있으면 뒤 억은 버림 */
function isAdjacentEokGap(text: string, from: number, to: number): boolean {
  return new RegExp(`^[\\s${TILDE_CLS}]*$`).test(text.slice(from, to));
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
  const monthly =
    moneyText.match(/월세\s*(\d+(?:\.\d+)?)\s*만/) ||
    moneyText.match(/(?<!\d)월\s*(\d+(?:\.\d+)?)\s*만/) ||
    moneyText.match(/월세\s*(\d+(?:\.\d+)?)/) ||
    moneyText.match(/(?<!\d)월\s*(\d{1,4})(?!\d)(?!\s*(?:억|일))/);
  if (monthly && !asSale && monthly.index != null) {
    monthlyRent = Math.round(Number(monthly[1]));
    pushSpan(monthly.index, monthly.index + monthly[0].length);
  }

  let deposit: number | undefined;
  let depositTo: number | undefined;
  let monthlyRentTo: number | undefined;
  const tildeMoney = parseTildeMoneyRange(
    moneyText,
    asSale,
    allowTripleEok,
    maxBareEok
  );
  const eokCheon = moneyText.match(
    /(\d+(?:\.\d+)?)\s*억\s*(\d+(?:\.\d+)?)\s*천/
  );
  const eokMan = moneyText.match(/(\d+(?:\.\d+)?)\s*억\s*(\d+(?:\.\d+)?)\s*만/);
  const eok = [...moneyText.matchAll(/(\d+(?:\.\d+)?)\s*억/g)];
  const man = moneyText.match(
    new RegExp(
      `(?:보증금|매가|매매|전세)\\s*(\\d+(?:\\.\\d+)?)\\s*만?(?!\\s*[${TILDE_CLS}억천])|보증\\s*(\\d+(?:\\.\\d+)?)(?!\\s*[${TILDE_CLS}억천])|(\\d+(?:\\.\\d+)?)\\s*만(?!\\s*원)`
    )
  );

  if (tildeMoney?.monthly) {
    monthlyRent = tildeMoney.from;
    monthlyRentTo = tildeMoney.to;
    pushSpan(tildeMoney.start, tildeMoney.end);
  }

  if (eokCheon && eokCheon.index != null) {
    deposit = Math.round(
      Number(eokCheon[1]) * 10000 + Number(eokCheon[2]) * 1000
    );
    pushSpan(eokCheon.index, eokCheon.index + eokCheon[0].length);
  } else if (eokMan && eokMan.index != null) {
    deposit = Math.round(Number(eokMan[1]) * 10000 + Number(eokMan[2]));
    pushSpan(eokMan.index, eokMan.index + eokMan[0].length);
  } else if (tildeMoney && !tildeMoney.monthly) {
    deposit = tildeMoney.from;
    depositTo = tildeMoney.to;
    pushSpan(tildeMoney.start, tildeMoney.end);
  } else if (eok.length > 0) {
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

  let maintenanceFee: number | undefined;
  const feeLabel = moneyText.match(/관리비\s*(\d+(?:\.\d+)?)/);
  if (feeLabel && feeLabel.index != null) {
    const n = Math.round(Number(feeLabel[1]));
    if (isMaintenanceFee(n)) {
      maintenanceFee = n;
      pushSpan(feeLabel.index, feeLabel.index + feeLabel[0].length);
    }
  }

  let twoPartSlash = false;
  if (!asSale) {
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
  const pair = after.match(
    new RegExp(
      `^\\s*(\\d{1,5})\\s*[-−${TILDE_CLS}]\\s*(\\d{1,5})(?!\\d)`
    )
  );
  if (pair?.[1] && !pair[1].startsWith("0")) {
    return `${pair[1]}-${pair[2]}`;
  }
  const bunji = after.match(/^\s*(\d{1,5})\s*번지/);
  if (bunji?.[1] && !bunji[1].startsWith("0")) return bunji[1];
  const main = after.match(
    new RegExp(
      `^\\s*(\\d{1,5})(?!\\d)(?!\\s*(?:년|월|일|억|만|원(?!룸)|천|층|호|동|룸|번|[${PAIR_SEP_CLS}]))`
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
  const dongHo = text.match(/(\d+)\s*동\s*(\d+)\s*호/);
  if (dongHo) return `${dongHo[1]}동 ${dongHo[2]}호`;
  const floorHo = text.match(/(\d+)\s*층\s*(\d+)\s*호/);
  if (floorHo) return `${floorHo[1]}층 ${floorHo[2]}호`;
  const ho = text.match(/(\d{2,4})\s*호/);
  if (ho) return `${ho[1]}호`;
  const floor = text.match(/(\d+)\s*층/);
  if (floor && floor.index != null) {
    const before = text.slice(Math.max(0, floor.index - 6), floor.index);
    if (/희망층?\s*$/.test(before)) return undefined;
    return `${floor[1]}층`;
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
  if (/^[일월년]/.test(after)) return false;
  const before = text.slice(Math.max(0, index - 2), index);
  if (/[월년]\s*$/.test(before)) return false;
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
  "아파트",
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
]);

function isNameCandidate(word: string): boolean {
  if (!/^[가-힣]{2,6}$/.test(word)) return false;
  if (NAME_STOP.has(word)) return false;
  if (isKnownSeoulDong(word)) return false;
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

function parseContacts(text: string): {
  name?: string;
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

  if (!name && phones[0]) {
    const before = text.slice(Math.max(0, phones[0].index - 8), phones[0].index);
    const near = before.match(/([가-힣]{2,4})\s*$/);
    if (near && isNameCandidate(near[1] ?? "")) name = near[1];
  }

  const tenantIdx = text.search(/임차인/);
  const landlordIdx = text.search(/임대인/);
  const phoneLabelIdx = text.search(/전화번호|연락처/);
  const tenantPhone =
    tenantIdx >= 0
      ? nearestPhoneAfter(phones, tenantIdx)?.formatted
      : undefined;
  const landlordPhone =
    landlordIdx >= 0
      ? nearestPhoneAfter(phones, landlordIdx)?.formatted
      : undefined;

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
    /(?:(\d{4})\s*년\s*)?(\d{1,2})\s*월\s*(\d{1,2})\s*일/
  );
  if (ymd) return dateHitToIso(ymd, today, after);
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

function parseTildeDateRange(
  text: string,
  today: Date
): { from: string; to: string } | null {
  const re = new RegExp(
    `((?:\\d{4}\\s*년\\s*)?\\d{1,2}\\s*월\\s*\\d{1,2}\\s*일|\\d{4}\\s*[${PAIR_SEP_CLS}]\\s*\\d{1,2}\\s*[${PAIR_SEP_CLS}]\\s*\\d{1,2}|\\d{1,2}\\s*[${PAIR_SEP_CLS}]\\s*\\d{1,2})\\s*[${TILDE_CLS}]\\s*((?:\\d{4}\\s*년\\s*)?\\d{1,2}\\s*월\\s*\\d{1,2}\\s*일|\\d{4}\\s*[${PAIR_SEP_CLS}]\\s*\\d{1,2}\\s*[${PAIR_SEP_CLS}]\\s*\\d{1,2}|\\d{1,2}\\s*[${PAIR_SEP_CLS}]\\s*\\d{1,2})`
  );
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
  const tilde = parseTildeDateRange(text, today);
  if (tilde) {
    const clamped = asFutureMoveIn(tilde.from, tilde.to, today);
    if (clamped) return clamped;
  }
  const hits = [
    ...text.matchAll(/(?:(\d{4})\s*년\s*)?(\d{1,2})\s*월\s*(\d{1,2})\s*일/g),
  ];
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
  const ymds = parseSlashTriples(text)
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
  const slashDates = parseSlashPairs(text).filter((p) =>
    isMonthDaySlash(p.left, p.right)
  );
  if (slashDates.length >= 2 && slashDates[0] && slashDates[1]) {
    const from = isoFromMonthDay(
      slashDates[0].left,
      slashDates[0].right,
      today
    );
    const to = from
      ? isoFollowingMonthDay(
          from,
          slashDates[1].left,
          slashDates[1].right
        )
      : null;
    if (from && to) {
      const clamped = asFutureMoveIn(from, to, today);
      if (clamped) return clamped;
    }
  }
  if (slashDates.length === 1 && slashDates[0]) {
    const iso = isoFromMonthDay(
      slashDates[0].left,
      slashDates[0].right,
      today
    );
    const clamped = asFutureMoveIn(iso, iso, today);
    if (clamped) return clamped;
  }
  if (/즉시\s*입주|바로\s*입주|즉시입주|바로입주|즉시/.test(text)) {
    return { immediate: true };
  }
  return {};
}

function collectRegexSpans(
  text: string,
  patterns: RegExp[]
): { start: number; end: number }[] {
  const spans: { start: number; end: number }[] = [];
  for (const pattern of patterns) {
    const re = new RegExp(
      pattern.source,
      pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`
    );
    for (const m of text.matchAll(re)) {
      if (m.index == null) continue;
      spans.push({ start: m.index, end: m.index + m[0].length });
    }
  }
  return spans;
}

function pushWordSpans(
  text: string,
  words: string[],
  spans: { start: number; end: number }[]
) {
  for (const word of words) {
    if (!word) continue;
    let from = 0;
    while (from < text.length) {
      const index = text.indexOf(word, from);
      if (index < 0) break;
      spans.push({ start: index, end: index + word.length });
      from = index + Math.max(1, word.length);
    }
  }
}

/** 칸에 넣은 값·걸러낸 숫자 조각은 빼고, 남은 설명만 메모로 */
function leftoverMemoText(text: string, extraWords: string[]): string {
  const spans: { start: number; end: number }[] = [];
  for (const hit of parsePhoneHits(text)) {
    spans.push({ start: hit.index, end: hit.end });
  }
  for (const place of findAllDongsInText(text)) {
    spans.push({ start: place.start, end: place.end });
  }
  pushWordSpans(text, [...SEOUL_GU_LIST, ...extraWords], spans);
  spans.push(
    ...collectRegexSpans(text, [
      /\d+(?:\.\d+)?\s*억\s*\d+(?:\.\d+)?\s*(?:천|만)?/g,
      /\d+(?:\.\d+)?\s*억\s*\d+/g,
      /\d+(?:\.\d+)?\s*억/g,
      /\d+(?:\.\d+)?\s*만(?:원)?/g,
      /\d{4}\s*년\s*\d{1,2}\s*월\s*\d{1,2}\s*일/g,
      /\d{1,2}\s*월\s*\d{1,2}\s*일/g,
      new RegExp(
        `\\d{1,2}\\s*[${PAIR_SEP_CLS}]\\s*\\d{1,2}(?:\\s*[${PAIR_SEP_CLS}]\\s*\\d{2,4})?`,
        "g"
      ),
      new RegExp(`\\d+(?:\\.\\d+)?\\s*[${TILDE_CLS}\\-]\\s*\\d+(?:\\.\\d+)?`, "g"),
      /물화\s*\d*/g,
      /(?:화장실|화)\s*[1-9]\d*\s*개?/g,
      /\d+\s*화(?:장실)?/g,
      /방\s*[1-9]\d*\s*개?/g,
      /[1-5]\s*룸/g,
      /룸\s*화(?:장실)?\s*[1-4]\s*개?/g,
      /\d+\s*동\s*\d+\s*호/g,
      /\d+\s*층\s*\d+\s*호/g,
      /\d{2,4}\s*호/g,
      /\d+\s*번지/g,
      /\d+(?!\s*층)/g,
    ])
  );

  let next = maskUsedSpans(text, spans);
  const labels = [...INTAKE_FIELD_LABELS].sort((a, b) => b.length - a.length);
  for (const label of labels) {
    next = next.split(label).join(" ");
  }
  next = next
    .replace(/[:：]/g, " ")
    .replace(/[^\uAC00-\uD7A30-9A-Za-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!next) return "";

  const kept = next.split(" ").filter((token) => {
    if (!token || MEMO_WEAK_TOKENS.has(token)) return false;
    if (/^[A-Za-z]$/.test(token)) return false;
    return true;
  });
  const joined = kept.join(" ").trim();
  const hangul = joined.replace(/[^가-힣]/g, "");
  if (hangul.length < 2) return "";
  return joined;
}

function uniqueNoteParts(parts: string[]): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of parts) {
    const next = part.replace(/\s+/g, " ").trim();
    if (!next || seen.has(next)) continue;
    seen.add(next);
    out.push(next);
  }
  return out.join(" / ");
}

/** 칸에 넣은 번호 말고, 뒤에 또 나온 전화는 메모로 */
function extraPhonesForMemo(
  text: string,
  used: (string | undefined)[]
): string[] {
  const usedDigits = new Set(
    used
      .filter((phone): phone is string => Boolean(phone))
      .map((phone) => toKrPhoneDigits(phone))
  );
  const extras: string[] = [];
  const seen = new Set<string>();
  for (const hit of parsePhoneHits(text)) {
    const digits = toKrPhoneDigits(hit.formatted);
    if (!digits || usedDigits.has(digits) || seen.has(digits)) continue;
    seen.add(digits);
    extras.push(hit.formatted);
  }
  return extras;
}

export function parseIntakeText(
  raw: string,
  kind: IntakeKind,
  today: Date = new Date()
): IntakeParseResult {
  const text = collapseThousandCommas(
    expandSpokenPhones(
      raw
        .replace(/[\u200B-\u200D\uFEFF\u00AD]/g, "")
        .replace(/[０-９]/g, (ch) =>
          String.fromCharCode(ch.charCodeAt(0) - 0xff10 + 0x30)
        )
        .replace(/[\u2212\u2013\u2014\u2010\u2011]/g, "-")
        .replace(/\s+/g, " ")
        .trim()
    )
  );
  const result: IntakeParseResult = { options: [], notes: "" };
  if (!text) return result;

  const { body, labeledMemo } = splitLabeledMemo(text);
  if (!body) {
    result.notes = labeledMemo;
    return result;
  }

  const { dealType: firstDeal, fieldText, laterText } =
    firstDealFieldText(body);
  const room = parseRoomSpec(fieldText);
  if (room.roomType) result.roomType = room.roomType;
  if (room.roomCount) result.roomCount = room.roomCount;
  if (room.bathroomCount) result.bathroomCount = room.bathroomCount;

  if (firstDeal) result.dealType = firstDeal;

  const phoneSpans = parsePhoneHits(fieldText).map((hit) => ({
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
  const money = parseMoneyManwon(maskUsedSpans(fieldText, phoneSpans), {
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
  const contacts = parseContacts(leftoverText);
  result.name = contacts.name;
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

  result.loan = parseYesNo(fieldText, ["대출"]);
  result.insurance = parseYesNo(fieldText, ["보증보험", "전세보증보험", "보증 보험"]);
  result.parking = parseYesNo(fieldText, ["주차"]);
  result.elevator = parseYesNo(fieldText, ["엘리베이터", "엘베", "E/V", "EV"]);
  result.workspaceShared = parseYesNo(fieldText, ["팀공유", "팀 공유"]);

  if (LOAN_KIND.test(fieldText)) {
    result.loan = "유";
  }

  const options: string[] = [];
  for (const opt of PROPERTY_OPTIONS) {
    if (fieldText.includes(opt)) options.push(opt);
  }
  result.options = options;

  const notes: string[] = [];
  const loanKind = body.match(LOAN_KIND);
  if (loanKind) notes.push(loanKind[0]);
  const pet = body.match(PET_WORDS);
  if (pet) notes.push(pet[0]);
  const leftover = leftoverMemoText(fieldText, notes);
  if (leftover) notes.push(leftover);
  for (const phone of extraPhonesForMemo(fieldText, [
    result.phone,
    result.tenantPhone,
    result.landlordPhone,
  ])) {
    notes.push(phone);
  }
  if (laterText) {
    const laterNote = compactOccupancyNote(laterText, notes);
    if (laterNote) notes.push(laterNote);
  }
  if (labeledMemo) notes.push(labeledMemo);
  result.notes = uniqueNoteParts(notes);

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
    const prev = (next.notes ?? "").trim();
    next.notes = prev ? `${prev}\n${parsed.notes}` : parsed.notes;
  }
  return next;
}
