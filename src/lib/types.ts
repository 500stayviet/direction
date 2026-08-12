export type DealType = "전세" | "월세" | "매매";
export type RoomType =
  | "원룸"
  | "투룸"
  | "3룸+"
  | "아파트"
  | "상가"
  | "사무실"
  | "토지"
  | "건물";
/** 건물 선택 시 세부 유형 */
export type BuildingKind = "단독주택(다중주택)" | "상가주택" | "근생건물";
/** 건물 임대료 입력 방식 */
export type RentInputMode = "합계" | "상세";
export type ResidentialUnitKey = "원룸" | "투룸" | "3룸+";
export type BuildingUnitKey = ResidentialUnitKey | "상가";
export type ParkingType = "유" | "무";
export type ParkingFeeType = "포함" | "별도";
/** 고객 주차 유일 때 차종 */
export type CarType = "세단" | "SUV";
export type PetAllowed = "유" | "무";
export type NaviApp = "kakaonavi" | "tmap" | "navermap" | "kakaomap";

/** 건물 내 방·상가 호수 */
export interface BuildingUnitCounts {
  원룸: number;
  투룸: number;
  "3룸+": number;
  상가: number;
}

/** 주거 유형별 화장실 개수(호실당) */
export interface BuildingBathroomCounts {
  원룸: number;
  투룸: number;
  "3룸+": number;
}

/** 주거 유형별 실사용면적(평) */
export interface BuildingRoomAreas {
  원룸?: number;
  투룸?: number;
  "3룸+"?: number;
}

/** 상세 모드 — 유형별 보증·월세(만원) */
export interface BuildingTypeRent {
  deposit: number;
  monthlyRent: number;
}

export type BuildingTypeRents = Partial<
  Record<BuildingUnitKey, BuildingTypeRent>
>;

export interface User {
  id: string;
  shopName: string;
  name: string;
  username: string;
  phone: string;
  passwordHint: string;
  createdAt: string;
}

/** 공통: 업장 공유·등록자 표시용 */
export interface SharedMeta {
  /** 업장 공간 ID */
  workspaceId?: string;
  /** 등록자 user id */
  createdBy?: string;
  /** 등록 당시 표시 이름 스냅샷 */
  createdByName?: string;
}

