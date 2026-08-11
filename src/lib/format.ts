/** 숫자만 추출 (휴대폰 최대 11자리) */
export function onlyDigits(phone: string, max = 11): string {
  return phone.replace(/\D/g, "").slice(0, max);
}

/**
 * 업장명 정규화 — 「부동산」「공인중개사사무소」가 없으면
 * 「공인중개사사무소」를 붙여 저장 (예: 천호동 → 천호동 공인중개사사무소)
 * 미입력·기본값「현장동선」은 그대로 둠 (접미사 붙이지 않음)
 */
export function normalizeShopName(
  raw: string,
  emptyDefault = "현장동선"
): string {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (!trimmed) return emptyDefault;
  if (trimmed === emptyDefault) return trimmed;
  if (
    trimmed.includes("부동산") ||
    trimmed.includes("공인중개사사무소")
  ) {
    return trimmed;
  }
  return `${trimmed} 공인중개사사무소`;
}

/** 이미 저장된 업장명 보정용 — normalizeShopName 과 동일 규칙 */
export function backfillShopName(raw: string | null | undefined): string {
  return normalizeShopName(raw ?? "");
}

/**
 * 입력 중에도 자동 하이픈
 * - 휴대폰: 010-1234-5678
 * - 서울: 02-123-4567 / 02-1234-5678
 * - 기타 지역: 031-123-4567 형태
 */
export function formatPhoneInput(phone: string): string {
  const d = onlyDigits(phone, 11);
  if (!d) return "";

  // 서울 (02)
  if (d.startsWith("02")) {
    if (d.length <= 2) return d;
    if (d.length <= 5) return `${d.slice(0, 2)}-${d.slice(2)}`;
    if (d.length <= 9) {
      return `${d.slice(0, 2)}-${d.slice(2, 5)}-${d.slice(5)}`;
    }
    return `${d.slice(0, 2)}-${d.slice(2, 6)}-${d.slice(6, 10)}`;
  }

  // 휴대폰·지역번호 3자리
  if (d.length <= 3) return d;
  if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7, 11)}`;
}

export function formatPhone(phone: string): string {
  return formatPhoneInput(phone) || phone;
}

export function toTelHref(phone: string): string {
  return `tel:${onlyDigits(phone)}`;
}

/** 검색어가 이름/번호 혼합일 때 번호 부분은 숫자로 비교 */
export function matchesPhoneSearch(phone: string, query: string): boolean {
  const qDigits = onlyDigits(query, 20);
  if (!qDigits) return false;
  return onlyDigits(phone).includes(qDigits);
}

/** 보증금·매매가·월세(만원) 숫자 검색 */
export function matchesBudgetSearch(
  customer: {
    deposit?: number;
    depositTo?: number;
    monthlyRent?: number;
    monthlyRentTo?: number;
    budget?: string;
  },
  query: string
): boolean {
  const digits = query.replace(/\D/g, "");
  if (!digits) return false;
  const n = Number(digits);
  if (typeof customer.deposit === "number") {
    if (customer.deposit === n || String(customer.deposit).includes(digits)) {
      return true;
    }
  }
  if (typeof customer.depositTo === "number") {
    if (
      customer.depositTo === n ||
      String(customer.depositTo).includes(digits)
    ) {
      return true;
    }
  }
  if (typeof customer.monthlyRent === "number") {
    if (
      customer.monthlyRent === n ||
      String(customer.monthlyRent).includes(digits)
    ) {
      return true;
    }
  }
  if (typeof customer.monthlyRentTo === "number") {
    if (
      customer.monthlyRentTo === n ||
      String(customer.monthlyRentTo).includes(digits)
    ) {
      return true;
    }
  }
  if (customer.budget) {
    const budgetDigits = customer.budget.replace(/\D/g, "");
    if (budgetDigits.includes(digits)) return true;
  }
  return false;
}

/**
 * 만원 단위 입력값 표시
 * - 500 → 500만
 * - 1000 → 1000만
 * - 10000 → 1억
 * - 100000 → 10억
 * - 15000 → 1억 5000만
 */
export function formatMoney(amount: number): string {
  if (!amount && amount !== 0) return "-";
  const n = Math.round(amount);
  if (n >= 10000) {
    const eok = Math.floor(n / 10000);
    const man = n % 10000;
    if (man === 0) return `${eok}억`;
    return `${eok}억 ${man}만`;
  }
  return `${n}만`;
}

/**
 * 만원 단위 → 원 단위 표현
 * - 500 → 500만원
 * - 10000 → 1억원
 * - 15000 → 1억 5000만원
 */
export function formatMoneyWon(amount: number): string {
  if (!amount && amount !== 0) return "-";
  const n = Math.round(amount);
  if (n >= 10000) {
    const eok = Math.floor(n / 10000);
    const man = n % 10000;
    if (man === 0) return `${eok}억원`;
    return `${eok}억 ${man}만원`;
  }
  return `${n}만원`;
}

function formatMoneyRange(from: number, to?: number): string {
  if (to != null && to > 0 && to !== from) {
    return `${formatMoney(from)}~${formatMoney(to)}`;
  }
  return formatMoney(from);
}

function formatMoneyWonRange(from: number, to?: number): string {
  if (to != null && to > 0 && to !== from) {
    return `${formatMoneyWon(from)}~${formatMoneyWon(to)}`;
  }
  return formatMoneyWon(from);
}

export function formatDepositRent(
  dealType: string,
  deposit: number,
  monthlyRent?: number,
  depositTo?: number,
  monthlyRentTo?: number
): string {
  const amount = formatMoneyRange(deposit, depositTo);
  if (dealType === "매매") return `매가 ${amount}`;
  if (dealType === "전세") return `보증금 ${amount}`;
  const rent = formatMoneyRange(monthlyRent ?? 0, monthlyRentTo);
  return `보증금 ${amount} · 월 ${rent}`;
}

/** 고객 카드용: 보증금/월세(또는 매매가) 줄 단위 */
export function getCustomerBudgetLines(customer: {
  dealType: string;
  deposit?: number;
  depositTo?: number;
  monthlyRent?: number;
  monthlyRentTo?: number;
  budget?: string;
}): string[] {
  if (typeof customer.deposit !== "number") {
    return customer.budget ? [customer.budget] : ["-"];
  }
  const amount = formatMoneyWonRange(customer.deposit, customer.depositTo);
  if (customer.dealType === "매매") {
    return [`매매가 ${amount}`];
  }
  const lines = [`보증금 ${amount}`];
  if (customer.dealType === "월세") {
    lines.push(
      `월세 ${formatMoneyWonRange(
        customer.monthlyRent ?? 0,
        customer.monthlyRentTo
      )}`
    );
  }
  return lines;
}

/** 예전 budget 문자열만 있는 고객 데이터 호환 */
export function getCustomerBudgetLabel(customer: {
  dealType: string;
  deposit?: number;
  depositTo?: number;
  depositSingle?: boolean;
  monthlyRent?: number;
  monthlyRentTo?: number;
  monthlyRentSingle?: boolean;
  budget?: string;
}): string {
  if (typeof customer.deposit === "number") {
    const to =
      customer.depositSingle === false
        ? customer.depositTo
        : customer.depositTo != null &&
            customer.depositTo !== customer.deposit
          ? customer.depositTo
          : undefined;
    const rentTo =
      customer.monthlyRentSingle === false
        ? customer.monthlyRentTo
        : customer.monthlyRentTo != null &&
            customer.monthlyRentTo !== customer.monthlyRent
          ? customer.monthlyRentTo
          : undefined;
    return formatDepositRent(
      customer.dealType,
      customer.deposit,
      customer.monthlyRent,
      to,
      rentTo
    );
  }
  return customer.budget || "-";
}

function shortDate(iso?: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${y}년 ${m}월 ${d}일`;
}

