import { buildAgentShareFooterLines } from "@/lib/shareAgentFooter";
import type { User } from "@/lib/types";

type Agent = Pick<User, "shopName" | "name" | "phone"> | null | undefined;

/** 메시지로 입력 — 고객등록 양식(~550자) + 여유 */
export const MESSAGE_INTAKE_MAX_LENGTH = 600;

export const CUSTOMER_BLANK_FORM_TITLE = "고객등록 양식";

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
  "상호명 (협력부동산)",
  "동 (협력부동산)",
  "연락처 (협력부동산)",
  "임차인 번호",
  "임대인 번호",
  "매물 유형",
  "방 수",
  "화장실 수",
  "건물 종류",
  "거래종류",
  "거래가액 (보증금·월세·매매가)",
  "관리비",
  "매물 주소 (구·동)",
  "지번 본번",
  "지번 부번",
  "동·호실",
  "1층 현관 비밀번호",
  "해당 호실 비밀번호",
  "임대희망일",
  "대출 (유/무)",
  "전세보증보험 (유/무)",
  "주차 (유/무)",
  "엘리베이터 (유/무)",
  "옵션",
  "메모",
] as const;

export function buildCustomerBlankFormText(agent: Agent): string {
  return buildBlankForm(CUSTOMER_BLANK_FORM_TITLE, CUSTOMER_BLANK_LABELS, agent);
}

export function buildPropertyBlankFormText(agent: Agent): string {
  return buildBlankForm("매물등록 양식", PROPERTY_BLANK_LABELS, agent);
}

export function isCustomerBlankFormText(raw: string): boolean {
  return /^\s*고객등록\s*양식/m.test(raw);
}

function stripExampleHint(label: string): string {
  return label
    .replace(/\s*\(예\s*[:：][^)]*\)\s*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cutAgentFooter(text: string): string {
  const cut = text.search(/\n[─-]{3,}/);
  if (cut >= 0) return text.slice(0, cut).trimEnd();
  const provided = text.search(/\n\s*-제공-\s*/);
  if (provided >= 0) return text.slice(0, provided).trimEnd();
  return text.trimEnd();
}

type BlankFieldKey =
  | "name"
  | "phone"
  | "roomType"
  | "roomCount"
  | "bathroomCount"
  | "money"
  | "location"
  | "dates"
  | "loan"
  | "insurance"
  | "parking"
  | "elevator"
  | "notes";

function mapBlankLabel(label: string): BlankFieldKey | null {
  const key = stripExampleHint(label).replace(/\s+/g, "");
  if (/^(고객명|이름|성함|명칭)$/.test(key)) return "name";
  if (/^(고객전화번호|전화번호|연락처|휴대폰)$/.test(key)) return "phone";
  if (/^(매물유형|유형)$/.test(key)) return "roomType";
  if (/^(방수|방)$/.test(key)) return "roomCount";
  if (/^(화장실수|화장실|화)$/.test(key)) return "bathroomCount";
  if (/^(거래가액|보증금|월세|매매가|금액)$/.test(key)) return "money";
  if (/^(선호지역|선호위치|지역)$/.test(key)) return "location";
  if (/^(입주희망일|입주|희망일)$/.test(key)) return "dates";
  if (/^대출$/.test(key)) return "loan";
  if (/^(전세보증보험|보증보험|보증)$/.test(key)) return "insurance";
  if (/^주차$/.test(key)) return "parking";
  if (/^(엘리베이터|엘)$/.test(key)) return "elevator";
  if (/^(추가희망사항|희망사항|메모|내용|비고)$/.test(key)) return "notes";
  return null;
}

function extractBlankFields(body: string): Partial<Record<BlankFieldKey, string>> {
  const fields: Partial<Record<BlankFieldKey, string>> = {};
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i]?.trim() ?? "";
    if (!rawLine || /^고객등록\s*양식/.test(rawLine)) continue;

    const line = stripExampleHint(rawLine);
    if (!line) continue;

    const sameLine = line.match(/^(.+?)\s*[:：]\s*(.+)$/);
    if (sameLine) {
      const mapped = mapBlankLabel(sameLine[1]);
      const value = sameLine[2].trim();
      if (mapped && value) fields[mapped] = value;
      continue;
    }

    const next = lines[i + 1]?.trim() ?? "";
    if (/^[:：]/.test(next)) {
      const mapped = mapBlankLabel(line);
      const value = next.replace(/^[:：]\s*/, "").trim();
      if (mapped && value) fields[mapped] = value;
      i += 1;
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

/** 양식 → 기존 parseIntakeText가 잘 읽는 짧은 메시지 */
function rebuildCustomerIntakeMessage(
  fields: Partial<Record<BlankFieldKey, string>>
): string {
  const parts: string[] = [];
  if (fields.name) parts.push(fields.name);
  if (fields.phone) parts.push(fields.phone);
  if (fields.roomType) parts.push(fields.roomType);
  if (fields.roomCount) {
    const n = fields.roomCount.replace(/\s+/g, "");
    parts.push(/방/.test(n) ? fields.roomCount : `방 ${fields.roomCount}`);
  }
  if (fields.bathroomCount) {
    const n = fields.bathroomCount.replace(/\s+/g, "");
    parts.push(
      /화장|화/.test(n) ? fields.bathroomCount : `화장실 ${fields.bathroomCount}`
    );
  }
  if (fields.money) parts.push(fields.money);
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

/**
 * 고객등록 양식이면 예시·푸터를 빼고 채운 값만 남긴 메시지로 바꾼다.
 * 양식이 아니면 null (기존 raw 유지). 값은 없어도 빈 문자열을 돌려 예시 오인을 막는다.
 */
export function preprocessCustomerBlankForm(raw: string): string | null {
  if (!isCustomerBlankFormText(raw)) return null;
  const body = cutAgentFooter(raw);
  const fields = extractBlankFields(body);
  return rebuildCustomerIntakeMessage(fields);
}
