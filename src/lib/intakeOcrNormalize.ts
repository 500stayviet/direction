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
  "화장실",
  "엘리베이터",
  "보증보험",
  "팀공유",
  "팀 공유",
  "임차인",
  "임대인",
  "연락처",
  "대출",
  "주차",
  "엘베",
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
  return text.replace(/\s+/g, " ").trim();
}
