import { normalizeRoomType, normalizeBuildingKind } from "@/lib/constants";
import { isInsuranceJoined, needsJeonseInsurance, needsLoanFlag, resolveCustomerLoanNeeded } from "@/lib/format";
import type { Customer, ListedProperty, RoomType } from "@/lib/types";

/**
 * 다른 회원(사이트내공유) 매물·고객 자동 매칭.
 * 회원 모집 우선으로 당분간 비활성 — 내 리스트 매칭만 사용.
 */
export const CROSS_MEMBER_PROPERTY_MATCH_ENABLED = false;

// ─────────────────────────────────────────────
// 기존 후보군 생성(boolean) 로직 — 배지/알람에서 계속 사용
// ─────────────────────────────────────────────

const AMOUNT_MIN_RATIO = 0.5;
const AMOUNT_MAX_RATIO = 1.1;

function rangeBounds(
  from: number | undefined,
  to: number | undefined,
  single?: boolean
): { min: number; max: number } | null {
  if (typeof from !== "number" || Number.isNaN(from)) return null;
  if (single === false && typeof to === "number" && to > 0 && to !== from) {
    return { min: Math.min(from, to), max: Math.max(from, to) };
  }
  if (typeof to === "number" && to > 0 && to !== from) {
    return { min: Math.min(from, to), max: Math.max(from, to) };
  }
  return { min: from, max: from };
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}/;

function parseDay(iso?: string): string | null {
  const s = (iso ?? "").trim();
  if (!DAY_RE.test(s)) return null;
  return s.slice(0, 10);
}

function moveInDayRange(
  from?: string,
  to?: string,
  single?: boolean
): { start: string; end: string } | null {
  const f = parseDay(from);
  const t = parseDay(to);
  if (!f && !t) return null;
  if (single || (f && (!t || t === f))) {
    const d = f ?? t!;
    return { start: d, end: d };
  }
  if (f && t) {
    return f <= t ? { start: f, end: t } : { start: t, end: f };
  }
  if (f) return { start: f, end: "9999-12-31" };
  return { start: "0001-01-01", end: t! };
}

function moveInPeriodsOverlap(
  customer: Customer,
  property: ListedProperty
): boolean {
  if (customer.nonOccupancy || customer.roomType === "토지") return true;
  const c = moveInDayRange(
    customer.moveInFrom,
    customer.moveInTo,
    customer.moveInSingle
  );
  const p = moveInDayRange(
    property.moveInFrom,
    property.moveInTo,
    property.moveInSingle
  );
  if (!c || !p) return true;
  return c.start <= p.end && p.start <= c.end;
}

function amountFits(
  propertyAmount: number | undefined,
  customerFrom: number | undefined,
  customerTo: number | undefined,
  customerSingle?: boolean
): boolean {
  if (typeof propertyAmount !== "number") return true;
  const bounds = rangeBounds(customerFrom, customerTo, customerSingle);
  if (!bounds) return true;
  const lo = bounds.min * AMOUNT_MIN_RATIO;
  const hi = bounds.max * AMOUNT_MAX_RATIO;
  if (bounds.max <= 0) return true;
  return propertyAmount >= lo && propertyAmount <= hi;
}

function effectiveRoomCount(
  roomType: RoomType | string | undefined,
  roomCount?: number
): number | null {
  const type = normalizeRoomType(roomType) ?? roomType;
  if (type === "원룸") return 1;
  if (type === "투룸") return 2;
  if (type === "3룸+" || type === "아파트" || type === "오피스텔") {
    if (typeof roomCount === "number" && roomCount > 0) return roomCount;
    return null;
  }
  return null;
}

function isVillaLike(
  type: RoomType | string | undefined
): type is "원룸" | "투룸" | "3룸+" {
  return type === "원룸" || type === "투룸" || type === "3룸+";
}

function roomTypesCompatible(
  customer: Customer,
  property: ListedProperty
): boolean {
  const cType = normalizeRoomType(customer.roomType) ?? customer.roomType;
  const pType = normalizeRoomType(property.roomType) ?? property.roomType;
  if (!cType || !pType) return true;

  if (cType === "건물" && customer.buildingKind && property.buildingKind) {
    const cKind = normalizeBuildingKind(customer.buildingKind);
    const pKind = normalizeBuildingKind(property.buildingKind);
    if (cKind && pKind && cKind !== pKind) return false;
  }

  if (cType === pType) {
    if (cType === "아파트" || cType === "오피스텔" || cType === "3룸+" || cType === "투룸") {
      const cr = effectiveRoomCount(cType, customer.roomCount);
      const pr = effectiveRoomCount(pType, property.roomCount);
      if (cr && pr) return cr === pr;
    }
    return true;
  }

  const villaToApt =
    (isVillaLike(cType) && pType === "아파트") ||
    (isVillaLike(pType) && cType === "아파트");
  if (!villaToApt) return false;

  const cr = effectiveRoomCount(cType, customer.roomCount);
  const pr = effectiveRoomCount(pType, property.roomCount);
  if (!cr || !pr) return false;
  return cr === pr;
}