export function formatMoveInRange(
  from?: string,
  to?: string,
  fallback?: string
): string {
  if (from && to) {
    if (from === to) return shortDate(from);
    return `${shortDate(from)} ~ ${shortDate(to)}`;
  }
  if (from) return `${shortDate(from)} ~`;
  if (to) return `~ ${shortDate(to)}`;
  return fallback || "-";
}

export function formatKoreanAmPmTime(time: string): string {
  const [hs, ms] = time.split(":").map(Number);
  if (!Number.isFinite(hs)) return time;
  const period = hs < 12 ? "오전" : "오후";
  const hour12 = hs % 12 === 0 ? 12 : hs % 12;
  const minute = Number.isFinite(ms) ? ms : 0;
  if (!minute) return `${period} ${hour12}시`;
  return `${period} ${hour12}시 ${minute}분`;
}

export function formatVisitDateTime(
  date?: string,
  time?: string
): string {
  if (!date && !time) return "-";
  if (date && time) {
    const timeLabel = formatKoreanAmPmTime(time);
    const [y, m, d] = date.split("-").map(Number);
    if (y && m && d) {
      return `${y}년 ${m}월 ${d}일 ${timeLabel}`;
    }
    return `${date} ${timeLabel}`;
  }
  if (date) {
    const [y, m, d] = date.split("-").map(Number);
    if (y && m && d) return `${y}년 ${m}월 ${d}일`;
    return date;
  }
  return time ? formatKoreanAmPmTime(time) : "-";
}

export function getCustomerMoveInLabel(customer: {
  dealType?: string;
  nonOccupancy?: boolean;
  moveInFrom?: string;
  moveInTo?: string;
  moveInDate?: string;
}): string {
  if (customer.dealType === "매매" && customer.nonOccupancy) {
    return "비입주";
  }
  return formatMoveInRange(
    customer.moveInFrom,
    customer.moveInTo,
    customer.moveInDate
  );
}

/** 구데이터 호환: loanNeeded 없으면 loanType으로 유무 추론 */
export function resolveCustomerLoanNeeded(customer: {
  loanNeeded?: "유" | "무";
  loanType?: string;
}): "유" | "무" {
  if (customer.loanNeeded === "유" || customer.loanNeeded === "무") {
    return customer.loanNeeded;
  }
  const t = (customer.loanType ?? "").trim();
  return t && t !== "해당없음" ? "유" : "무";
}

/** 표시용: 무 / 유 · 버팀목 */
export function getCustomerLoanLabel(customer: {
  loanNeeded?: "유" | "무";
  loanType?: string;
}): string {
  const needed = resolveCustomerLoanNeeded(customer);
  if (needed === "무") return "무";
  const kind = (customer.loanType ?? "").trim();
  if (!kind || kind === "해당없음") return "유";
  return `유 · ${kind}`;
}

/** 표시용: 무 / 유 · 세단 */
export function getCustomerParkingLabel(customer: {
  parkingType?: string;
  carType?: string;
}): string {
  if (customer.parkingType !== "유") return "무";
  const car = (customer.carType ?? "").trim();
  return car ? `유 · ${car}` : "유";
}
