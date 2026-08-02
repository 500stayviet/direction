/** 숫자만 추출 (휴대폰 최대 11자리) */
export function onlyDigits(phone: string, max = 11): string {
  return phone.replace(/\D/g, "").slice(0, max);
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
    monthlyRent?: number;
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
  if (typeof customer.monthlyRent === "number") {
    if (
      customer.monthlyRent === n ||
      String(customer.monthlyRent).includes(digits)
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

export function formatDepositRent(
  dealType: string,
  deposit: number,
  monthlyRent?: number
): string {
  if (dealType === "매매") return `매가 ${formatMoney(deposit)}`;
  if (dealType === "전세") {
    if (monthlyRent && monthlyRent > 0) {
      return `보증 ${formatMoney(deposit)} · 월 ${formatMoney(monthlyRent)}`;
    }
    return `보증 ${formatMoney(deposit)}`;
  }
  return `보증 ${formatMoney(deposit)} · 월 ${formatMoney(monthlyRent ?? 0)}`;
}

/** 고객 카드용: 보증금/월세(또는 매매가) 줄 단위 */
export function getCustomerBudgetLines(customer: {
  dealType: string;
  deposit?: number;
  monthlyRent?: number;
  budget?: string;
}): string[] {
  if (typeof customer.deposit !== "number") {
    return customer.budget ? [customer.budget] : ["-"];
  }
  if (customer.dealType === "매매") {
    return [`매매가 ${formatMoneyWon(customer.deposit)}`];
  }
  const lines = [`보증금 ${formatMoneyWon(customer.deposit)}`];
  if (customer.dealType === "월세" || (customer.monthlyRent ?? 0) > 0) {
    lines.push(`월세 ${formatMoneyWon(customer.monthlyRent ?? 0)}`);
  }
  return lines;
}

/** 예전 budget 문자열만 있는 고객 데이터 호환 */
export function getCustomerBudgetLabel(customer: {
  dealType: string;
  deposit?: number;
  monthlyRent?: number;
  budget?: string;
}): string {
  if (typeof customer.deposit === "number") {
    return formatDepositRent(
      customer.dealType,
      customer.deposit,
      customer.monthlyRent
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