export interface Customer extends SharedMeta {
  id: string;
  name: string;
  phone: string;
  dealType: DealType;
  /** 희망 방/매물 유형 */
  roomType?: RoomType;
  /** 건물일 때 희망 건물 종류 (매물 buildingKind와 매칭) */
  buildingKind?: BuildingKind;
  /** 희망 방 수 (투룸·3룸+·아파트) */
  roomCount?: number;
  /** 희망 화장실 수 (투룸·3룸+·아파트) */
  bathroomCount?: number;
  /**
   * 팀 공유 여부. true일 때만 같은 업장 팀원에게 보입니다.
   * false·미설정이면 본인만 보입니다.
   */
  workspaceShared?: boolean;
  /** 사이트내(현장동선) 공유 — 다른 회원 매물 자동매칭용 */
  siteShared?: boolean;
  /** 보증금 또는 매가 (만원) — 단일값 또는 범위 시작 */
  deposit: number;
  /** 보증금/매가 범위 종료 (만원). 단일일 때는 deposit와 같거나 생략 */
  depositTo?: number;
  /** true면 보증금/매가가 단일 금액 */
  depositSingle?: boolean;
  /** 월세 (만원) — 단일값 또는 범위 시작 */
  monthlyRent?: number;
  /** 월세 범위 종료 (만원) */
  monthlyRentTo?: number;
  /** true면 월세가 단일 금액 */
  monthlyRentSingle?: boolean;
  /** 표시용 요약 문자열 (하위 호환) */
  budget: string;
  /** 희망 입주 시작일 (YYYY-MM-DD) */
  moveInFrom: string;
  /** 희망 입주 종료일 (YYYY-MM-DD) */
  moveInTo: string;
  /** true면 희망 입주일이 하루(단일) */
  moveInSingle?: boolean;
  /** 표시용 요약 (하위 호환) */
  moveInDate: string;
  /** 매매 시 비입주(투자 등) 여부 */
  nonOccupancy?: boolean;
  /** 대출 유무 — 매칭 키. 상세 종류(loanType)는 기록용 */
  loanNeeded?: ParkingType;
  /** 대출 종류 (loanNeeded=유 일 때 기록). 매칭에는 사용하지 않음 */
  loanType?: string;
  /** 전세보증보험 가입 가능 매물 희망 */
  insuranceNeeded?: ParkingType;
  /** 엘리베이터 유무 희망 */
  elevatorNeeded?: ParkingType;
  /** 고객 희망 주차 조건 */
  parkingType: ParkingType;
  /** 주차 유일 때 차종 */
  carType?: CarType;
  /** 고객 애완동물 유무 */
  petAllowed: PetAllowed;
  notes?: string;
  /** 계약 완료 여부 */
  contractCompleted?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PartnerAgency {
  name: string;
  phone: string;
  dong: string;
}

export interface Property extends SharedMeta {
  id: string;
  address: string;
  roomNo: string;
  /** 1층(공동현관) 비밀번호 */
  floorPassword?: string;
  /** 호실 비밀번호 */
  roomPassword?: string;
  /** @deprecated floorPassword / roomPassword 사용 */
  password?: string;
  /** 매물 방문 약속 시간 HH:mm */
  arriveTime?: string;
  /** 임차인 연락처 */
  tenantPhone?: string;
  /** 임대인 연락처 */
  landlordPhone?: string;
  /** 협력 부동산 여부 */
  hasPartnerAgency: boolean;
  partnerAgency: PartnerAgency;
  dealType: DealType;
  /** 방/매물 유형 (고객 유형을 기본으로 불러옴) */
  roomType?: RoomType;
  /** 방 수 (투룸은 2 고정 · 3룸+/아파트 선택, 필수 · 최대 5) */
  roomCount?: number;
  /** 화장실 수 (투룸·3룸+·아파트) */
  bathroomCount?: number;
  deposit: number;
  monthlyRent?: number;
  maintenanceFee: number;
  maintenanceIncludes: string[];
  parkingType: ParkingType;
  parkingFeeType: ParkingFeeType;
  parkingFee?: number;
  /** 대출 가능 여부. 미입력이면 매칭 통과 */
  loanAvailable?: ParkingType;
  /** 애완동물 유무(가능 여부) */
  petAllowed: PetAllowed;
  elevator: boolean;
  options: string[];
  /** 입주 가능 시작일 */
  moveInFrom?: string;
  /** 입주 가능 종료일 (선택) */
  moveInTo?: string;
  /** true면 입주 가능일이 하루(단일) */
  moveInSingle?: boolean;
  /** 표시용 요약 */
  moveInDate: string;
  insuranceType?: string;
  /** 추가 메모·특이사항 (건폐율·용적률·현황·향 등) */
  notes?: string;
  /** 리스트 매물: 사이트내공유 여부 (유=공유중). 필드명 호환 유지 */
  partnerAgencyShared?: boolean;
  /** 리스트 매물: 팀공유 여부 (유=공유중) */
  workspaceShared?: boolean;
  /** 실사용면적 평 (원룸·상가 등 단일 유형) */
  usableArea?: number;
  /** 토지 대지면적 평 / 건물 토지면적 평 */
  landArea?: number;
  /** 토지 용도 */
  landUse?: string;
  /** 건물 세부 유형 */
  buildingKind?: BuildingKind;
  /** 지하 층수 */
  floorsBasement?: number;
  /** 지상 층수 */
  floorsAbove?: number;
  /** 건축면적 평 */
  buildingArea?: number;
  /** 주차 대수 */
  parkingSpaces?: number;
  /** 원룸·투룸·3룸+·상가 호수 */
  unitCounts?: BuildingUnitCounts;
  /** 주거 유형별 화장실 수(호실당) */
  bathroomCounts?: BuildingBathroomCounts;
  /** 주거 유형별 실사용면적 평 */
  roomAreas?: BuildingRoomAreas;
  /** 상가별 실사용면적 평 (길이 = 상가 호수) */
  commercialAreas?: number[];
  /** 건물 임대료: 합계 | 유형별 상세 */
  rentInputMode?: RentInputMode;
  /** 상세 모드 유형별 임대료 */
  typeRents?: BuildingTypeRents;
  lat?: number;
  lng?: number;
}

/** 매물 리스트에 단독 저장된 매물 */
export interface ListedProperty extends Property {
  createdAt: string;
  updatedAt: string;
  /** 계약/거래 완료 여부 */
  contractCompleted?: boolean;
}

export interface RouteSummary {
  fromIndex: number;
  toIndex: number;
  distanceKm: number;
  durationMin: number;
}

export interface Schedule extends SharedMeta {
  id: string;
  /** 등록 고객 ID. 고객없음(게스트)일 때는 비움 */
  customerId?: string;
  /** 고객없음일 때 입력한 성함 */
  guestName?: string;
  title?: string;
  visitDate?: string;
  /** 방문 시간 HH:mm */
  visitTime?: string;
  properties: Property[];
  routeSummary: RouteSummary[];
  /** true면 업장 멤버에게 네비(일정) 공유 */
  workspaceShared?: boolean;
  /** 방문 종료(완료) — 리스트에서 회색·하단 정렬 */
  visitCompleted?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NaviPreference {
  app: NaviApp;
  remember: boolean;
  /** ISO — 항상 사용 선택 시각. 약 15일 후 다시 선택 */
  savedAt?: string;
}
