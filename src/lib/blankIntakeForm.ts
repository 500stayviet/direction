import { buildAgentShareFooterLines } from "@/lib/shareAgentFooter";
import type { User } from "@/lib/types";

type Agent = Pick<User, "shopName" | "name" | "phone"> | null | undefined;

/** 메시지로 입력 — 고객등록 양식(~550자) + 여유 */
export const MESSAGE_INTAKE_MAX_LENGTH = 600;

export const CUSTOMER_BLANK_FORM_TITLE = "고객등록 양식";
export const PROPERTY_BLANK_FORM_TITLE = "매물등록 양식";

/** 항목명 다음 줄에 `:` */
function blankField(label: string): string {
  return `${label}\n:\n`;
}

function buildBlankForm(
  title: string,
  labels: readonly string[],
  agent: Agent
): string {
  const body = labels.map(blankField).join("\n");
  const footer = buildAgentShareFooterLines(agent).join("\n");
  return `${title}\n\n${body}\n${footer}`.trim();
}

const CUSTOMER_BLANK_LABELS = [
  "고객명 (예: 홍길동)",
  "고객 전화번호 (예: 010-1234-5678)",
  "거래종류 (예: 매매, 전세, 월세)",
  "매물 유형 (예: 아파트, 원룸, 투룸, 3룸+)",
  "방 수 (예: 2개)",
  "화장실 수 (예: 1개)",
  "거래가액 (예: 보증금 1000 / 월세 50, 또는 매매 5억)",
  "선호지역 (예: 강동구 성내동, 암사동 등)",
  "입주희망일 (예: 3월 1일 ~ 4월 15일)",
  "대출 (예: 유 / 무)",
  "전세보증보험 (예: 유 / 무)",
  "주차 (예: 유 / 무)",
  "엘리베이터 (예: 유 / 무)",
  "추가 희망사항 (예: 희망층)",
] as const;

const PROPERTY_BLANK_LABELS = [
  "임차인 전화번호 (예: 010-1234-5678)",
  "임대인 전화번호 (예: 010-9876-5432)",
  "거래종류 (예: 매매, 전세, 월세)",
  "거래가액 (예: 보증금 10000 / 월세 50, 또는 매매 1억)",
  "매물 유형 (예: 원룸, 오피스텔)",
  "방 수 (예: 2개)",
  "화장실 수 (예: 1개)",
  "임대희망일 (예: 8월 21일 ~ 10월 22일)",
  "매물 주소 (예: 강동구 성내동)",
  "지번 (예: 111-1)",
  "나머지 주소 (예: 힐스테이트 101동 102호)",
  "옵션 (예: 에어컨)",
  "대출 (예: 유 / 무)",
  "전세보증보험 (예: 유 / 무)",
  "주차 (예: 유 / 무)",
  "엘리베이터 (예: 유 / 무)",
  "메모 (예: 남향 저층)",
] as const;

export function buildCustomerBlankFormText(agent: Agent): string {
  return buildBlankForm(CUSTOMER_BLANK_FORM_TITLE, CUSTOMER_BLANK_LABELS, agent);
}

export function buildPropertyBlankFormText(agent: Agent): string {
  return buildBlankForm(PROPERTY_BLANK_FORM_TITLE, PROPERTY_BLANK_LABELS, agent);
}

export function isCustomerBlankFormText(raw: string): boolean {
  if (/^\s*(?:고객등록|객등록)\s*양식/m.test(raw)) return true;
  const labelHits = [
    /고객명/,
    /고객\s*전화번호|전화번호/,
    /거래종류/,
    /매물\s*유형/,
    /거래가액/,
    /선호지역/,
    /입주희망일/,
    /추가\s*희망사항/,
  ].filter((re) => re.test(raw)).length;
  return labelHits >= 5;
}