function wantsYesFits(
  customerWant?: string | null,
  propertyHas?: boolean | string | null
): boolean {
  if (customerWant !== "유") return true;
  if (propertyHas == null || propertyHas === "") return true;
  if (propertyHas === true || propertyHas === "유") return true;
  return false;
}

export function propertyMatchesCustomer(
  customer: Customer,
  property: ListedProperty
): boolean {
  if (property.contractCompleted) return false;
  if (property.dealType !== customer.dealType) return false;
  if (!roomTypesCompatible(customer, property)) return false;
  if (!amountFits(property.deposit, customer.deposit, customer.depositTo, customer.depositSingle)) return false;
  if (customer.dealType === "월세") {
    if (!amountFits(property.monthlyRent, customer.monthlyRent, customer.monthlyRentTo, customer.monthlyRentSingle)) return false;
  }
  if (!moveInPeriodsOverlap(customer, property)) return false;
  if (needsLoanFlag(customer.roomType) && !wantsYesFits(resolveCustomerLoanNeeded(customer), property.loanAvailable)) return false;
  if (needsJeonseInsurance(customer.dealType, customer.roomType) && !wantsYesFits(customer.insuranceNeeded, isInsuranceJoined(property.insuranceType) ? "유" : property.insuranceType)) return false;
  if (!wantsYesFits(customer.parkingType, property.parkingType)) return false;
  if (!wantsYesFits(customer.elevatorNeeded, property.elevator)) return false;
  return true;
}

// ─────────────────────────────────────────────
// 점수 시스템 — 매칭 리스트 정렬용
// ─────────────────────────────────────────────

/**
 * 호실 문자열에서 층수를 파싱.
 * 앞자리 숫자가 층수인 국내 호실 관례(예: 1201호 → 12층, 301호 → 3층)를 따름.
 * 파싱 실패 시 null 반환.
 */
function parseFloorFromRoomNo(roomNo?: string): number | null {
  if (!roomNo) return null;
  const digits = roomNo.replace(/[^0-9]/g, "");
  if (digits.length < 3) return null;
  // 4자리: 앞 2자리가 층(예: 1201 → 12), 3자리: 앞 1자리가 층(예: 301 → 3)
  if (digits.length >= 4) return parseInt(digits.slice(0, digits.length - 2), 10) || null;
  return parseInt(digits.slice(0, 1), 10) || null;
}

/**
 * 임대인 전환율(보증금 → 월세 산정 기준).
 * 아파트: 연 3~4%(중간값 3.5%), 일반: 연 4~5%(중간값 4.5%).
 * 월 환산 시 /12.
 */
function monthlyConversionRate(roomType?: string | null): number {
  const t = normalizeRoomType(roomType) ?? roomType;
  if (t === "아파트") return 0.035 / 12; // 연 3.5% → 월
  return 0.045 / 12; // 연 4.5% → 월
}

/**
 * 점수 클램프 유틸.
 */
function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/**
 * 금액 근접도 점수 (0~1).
 * - 매물이 희망보다 낮으면 최고점.
 * - 초과 시 가파르게 감점.
 * - 극단(너무 낮거나 너무 높음)은 급락.
 */
function depositScore(
  propertyDeposit: number,
  customerMin: number,
  customerMax: number
): number {
  if (customerMax <= 0) return 0.8;
  // 너무 낮음(40% 미만): 급락
  if (propertyDeposit < customerMin * 0.4) return 0.05;
  // 희망 이하: 낮을수록 좋음(최고점)
  if (propertyDeposit <= customerMax) {
    const ratio = propertyDeposit / customerMax;
    // 70% ~ 100%: 0.85~1.0
    if (ratio >= 0.7) return 0.85 + (ratio - 0.7) / 0.3 * 0.15;
    // 40% ~ 70%: 0.6~0.85
    return 0.6 + (ratio - 0.4) / 0.3 * 0.25;
  }
  // 희망 초과: 가파르게 감점
  const overRatio = (propertyDeposit - customerMax) / customerMax;
  // 10% 초과까지는 완만하게
  if (overRatio <= 0.1) return 0.75 - overRatio * 1.5;
  // 30% 초과: 급락
  if (overRatio <= 0.3) return 0.60 - (overRatio - 0.1) * 2.0;
  return Math.max(0.05, 0.20 - (overRatio - 0.3) * 1.0);
}

/**
 * 월세 근접도 점수 (0~1).
 * - 75% 미만: 퀄리티 의심(급락)
 * - 110% 초과: 부담(급락)
 * - 그 사이: 희망에 가까울수록 높은 점수
 */
