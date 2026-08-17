import { buildAgentShareFooterLines } from "@/lib/shareAgentFooter";
import type { User } from "@/lib/types";

type Agent = Pick<User, "shopName" | "name" | "phone"> | null | undefined;

/** `명칭:  `(콜론 뒤 띄어쓰기 두 번) 한 줄 */
function blankField(label: string): string {
  return `${label}:  \n`;
}

function buildBlankForm(
  title: string,
  labels: readonly string[],
  agent: Agent
): string {
  const body = labels.map(blankField).join("");
  const footer = buildAgentShareFooterLines(agent).join("\n");
  return `${title}\n\n${body}${footer}`.trim();
}

const CUSTOMER_BLANK_LABELS = [
  "고객명 또는 명칭",
  "고객 전화번호",
  "매물 유형",
  "방 수",
  "화장실 수",
  "건물 종류",
  "거래종류",
  "거래가액 (보증금·월세·매매가)",
  "선호지역",
  "입주희망일",
  "대출 (유/무)",
  "전세보증보험 (유/무)",
  "주차 (유/무)",
  "엘리베이터 (유/무)",
  "메모",
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
  return buildBlankForm("고객등록 양식", CUSTOMER_BLANK_LABELS, agent);
}

export function buildPropertyBlankFormText(agent: Agent): string {
  return buildBlankForm("매물등록 양식", PROPERTY_BLANK_LABELS, agent);
}
