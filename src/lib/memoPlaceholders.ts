import type { RoomType } from "@/lib/types";

/** 고객·매물 등록 메모 힌트 */
export function customerMemoPlaceholder(roomType?: RoomType | string): string {
  switch (roomType) {
    case "상가":
      return "희망업종, 권리금 한도, 시설, 화장실(내부/외부), 방향 등";
    case "사무실":
      return "희망층, 시설, 희망 주차 대수 등";
    case "토지":
      return "매수목적, 현황, 희망조건 등";
    case "건물":
      return "희망 수익률, 건물 총층, 엘리베이터 유무 등";
    case "원룸":
    case "투룸":
    case "3룸+":
    case "오피스텔":
    case "아파트":
    default:
      return "희망층, 방향, 애완동물, 특이사항 등";
  }
}

export function propertyNotesPlaceholder(roomType?: RoomType | string): string {
  switch (roomType) {
    case "상가":
      return "예) 현업종, 권리금, 시설";
    case "사무실":
      return "예) 층, 시설, 주차 대수";
    case "토지":
      return "예) 도로접면, 건폐율, 용적률";
    case "건물":
      return "예) 위반건축물 여부, 건축연도";
    case "원룸":
    case "투룸":
    case "3룸+":
    case "오피스텔":
    case "아파트":
    default:
      return "예) 남향 저층";
  }
}