function monthlyRentScore(
  propertyRent: number,
  customerMin: number,
  customerMax: number
): number {
  if (customerMax <= 0) return 0.8;
  const mid = (customerMin + customerMax) / 2;
  if (mid <= 0) return 0.8;
  const ratio = propertyRent / mid;
  // 너무 낮음(75% 미만): 퀄리티 하락 급락
  if (ratio < 0.75) return Math.max(0.05, 0.3 * (ratio / 0.75));
  // 너무 높음(110% 초과): 부담 급락
  if (ratio > 1.1) return Math.max(0.05, 0.5 - (ratio - 1.1) * 2.0);
  // 정상 구간(75%~110%): 중간(100%)이 최고점
  const dist = Math.abs(ratio - 1.0);
  return 1.0 - dist * 1.5;
}

/**
 * 반전세 여부 판정 및 연이자율 점수.
 * 보증금 8천~1.4억, 월세 30~55만 구간.
 * 연이자율(= 월세*12/보증금) 1.8% 이하면 가점, 초과면 감점.
 */
function halfJeonseAnnualRateScore(
  deposit: number,
  monthlyRent: number
): number | null {
  // 반전세 구간 탐지 (만원 단위: 8000~14000, 월세 30~55만)
  if (deposit < 8000 || deposit > 14000) return null;
  if (monthlyRent < 30 || monthlyRent > 55) return null;
  const annualRate = (monthlyRent * 12) / deposit;
  if (annualRate <= 0.018) return 1.0; // 버팀목/중기청 금리 이하: 최고점
  if (annualRate <= 0.025) return 0.7 - (annualRate - 0.018) / 0.007 * 0.3;
  return Math.max(0.1, 0.4 - (annualRate - 0.025) * 5.0);
}

/**
 * 보증금-월세 총부담 환산 점수 (월세 고객용).
 * 임대인 전환율 기준으로 총부담(보증금×전환율+월세)을 환산해 비교.
 */
function totalBurdenScore(
  customer: Customer,
  property: ListedProperty
): number {
  const cDeposit = customer.deposit ?? 0;
  const cRent = customer.monthlyRent ?? 0;
  const pDeposit = property.deposit ?? 0;
  const pRent = property.monthlyRent ?? 0;
  if (cDeposit <= 0 && cRent <= 0) return 0.5;

  const rate = monthlyConversionRate(property.roomType);
  const customerBurden = cDeposit * rate + cRent;
  const propertyBurden = pDeposit * rate + pRent;
  if (customerBurden <= 0) return 0.5;

  const ratio = propertyBurden / customerBurden;
  // 총부담 낮을수록 좋음 (보증금↑ 월세↓ 선호 반영)
  if (ratio <= 0.9) return 1.0;
  if (ratio <= 1.0) return 0.85 + (1.0 - ratio) / 0.1 * 0.15;
  if (ratio <= 1.1) return 0.85 - (ratio - 1.0) / 0.1 * 0.25;
  if (ratio <= 1.3) return 0.60 - (ratio - 1.1) / 0.2 * 0.25;
  return Math.max(0.05, 0.35 - (ratio - 1.3) * 1.0);
}

/**
 * 대출 상한 임계값 점수.
 * 버팀목 기준: 2억 이하 → 대출 커버 가능(가점), 3억 초과 → 불가(급락).
 * 구간 경계를 선형 보간해 연속 점수로 세분화.
 */
function loanThresholdScore(deposit: number, dealType: string): number {
  if (dealType === "매매") {
    if (deposit <= 20000) return 0.90;
    if (deposit <= 30000) return 0.90 - ((deposit - 20000) / 10000) * 0.15; // 0.90→0.75
    return Math.max(0.40, 0.75 - ((deposit - 30000) / 20000) * 0.35); // 0.75→0.40
  }
  // 전세·반전세·월세: 버팀목 대출 상한 기준
  if (deposit <= 20000) return 1.00;
  if (deposit <= 30000) return 1.00 - ((deposit - 20000) / 10000) * 0.25; // 1.00→0.75
  return Math.max(0.20, 0.75 - ((deposit - 30000) / 20000) * 0.55); // 0.75→0.20
}

/**
 * 엘베 점수.
 * 고객이 유를 원할 때:
 *   - 엘베 있음: 최고점
 *   - 엘베 없음 + 층수 4층 이상: 급락
 *   - 엘베 없음 + 층수 3층 이하: 낮은 감점
 *   - 엘베 없음 + 층수 불명: 중간 감점
 * 고객이 무/미입력: 중립
 */
function elevatorScore(customer: Customer, property: ListedProperty): number {
  if (customer.elevatorNeeded !== "유") return 0.50;
  if (property.elevator === true) return 1.00;
  if (property.elevator === false) {
    const floor = parseFloorFromRoomNo(property.roomNo);
    if (floor === null) return 0.25;
    // 4층 이상: 층수가 높을수록 더 급락 (4층=0.10, 10층=0.02)
    if (floor >= 4) return Math.max(0.02, 0.14 - (floor - 4) * 0.02);
    // 1~3층: 낮을수록 덜 불편 (1층=0.50, 3층=0.38)
    return 0.50 - (floor - 1) * 0.06;
  }
  return 0.28; // 미기재
}

