/** 내정보·관리자 요금 표시용 */

export type PlanTier = "free" | "basic_lifetime" | "pro" | string;

export type PlanDisplay = {
  label: string;
  /** 한 줄 설명 (혜택) */
  detail: string;
  /** 무료·혜택 사유 (얼리버드 등) */
  reason?: string;
  tone: "lifetime" | "pro" | "default";
};

export function planDisplayForUser(input: {
  planTier?: PlanTier | null;
  matchingEnabled?: boolean;
  promoSource?: string | null;
}): PlanDisplay | null {
  const tier = (input.planTier ?? "free").trim();
  const source = (input.promoSource ?? "").trim();

  if (tier === "basic_lifetime" || source === "early_bird") {
    const reason =
      source === "early_bird"
        ? "얼리버드 캠페인 혜택"
        : source.startsWith("promo_code:")
          ? `프로모 코드 · ${source.slice("promo_code:".length)}`
          : "프로모션 혜택";
    return {
      label: "기본 · 평생 무료",
      detail: "고객·매물·원터치 네비 평생 무료",
      reason,
      tone: "lifetime",
    };
  }
  if (tier === "pro") {
    return {
      label: "프로",
      detail: "조건 매칭 포함",
      tone: "pro",
    };
  }
  return null;
}