export function isPropertyBlankFormText(raw: string): boolean {
  if (/^\s*매물등록\s*양식/m.test(raw)) return true;
  const labelHits = [
    /임차인\s*번호/,
    /임대인\s*번호/,
    /매물\s*주소/,
    /나머지\s*주소/,
    /지번/,
    /임대희망일/,
    /옵션/,
  ].filter((re) => re.test(raw)).length;
  return labelHits >= 4;
}

function stripExampleHint(label: string): string {
  return label
    .replace(/\s*\(예\s*[:：][^)]*\)\s*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cutAgentFooter(text: string): string {
  const cut = text.search(/[─-]{3,}/);
  if (cut >= 0) return text.slice(0, cut).trimEnd();
  const provided = text.search(/\s*-제공-\s*/);
  if (provided >= 0) return text.slice(0, provided).trimEnd();
  return text.trimEnd();
}

type BlankFieldKey =
  | "name"
  | "phone"
  | "tenantPhone"
  | "landlordPhone"
  | "roomType"
  | "roomCount"
  | "bathroomCount"
  | "dealType"
  | "money"
  | "location"
  | "jibun"
  | "restAddress"
  | "dates"
  | "options"
  | "loan"
  | "insurance"
  | "parking"
  | "elevator"
  | "notes";

function mapBlankLabel(label: string): BlankFieldKey | null {
  const key = stripExampleHint(label).replace(/\s+/g, "");
  if (/^(고객명|이름|성함|명칭)$/.test(key)) return "name";
  if (/^(임차인번호|임차인전화번호|세입자번호)$/.test(key)) return "tenantPhone";
  if (/^(임대인번호|임대인전화번호|주인번호)$/.test(key)) return "landlordPhone";
  if (/^(고객전화번호|전화번호|연락처|휴대폰)$/.test(key)) return "phone";
  if (/^(매물유형|유형)$/.test(key)) return "roomType";
  if (/^(방수|방)$/.test(key)) return "roomCount";
  if (/^(화장실수|화장실|화)$/.test(key)) return "bathroomCount";
  if (/^(거래종류|거래유형|매매전세월세)$/.test(key)) return "dealType";
  if (/^(거래가액|보증금|월세|매매가|금액)$/.test(key)) return "money";
  if (/^(매물주소|선호지역|선호위치|지역)$/.test(key)) return "location";
  if (/^지번$/.test(key)) return "jibun";
  if (/^나머지주소$/.test(key)) return "restAddress";
  if (/^(임대희망일|입주희망일|입주|희망일)$/.test(key)) return "dates";
  if (/^옵션$/.test(key)) return "options";
  if (/^대출$/.test(key)) return "loan";
  if (/^(전세보증보험|보증보험|보증)$/.test(key)) return "insurance";
  if (/^주차$/.test(key)) return "parking";
  if (/^(엘리베이터|엘)$/.test(key)) return "elevator";
  if (/^(추가희망사항|희망사항|메모|내용|비고)$/.test(key)) return "notes";
  return null;
}

function isBlankFormLabelLine(raw: string): boolean {
  const line = stripExampleHint(raw.trim());
  if (!line || /^[:：]/.test(line)) return false;
  const sameLine = line.match(/^(.+?)\s*[:：]\s*/);
  if (sameLine) return mapBlankLabel(sameLine[1]) != null;
  return mapBlankLabel(line) != null;
}

function collectContinuation(
  lines: string[],
  start: number
): { extra: string; nextIndex: number } {
  const parts: string[] = [];
  let j = start;
  while (j < lines.length) {
    const raw = lines[j]?.trim() ?? "";
    if (!raw) {
      j += 1;
      continue;
    }
    if (isBlankFormLabelLine(raw) || /^[:：]/.test(raw)) break;
    parts.push(raw);
    j += 1;
  }
  return { extra: parts.join(" ").trim(), nextIndex: j };
}

function joinFieldValue(first: string, extra: string): string {
  return [first.trim(), extra].filter(Boolean).join(" ").trim();
}

function extractBlankFields(body: string): Partial<Record<BlankFieldKey, string>> {
  const fields: Partial<Record<BlankFieldKey, string>> = {};
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i]?.trim() ?? "";
    if (!rawLine || /^(?:고객등록|객등록|매물등록)\s*양식/.test(rawLine)) {
      continue;
    }

    const line = stripExampleHint(rawLine);
    if (!line) continue;

    const sameLine = line.match(/^(.+?)\s*[:：]\s*(.+)$/);
    if (sameLine) {
      const mapped = mapBlankLabel(sameLine[1]);
      const { extra, nextIndex } = collectContinuation(lines, i + 1);
      const value = joinFieldValue(sameLine[2], extra);
      if (mapped && value) fields[mapped] = value;
      if (extra) i = nextIndex - 1;
      continue;
    }

    const next = lines[i + 1]?.trim() ?? "";
    if (/^[:：]/.test(next)) {
      const mapped = mapBlankLabel(line);
      const first = next.replace(/^[:：]\s*/, "").trim();
      const { extra, nextIndex } = collectContinuation(lines, i + 2);
      const value = joinFieldValue(first, extra);
      if (mapped && value) fields[mapped] = value;
      i = extra ? nextIndex - 1 : i + 1;
    }
  }
  return fields;
}