/**
 * 주차 점수.
 * 고객이 유를 원할 때:
 *   - 매물 유: 최고점
 *   - 매물 무: 급락
 *   - 미기재: 중간 감점
 * 고객이 무/미입력: 중립
 */
function parkingScore(customer: Customer, property: ListedProperty): number {
  if (customer.parkingType !== "유") return 0.5;
  if (property.parkingType === "유") return 1.0;
  if (property.parkingType === "무") return 0.05;
  return 0.3; // 미기재
}

/**
 * 대출 가능 점수.
 * 고객이 대출 필요:
 *   - 매물 유: 최고점
 *   - 매물 무: 급락(위반건축물 포함)
 *   - 미기재: 중간 감점
 * 고객이 대출 불필요/미입력: 중립
 */
function loanAvailableScore(customer: Customer, property: ListedProperty): number {
  if (!needsLoanFlag(customer.roomType)) return 0.5;
  const loanNeeded = resolveCustomerLoanNeeded(customer);
  if (loanNeeded !== "유") return 0.5;
  if (property.loanAvailable === "유") return 1.0;
  if (property.loanAvailable === "무") return 0.05;
  return 0.3; // 미기재
}

/**
 * 전세보증보험 점수.
 * 전세 + 해당 유형일 때만 의미.
 * 고객이 유:
 *   - 매물 가입: 최고점
 *   - 매물 미가입: 급락
 *   - 미기재: 중간 감점
 */
function insuranceScore(customer: Customer, property: ListedProperty): number {
  if (!needsJeonseInsurance(customer.dealType, customer.roomType)) return 0.5;
  if (customer.insuranceNeeded !== "유") return 0.5;
  if (isInsuranceJoined(property.insuranceType)) return 1.0;
  if (property.insuranceType === "무" || property.insuranceType === "미가입") return 0.05;
  return 0.3; // 미기재
}

/**
 * 입주일 점수.
 * - 공실: 최고점
 * - 협의가능: 가점
 * - 날짜 겹침: 근접할수록 가점
 * - 미입력: 중립
 */
function moveInScore(customer: Customer, property: ListedProperty): number {
  if (customer.nonOccupancy || customer.roomType === "토지") return 0.8;
  if (property.moveInVacant) return 1.0;
  if (property.moveInNegotiable) return 0.85;
  const overlaps = moveInPeriodsOverlap(customer, property);
  if (!overlaps) return 0.1;
  // 날짜가 정확히 맞으면 더 높은 점수
  const c = moveInDayRange(customer.moveInFrom, customer.moveInTo, customer.moveInSingle);
  const p = moveInDayRange(property.moveInFrom, property.moveInTo, property.moveInSingle);
  if (!c || !p) return 0.7;
  // 고객 희망 시작일과 매물 입주 가능일의 차이(일)
  const cStart = new Date(c.start).getTime();
  const pStart = new Date(p.start).getTime();
  const diffDays = Math.abs(cStart - pStart) / (1000 * 60 * 60 * 24);
  if (diffDays <= 7) return 0.95;
  if (diffDays <= 30) return 0.85;
  if (diffDays <= 60) return 0.75;
  return 0.65;
}

/**
 * 전세 금액 점수 (보증금 단독, 목돈 예민).
 */
function jeonseAmountScore(customer: Customer, property: ListedProperty): number {
  const cMin = customer.deposit ?? 0;
  const cMax = customer.depositTo ?? cMin;
  const pDep = property.deposit ?? 0;
  const depScore = depositScore(pDep, cMin, Math.max(cMin, cMax));
  const ltScore = loanThresholdScore(pDep, "전세");
  return depScore * 0.7 + ltScore * 0.3;
}

/**
 * 월세 금액 점수.
 * 보증금 + 월세 연동, 총부담 환산, 반전세 특이케이스 포함.
 */
function wolseAmountScore(customer: Customer, property: ListedProperty): number {
  const cDepMin = customer.deposit ?? 0;
  const cDepMax = customer.depositTo ?? cDepMin;
  const cRentMin = customer.monthlyRent ?? 0;
  const cRentMax = customer.monthlyRentTo ?? cRentMin;
  const pDep = property.deposit ?? 0;
  const pRent = property.monthlyRent ?? 0;

  // 반전세 특이케이스 확인
  const halfScore = halfJeonseAnnualRateScore(pDep, pRent);
  if (halfScore !== null) {
    // 반전세 구간: 연이자율 점수 우선
    const ltScore = loanThresholdScore(pDep, "월세");
    return halfScore * 0.5 + ltScore * 0.5;
  }

  // 일반 월세: 보증금(예민) + 월세(완화) + 총부담 환산
  const depScore = depositScore(pDep, cDepMin, Math.max(cDepMin, cDepMax));
  const rentScore = monthlyRentScore(pRent, cRentMin, Math.max(cRentMin, cRentMax));
  const burdenScore = totalBurdenScore(customer, property);
  const ltScore = loanThresholdScore(pDep, "월세");

  // 보증금 예민(40%) + 월세 완화(20%) + 총부담(25%) + 대출상한(15%)
  return depScore * 0.40 + rentScore * 0.20 + burdenScore * 0.25 + ltScore * 0.15;
}

