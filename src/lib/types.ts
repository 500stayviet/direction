export type DealType = "전세" | "월세" | "매매";
export type RoomType =
  | "원룸"
  | "투룸"
  | "쓰리룸"
  | "쓰리룸+"
  | "상가"
  | "오피스";
export type ParkingType = "유" | "무";
export type ParkingFeeType = "포함" | "별도";
export type PetAllowed = "유" | "무";
export type NaviApp = "kakaonavi" | "tmap" | "navermap";

export interface User {
  id: string;
  shopName: string;
  name: string;
  username: string;
  phone: string;
  passwordHint: string;
  createdAt: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  dealType: DealType;
  /** 희망 방/매물 유형 */
  roomType?: RoomType;
  /** 보증금 또는 매가 (만원 단위) */
  deposit: number;
  /** 월세 (만원 단위). 월세 거래일 때만 사용 */
  monthlyRent?: number;
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
  loanType?: string;
  /** 손님 희망 주차 조건 */
  parkingType: ParkingType;
  /** 손님 애완동물 유무 */
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

export interface Property {
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
  /** 집주인 연락처 */
  landlordPhone?: string;
  /** 협력 부동산 여부 */
  hasPartnerAgency: boolean;
  partnerAgency: PartnerAgency;
  dealType: DealType;
  /** 방/매물 유형 (손님 유형을 기본으로 불러옴) */
  roomType?: RoomType;
  deposit: number;
  monthlyRent?: number;
  maintenanceFee: number;
  maintenanceIncludes: string[];
  parkingType: ParkingType;
  parkingFeeType: ParkingFeeType;
  parkingFee?: number;
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
  /** 추가 메모·특이사항 */
  notes?: string;
  lat?: number;
  lng?: number;
}

/** 매물 리스트에 단독 저장된 매물 */
export interface ListedProperty extends Property {
  createdAt: string;
  updatedAt: string;
}

export interface RouteSummary {
  fromIndex: number;
  toIndex: number;
  distanceKm: number;
  durationMin: number;
}

export interface Schedule {
  id: string;
  /** 등록 손님 ID. 고객없음(게스트)일 때는 비움 */
  customerId?: string;
  /** 고객없음일 때 입력한 성함 */
  guestName?: string;
  title?: string;
  visitDate?: string;
  /** 방문 시간 HH:mm */
  visitTime?: string;
  properties: Property[];
  routeSummary: RouteSummary[];
  createdAt: string;
  updatedAt: string;
}

export interface NaviPreference {
  app: NaviApp;
  remember: boolean;
}