function yesNoToken(value: string): string {
  const t = value.replace(/\s+/g, "");
  if (/^유|있음|가능|필요/.test(t)) return "유";
  if (/^무|없음|불가|불필요/.test(t)) return "무";
  return value.trim();
}

/** 거래종류를 이미 넣었으면 금액 앞의 같은 단어는 가격 라벨로 바꿈 */
function normalizeBlankMoney(dealType: string | undefined, money: string): string {
  const m = money.trim();
  const d = (dealType ?? "").trim();
  if (d === "전세" && /^전세(?!가|금|보증)/.test(m)) {
    return m.replace(/^전세/, "전세가");
  }
  if (d === "매매" && /^매매(?!가)/.test(m)) {
    return m.replace(/^매매/, "매매가");
  }
  if (/^월세\s*\d+(?:\.\d+)?\s*[\/／]\s*\d+/.test(m)) {
    return m.replace(/^월세\s*/, "");
  }
  return m;
}

/** 양식 → 기존 parseIntakeText가 잘 읽는 짧은 메시지 */
function rebuildCustomerIntakeMessage(
  fields: Partial<Record<BlankFieldKey, string>>
): string {
  const parts: string[] = [];
  if (fields.name) parts.push(fields.name);
  if (fields.phone) parts.push(fields.phone);
  if (fields.dealType) parts.push(fields.dealType.trim());
  if (fields.roomType) parts.push(fields.roomType);
  const isOneRoom = /원룸/.test((fields.roomType ?? "").replace(/\s+/g, ""));
  if (!isOneRoom && fields.roomCount) {
    const n = fields.roomCount.replace(/\s+/g, "");
    parts.push(/방/.test(n) ? fields.roomCount : `방 ${fields.roomCount}`);
  }
  if (!isOneRoom && fields.bathroomCount) {
    const n = fields.bathroomCount.replace(/\s+/g, "");
    parts.push(
      /화장|화/.test(n) ? fields.bathroomCount : `화장실 ${fields.bathroomCount}`
    );
  }
  if (fields.money) {
    parts.push(normalizeBlankMoney(fields.dealType, fields.money));
  }
  if (fields.location) parts.push(fields.location);
  if (fields.dates) parts.push(fields.dates);
  if (fields.loan) parts.push(`대출 ${yesNoToken(fields.loan)}`);
  if (fields.insurance) {
    parts.push(`전세보증보험 ${yesNoToken(fields.insurance)}`);
  }
  if (fields.parking) parts.push(`주차 ${yesNoToken(fields.parking)}`);
  if (fields.elevator) {
    parts.push(`엘리베이터 ${yesNoToken(fields.elevator)}`);
  }
  if (fields.notes) parts.push(`메모: ${fields.notes}`);
  return parts.join("\n").trim();
}