/**
 * 매매 금액 점수 (구매심리 — 허용폭 큼).
 */
function maeamaeAmountScore(customer: Customer, property: ListedProperty): number {
  const cMin = customer.deposit ?? 0;
  const cMax = customer.depositTo ?? cMin;
  const pDep = property.deposit ?? 0;
  if (cMax <= 0) return 0.7;
  const ratio = pDep / Math.max(cMin, cMax);
  // 허용폭 넓게: ±30% 구간은 완만 감점
  if (ratio <= 1.0) return Math.max(0.5, 0.95 - (1.0 - ratio) * 0.3);
  if (ratio <= 1.3) return Math.max(0.2, 0.95 - (ratio - 1.0) * 1.5);
  return Math.max(0.05, 0.5 - (ratio - 1.3) * 1.0);
}

/**
 * 금액 점수 — 거래유형별 분기.
 */
function amountScore(customer: Customer, property: ListedProperty): number {
  if (customer.dealType === "전세") return jeonseAmountScore(customer, property);
  if (customer.dealType === "월세") return wolseAmountScore(customer, property);
  return maeamaeAmountScore(customer, property);
}

/**
 * 매물 유형 선호도 점수 (0~1).
 * 아파트 > 오피스텔 > 빌라(원룸/투룸/3룸+) 선호 순위 반영.
 * 고객이 원한 유형과 다른 유형이 매칭됐을 때 패널티 부여.
 * 유형 미입력이거나 같으면 최고점.
 */
function roomTypePreferenceScore(customer: Customer, property: ListedProperty): number {
  const cType = normalizeRoomType(customer.roomType) ?? customer.roomType;
  const pType = normalizeRoomType(property.roomType) ?? property.roomType;
  if (!cType || !pType || cType === pType) return 1.0;

  // 고객이 원룸·투룸·3룸+ 희망
  if (cType === "원룸" || cType === "투룸" || cType === "3룸+") {
    if (pType === "오피스텔") return 0.6; // 감안 가능 확률 50~60%
    if (pType === "아파트") return 0.5;   // 가격이 월등히 높아 금액에서 이미 걸림
    return 0.7; // 동일 빌라류 간(원룸↔투룸 등): 방수 필터에서 이미 처리됐으므로 중립
  }
  // 고객이 오피스텔 희망
  if (cType === "오피스텔") {
    if (pType === "아파트") return 0.6;
    if (pType === "원룸" || pType === "투룸" || pType === "3룸+") return 0.55;
    return 0.7;
  }
  // 고객이 아파트 희망
  if (cType === "아파트") {
    if (pType === "오피스텔") return 0.5;
    if (pType === "원룸" || pType === "투룸" || pType === "3룸+") return 0.4;
    return 0.7;
  }
  return 0.7; // 상가·사무실·토지·건물 등 특수 유형: 중립
}

/**
 * 메모(notes)에서 준공연도/연식을 파싱.
 * 패턴: "2015년 준공", "15년식", "신축", "구축", "2010년 건축", "입주 2018년" 등.
 * 파싱 실패 시 null 반환.
 */
function parseBuildYearFromNotes(notes?: string): number | null {
  if (!notes) return null;
  const currentYear = new Date().getFullYear();

  // "신축" → 현재연도로 처리
  if (/신축/.test(notes)) return currentYear;
  // "구축" → 명시 연도 없이 "오래됨" 신호. null 반환 후 구축 감점은 별도 처리
  // 4자리 연도 패턴: 1970~현재연도
  const fullYear = notes.match(/\b(19[7-9]\d|20[0-2]\d)\b/);
  if (fullYear) {
    const y = parseInt(fullYear[1], 10);
    if (y >= 1970 && y <= currentYear) return y;
  }
  // 2자리 연식: "15년식", "98년식" 등
  const shortYear = notes.match(/\b(\d{2})년\s*식/);
  if (shortYear) {
    const yy = parseInt(shortYear[1], 10);
    // 00~현재연도 뒷2자리: 2000년대, 나머지 1900년대
    const pivot = currentYear % 100;
    return yy <= pivot ? 2000 + yy : 1900 + yy;
  }
  return null;
}

/**
 * 연식(준공연도) 점수 (0~1).
 * 메모에서 파싱한 준공연도 기준.
 * - 신축급 기준: 7년 이내
 * - 오래될수록 점수 하락 (사람마다 다르므로 완만하게)
 * - "구축" 명시: 감점
 * - "신축" 명시: 7년 이내 기준 최고점
 * - 미파싱: 중립
 */
