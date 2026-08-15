import { normalizeIntakeInput } from "@/lib/intakeParse";

const OCR_FORM_LABELS = [
  "고객명 또는 명칭",
  "입주희망일",
  "입주 희망일",
  "임대가능일",
  "임대 가능일",
  "거래가액",
  "거래 가액",
  "선호위치",
  "선호 위치",
  "매물유형",
  "매물 유형",
  "거래종류",
  "거래 종류",
  "전세보증보험",
  "보증 보험",
  "바로 입주",
  "즉시 입주",
  "바로입주",
  "즉시입주",
  "전화번호",
  "고객명",
  "명칭",
  "메모",
  "내용",
  "추가내용",
  "추가 내용",
  "비고",
  "특이사항",
  "특이 사항",
  "참고",
  "요청사항",
  "요청 사항",
  "기타",
  "주소",
  "매매가",
  "보증금",
  "관리비",
  "보증보험",
  "팀공유",
  "팀 공유",
];

/** 사진 OCR 결과를 메시지 파서에 맞게 정리 */
export function normalizeOcrIntakeText(raw: string): string {
  let text = raw
    .replace(/\r\n/g, "\n")
    .replace(/[|｜]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  text = text.replace(/매\s+매/g, "매매");
  text = text.replace(/(\d)\s+(억|만)/g, "$1$2");
  text = text.replace(/(\d)\s+(월)/g, "$1$2");
  text = text.replace(/(\d)\s+(일)/g, "$1$2");
  text = text.replace(/(\d)\s+(층)/g, "$1$2");
  for (const label of OCR_FORM_LABELS) {
    text = text.split(label).join(" ");
  }
  text = text.replace(/\s+/g, " ").trim();

  text = text.replace(
    /(\d{2})\s*\.\s*(\d{1,2})\s*\.\s*(\d{1,2})/g,
    "$1.$2.$3"
  );
  text = text.replace(
    /(\d+(?:\.\d+)?)\s*억\s*[\/／]\s*(\d+(?:\.\d+)?)(?:\s*[\/／]\s*관\s*(\d+))?/g,
    (_, eok, rent, fee) =>
      fee != null ? `${eok}억/${rent}/관${fee}` : `${eok}억/${rent}`
  );
  text = text.replace(/(\d{1,3})\s*,\s*(\d{3})\s*만/g, "$1$2만");
  text = text.replace(/(?<!\d)(\d{1,3})\s+(\d{3})\s*만(?!\d)/g, "$1$2만");
  text = text.replace(/방\s*([1-5])\s*화\s*([1-4])/g, "방$1화$2");
  text = text.replace(/실\s*입주/g, "실입주");
  text = text.replace(/현\s*임\s*(?:차\s*)?인/g, "현임차인");
  text = text.replace(
    /(\d{1,5}\s*[-−~]\s*\d{1,5})\s+((?:[가-힣A-Za-z0-9]+\s+)+[가-힣A-Za-z0-9]+)\s+(\d+\s*호)/g,
    (_, jibun, name, ho) => `${jibun} ${name.replace(/\s+/g, "")} ${ho}`
  );

  return normalizeIntakeInput(text);
}