function normalizeRestAddress(value: string): string {
  return value
    .replace(/([가-힣]+)(\d+\s*동)/g, "$1 $2")
    .replace(/(\d+\s*동)(\d+\s*호)/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

function rebuildPropertyIntakeMessage(
  fields: Partial<Record<BlankFieldKey, string>>
): string {
  const parts: string[] = [];
  if (fields.dealType) parts.push(fields.dealType.trim());
  if (fields.roomType) parts.push(fields.roomType);
  const isOneRoom = /원룸/.test((fields.roomType ?? "").replace(/\s+/g, ""));
  if (!isOneRoom && fields.roomCount) {
    const n = fields.roomCount.replace(/\s+/g, "");
    parts.push(/방/.test(n) ? fields.roomCount : `방 ${fields.roomCount}`);
  }
  if (!isOneRoom && fields.bathroomCount) {
    const n = fields.bathroomCount.replace(/\s+/g, "");
    parts.push(
      /화장|화/.test(n) ? fields.bathroomCount : `화장실 ${fields.bathroomCount}`
    );
  }
  if (fields.money) {
    parts.push(normalizeBlankMoney(fields.dealType, fields.money));
  }
  const address = [
    fields.location,
    fields.jibun,
    fields.restAddress ? normalizeRestAddress(fields.restAddress) : "",
  ]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
  if (address) parts.push(address);
  if (fields.dates) parts.push(fields.dates);
  if (fields.tenantPhone) parts.push(`세 ${fields.tenantPhone}`);
  if (fields.landlordPhone) parts.push(`임 ${fields.landlordPhone}`);
  if (fields.options) parts.push(fields.options);
  if (fields.loan) parts.push(`대출 ${yesNoToken(fields.loan)}`);
  if (fields.insurance) {
    parts.push(`전세보증보험 ${yesNoToken(fields.insurance)}`);
  }
  if (fields.parking) parts.push(`주차 ${yesNoToken(fields.parking)}`);
  if (fields.elevator) {
    parts.push(`엘리베이터 ${yesNoToken(fields.elevator)}`);
  }
  if (fields.notes) parts.push(`메모: ${fields.notes}`);
  return parts.join("\n").trim();
}

function finalizeBlankFormRebuild(
  raw: string,
  isForm: (text: string) => boolean,
  rebuild: (fields: Partial<Record<BlankFieldKey, string>>) => string
): string | null {
  if (!isForm(raw)) return null;
  const body = cutAgentFooter(raw);
  const fields = extractBlankFields(body);
  const rebuilt = rebuild(fields);
  if (rebuilt) return rebuilt;
  if (/\n\s*[:：]/.test(body) || /[:：]\s*$/m.test(body)) return "";
  return null;
}

/**
 * 고객등록 양식이면 예시·푸터를 빼고 채운 값만 남긴 메시지로 바꾼다.
 * 양식이 아니면 null (기존 raw 유지). 붙여넣은 빈 양식은 "" 로 예시 오인을 막는다.
 * 사진 OCR처럼 줄이 붙고 라벨이 빠지면 null 을 돌려 원문을 파싱한다.
 */
export function preprocessCustomerBlankForm(raw: string): string | null {
  return finalizeBlankFormRebuild(
    raw,
    isCustomerBlankFormText,
    rebuildCustomerIntakeMessage
  );
}

/**
 * 매물등록 양식이면 예시·푸터를 빼고 채운 값만 남긴 메시지로 바꾼다.
 * 양식이 아니면 null. 빈 양식은 "" 로 예시 오인을 막는다.
 */
export function preprocessPropertyBlankForm(raw: string): string | null {
  return finalizeBlankFormRebuild(
    raw,
    isPropertyBlankFormText,
    rebuildPropertyIntakeMessage
  );
}