function buildYearScore(property: ListedProperty): number {
  const notes = property.notes ?? "";
  if (/구축/.test(notes) && !/신축/.test(notes)) return 0.40;
  if (/신축/.test(notes)) return 1.0;

  const year = parseBuildYearFromNotes(notes);
  if (year === null) return 0.65;

  const age = Math.max(0, new Date().getFullYear() - year);
  // 구간 선형 보간으로 연속 점수
  if (age <= 3)  return 1.00;
  if (age <= 7)  return 1.00 - ((age - 3)  / 4)  * 0.08; // 1.00→0.92
  if (age <= 10) return 0.92 - ((age - 7)  / 3)  * 0.10; // 0.92→0.82
  if (age <= 15) return 0.82 - ((age - 10) / 5)  * 0.12; // 0.82→0.70
  if (age <= 20) return 0.70 - ((age - 15) / 5)  * 0.12; // 0.70→0.58
  if (age <= 30) return 0.58 - ((age - 20) / 10) * 0.10; // 0.58→0.48
  return Math.max(0.25, 0.48 - (age - 30) * 0.008);
}

/**
 * 평수(usableArea) 점수 (0~1).
 * 유형별 기준 평수보다 작으면 약가점(신규 가능성),
 * 기준보다 크면 약감점(구형 가능성).
 * usableArea 미입력 시 중립.
 */
function areaSizeScore(property: ListedProperty): number {
  const area = property.usableArea;
  if (area == null || area <= 0) return 0.7; // 미입력 중립

  const pType = normalizeRoomType(property.roomType) ?? property.roomType;
  // 유형별 기준 평수
  const baseline: Record<string, number> = {
    원룸: 10,
    투룸: 15,
    "3룸+": 20,
    오피스텔: 10,
    아파트: 25,
    상가: 20,
    사무실: 20,
  };
  const base = pType ? (baseline[pType] ?? 20) : 20;
  const ratio = area / base;

  // 기준보다 작음: 약가점(신규 가능성)
  if (ratio < 1.0) {
    // 너무 작으면(50% 미만): 중립으로 복귀
    if (ratio < 0.5) return 0.65;
    return 0.75 + (1.0 - ratio) * 0.1; // 0.75~0.85
  }
  // 기준보다 큼: 약감점(구형 가능성)
  if (ratio <= 1.3) return 0.70 - (ratio - 1.0) * 0.15; // 0.70~0.655
  if (ratio <= 2.0) return 0.655 - (ratio - 1.3) * 0.15;
  return Math.max(0.4, 0.655 - (ratio - 1.3) * 0.15);
}

/**
 * 반려동물 점수 (0~1).
 * 매물 notes에서 불가 여부를 파싱.
 * - "불가/강아지 불가/고양이 불가" 명시 → 반려동물 있는 고객 급락
 * - "가능" 명시 → 가점
 * - 아무 표시 없음 → 가능 확률 약 30% → 중간 감점
 * 고객 petAllowed가 "무"이거나 매물 타입 무관이면 중립
 */
function petScore(customer: Customer, property: ListedProperty): number {
  if (customer.petAllowed !== "유") return 0.5; // 고객 반려동물 없음: 중립
  const notes = (property.notes ?? "").toLowerCase();
  const notAllowed = /반려동물\s*불가|강아지\s*불가|고양이\s*불가|애완\s*불가|펫\s*불가|pet\s*no/i.test(notes);
  const allowed = /반려동물\s*가능|강아지\s*가능|고양이\s*가능|펫\s*가능|pet\s*ok|애완\s*가능/i.test(notes);
  // 매물 필드(petAllowed)도 확인
  if (property.petAllowed === "유" || allowed) return 1.0;
  if (property.petAllowed === "무" || notAllowed) return 0.05; // 불가 급락
  return 0.30; // 미표기: 가능 확률 30%
}

/**
 * 선호 동 점수 (0~1).
 * 고객이 preferredDongs를 입력한 경우:
 * - 매물 주소가 선호 동에 포함 → 최고점
 * - 선호 동 미입력 → 중립
 * - 불일치 → 감점 크게
 */
function preferredDongScore(customer: Customer, property: ListedProperty): number {
  const dongs = customer.preferredDongs;
  if (!dongs || dongs.length === 0) return 0.7; // 중립
  const addr = property.address ?? "";
  const match = dongs.some((d) => {
    // "구|동" 형식에서 동만 추출해 주소에 포함되는지 확인
    const dong = d.includes("|") ? d.split("|")[1] : d;
    return dong ? addr.includes(dong) : false;
  });
  if (match) return 1.0;
  return 0.15; // 다른 동네: 감점 크게
}

/**
 * 필수 축(주차·대출·보험·엘베) 합산 점수 (0~1).
 */
function requiredAxisScore(customer: Customer, property: ListedProperty): number {
  const elev = elevatorScore(customer, property);
  const park = parkingScore(customer, property);
  const loan = loanAvailableScore(customer, property);
  const ins = insuranceScore(customer, property);
  // 가중치: 엘베(30%) + 주차(30%) + 대출(25%) + 보험(15%)
  return elev * 0.30 + park * 0.30 + loan * 0.25 + ins * 0.15;
}

/**
 * 매물 → 고객 종합 점수 (0~100).
 *
 * 가중치:
 *   - 금액(거래유형별 곡선): 44%
 *   - 필수 축(엘베·주차·대출·보험): 30%
 *   - 입주일: 12%
 *   - 반려동물: 5%
 *   - 선호 동: 4%
 *   - 매물유형 선호도: 2%
 *   - 연식(메모 파싱): 2%
 *   - 평수: 1%
 */
export function scorePropertyForCustomer(
  customer: Customer,
  property: ListedProperty
): number {
  const amount = amountScore(customer, property);
  const required = requiredAxisScore(customer, property);
  const moveIn = moveInScore(customer, property);
  const pet = petScore(customer, property);
  const dong = preferredDongScore(customer, property);
  const typePref = roomTypePreferenceScore(customer, property);
  const buildYear = buildYearScore(property);
  const area = areaSizeScore(property);
  const raw =
    amount * 0.44 +
    required * 0.30 +
    moveIn * 0.12 +
    pet * 0.05 +
    dong * 0.04 +
    typePref * 0.02 +
    buildYear * 0.02 +
    area * 0.01;
  return Math.round(clamp(raw, 0, 1) * 10000) / 100; // 소수점 2자리 (0.00~100.00)
}

// ─────────────────────────────────────────────
// 동적 임계값: 매물 수에 따라 후보군 금액 오차 확대
// ─────────────────────────────────────────────

/**
 * 단계별 금액 허용 비율.
 * 1단계(기본): 후보 3개 이상
 * 2단계(확장): 후보 1~2개
 * 3단계(최대): 후보 0개
 */
function amountFitsWithExpansion(
  propertyAmount: number | undefined,
  customerFrom: number | undefined,
  customerTo: number | undefined,
  customerSingle: boolean | undefined,
  expansion: number
): boolean {
  if (typeof propertyAmount !== "number") return true;
  const bounds = rangeBounds(customerFrom, customerTo, customerSingle);
  if (!bounds || bounds.max <= 0) return true;
  const lo = bounds.min * (AMOUNT_MIN_RATIO - expansion);
  const hi = bounds.max * (AMOUNT_MAX_RATIO + expansion);
  return propertyAmount >= lo && propertyAmount <= hi;
}

/**
 * 확장 단계 적용 후보 필터.
 * 0: 기본, 0.1: 확장, 0.2: 최대
 */
function candidatesAtExpansion(
  customer: Customer,
  properties: ListedProperty[],
  expansion: number
): ListedProperty[] {
  return properties.filter((p) => {
    if (p.contractCompleted) return false;
    if (p.dealType !== customer.dealType) return false;
    if (!roomTypesCompatible(customer, p)) return false;
    if (!amountFitsWithExpansion(p.deposit, customer.deposit, customer.depositTo, customer.depositSingle, expansion)) return false;
    if (customer.dealType === "월세") {
      if (!amountFitsWithExpansion(p.monthlyRent, customer.monthlyRent, customer.monthlyRentTo, customer.monthlyRentSingle, expansion)) return false;
    }
    // ── 필수 조건 하드 필터 ──
    // "무(無)" 명시 매물만 제외. 미기재는 점수만 낮게 유지.
    // 주차: 고객이 유 필요 + 매물이 무 → 제외
    if (customer.parkingType === "유" && p.parkingType === "무") return false;
    // 대출: 고객이 대출 필요 + 매물이 무 → 제외
    if (needsLoanFlag(customer.roomType) && resolveCustomerLoanNeeded(customer) === "유" && p.loanAvailable === "무") return false;
    // 전세보증보험: 고객이 유 필요 + 매물이 미가입/무 → 제외
    if (needsJeonseInsurance(customer.dealType, customer.roomType) && customer.insuranceNeeded === "유" &&
        (p.insuranceType === "무" || p.insuranceType === "미가입")) return false;
    return true;
  });
}

/**
 * 동적 임계값을 적용한 후보군.
 * 기본 후보가 3개 미만이면 자동으로 금액 오차를 확대해 재검색.
 */
function dynamicCandidates(
  customer: Customer,
  properties: ListedProperty[]
): ListedProperty[] {
  let candidates = candidatesAtExpansion(customer, properties, 0);
  if (candidates.length >= 3) return candidates;
  // 2단계 확장
  candidates = candidatesAtExpansion(customer, properties, 0.1);
  if (candidates.length >= 1) return candidates;
  // 3단계 최대 확장
  return candidatesAtExpansion(customer, properties, 0.2);
}

// ─────────────────────────────────────────────
// 공개 API — 기존 인터페이스 유지 + 점수 정렬 추가
// ─────────────────────────────────────────────

export function findMatchingProperties(
  customer: Customer,
  properties: ListedProperty[]
): ListedProperty[] {
  return properties
    .filter((p) => propertyMatchesCustomer(customer, p))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

/** 추천 매물 최대 노출 수 */
const MAX_SCORED_RESULTS = 10;

/**
 * 입주일이 현재보다 이미 지난 매물인지 판정.
 * 공실·협의가능은 항상 유효. 날짜가 있으면 오늘 이후여야 함.
 */
function isMoveInExpired(property: ListedProperty): boolean {
  if (property.moveInVacant || property.moveInNegotiable) return false;
  const from = parseDay(property.moveInFrom);
  if (!from) return false;
  const today = new Date().toISOString().slice(0, 10);
  return from < today;
}

/**
 * 점수 배열의 중간값(median).
 */
function median(scores: number[]): number {
  if (scores.length === 0) return 0;
  const sorted = [...scores].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * 점수 기반 정렬 매칭 (화면 표시용).
 *
 * 적용 순서:
 * 1. 동적 임계값으로 후보군 생성
 * 2. 입주일이 이미 지난 매물 제외
 * 3. 점수 내림차순 정렬
 * 4. 중간값 이상인 매물만 유지
 *    (더 나은 매물이 있으면 낮은 점수 매물 제한)
 * 5. 최대 MAX_SCORED_RESULTS개로 상한
 */
export function findMatchingPropertiesScored(
  customer: Customer,
  properties: ListedProperty[]
): ListedProperty[] {
  const candidates = dynamicCandidates(customer, properties)
    .filter((p) => !isMoveInExpired(p));

  const scored = candidates
    .map((p) => ({ p, score: scorePropertyForCustomer(customer, p) }))
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return [];

  // 중간값 계산 후 중간값 이상만 유지
  // (매물이 3개 이하면 중간값 필터 적용 안 함 — 너무 빨리 제거 방지)
  if (scored.length > 3) {
    const med = median(scored.map((s) => s.score));
    const filtered = scored.filter((s) => s.score >= med);
    return filtered.slice(0, MAX_SCORED_RESULTS).map(({ p }) => p);
  }

  return scored.slice(0, MAX_SCORED_RESULTS).map(({ p }) => p);
}

/**
 * 내 리스트 매물 + (향후) 사이트내공유 매물 매칭.
 * - own: 내가 등록한 매물 전부(협력부동산 태그 포함)
 * - partner: 다른 계정 사이트내공유 매물 — 현재 비활성
 */
export function findMatchingPropertiesGrouped(
  customer: Customer,
  myProperties: ListedProperty[],
  crossMemberProperties: ListedProperty[] = []
): {
  own: ListedProperty[];
  partner: ListedProperty[];
} {
  const own = findMatchingPropertiesScored(customer, myProperties);
  if (!CROSS_MEMBER_PROPERTY_MATCH_ENABLED) return { own, partner: [] };
  const ownIds = new Set(own.map((p) => p.id));
  const partner = findMatchingPropertiesScored(customer, crossMemberProperties).filter(
    (p) => !ownIds.has(p.id)
  );
  return { own, partner };
}

export function findMatchingCustomers(
  property: ListedProperty,
  customers: Customer[]
): Customer[] {
  return customers
    .filter((c) => !c.contractCompleted && propertyMatchesCustomer(c, property))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

/**
 * 점수 기반 고객 정렬 (화면 표시용).
 * 매물 기준으로 고객 조건 근접도를 점수화해 정렬.
 */
export function findMatchingCustomersScored(
  property: ListedProperty,
  customers: Customer[]
): Customer[] {
  const eligible = customers.filter(
    (c) => !c.contractCompleted && propertyMatchesCustomer(c, property)
  );
  return eligible
    .map((c) => ({ c, score: scorePropertyForCustomer(c, property) }))
    .sort((a, b) => b.score - a.score)
    .map(({ c }) => c);
}

/**
 * 내 고객 + (향후) 사이트내공유 고객 매칭.
 * - own: 내가 등록한 고객
 * - partner: 다른 계정 사이트내공유 고객 — 현재 비활성
 */
export function findMatchingCustomersGrouped(
  property: ListedProperty,
  myCustomers: Customer[],
  crossMemberCustomers: Customer[] = []
): {
  own: Customer[];
  partner: Customer[];
} {
  const own = findMatchingCustomersScored(property, myCustomers);
  if (!CROSS_MEMBER_PROPERTY_MATCH_ENABLED) return { own, partner: [] };
  const ownIds = new Set(own.map((c) => c.id));
  const partner = findMatchingCustomersScored(property, crossMemberCustomers).filter(
    (c) => !ownIds.has(c.id)
  );
  return { own, partner };
}

