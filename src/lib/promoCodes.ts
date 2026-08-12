import type { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

export type PromoBenefit = "basic_lifetime_free" | "matching_enabled";

export function isPromoSignupEnabled(): boolean {
  return (process.env.PROMO_SIGNUP_ENABLED ?? "").trim() === "true";
}

export function normalizePromoCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function normalizeReferrerUsername(raw: string): string {
  return raw.trim().replace(/^@+/, "").toLowerCase();
}

export function generatePromoCode(length = 8): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function kstDayStartIso(date: string): string {
  return new Date(`${date}T00:00:00+09:00`).toISOString();
}

function kstDayEndIso(date: string): string {
  return new Date(`${date}T23:59:59.999+09:00`).toISOString();
}

export function promoDateInputFromIso(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

export function promoRangeFromDateInputs(
  from: string,
  to: string
): { startsAt: string; endsAt: string } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return null;
  }
  const startsAt = kstDayStartIso(from);
  const endsAt = kstDayEndIso(to);
  if (startsAt > endsAt) return null;
  return { startsAt, endsAt };
}

export function isPromoActiveNow(
  startsAt: string,
  endsAt: string,
  active: boolean,
  now = Date.now()
): boolean {
  if (!active) return false;
  const start = Date.parse(startsAt);
  const end = Date.parse(endsAt);
  return Number.isFinite(start) && Number.isFinite(end) && now >= start && now <= end;
}

export async function validateReferrerUsername(
  admin: Admin,
  raw: string
): Promise<{ ok: true; username: string; userId: string } | { ok: false; message: string }> {
  const username = normalizeReferrerUsername(raw);
  if (!username) {
    return { ok: false, message: "추천인 아이디를 입력해 주세요." };
  }
  const { data, error } = await admin
    .from("profiles")
    .select("id, username")
    .eq("username", username)
    .maybeSingle();
  if (error) {
    return { ok: false, message: error.message };
  }
  if (!data) {
    return { ok: false, message: "추천인 아이디를 찾을 수 없습니다." };
  }
  return { ok: true, username: String(data.username), userId: String(data.id) };
}

export async function validatePromoCode(
  admin: Admin,
  raw: string
): Promise<
  | {
      ok: true;
      codeId: string;
      code: string;
      benefit: PromoBenefit;
    }
  | { ok: false; message: string }
> {
  const code = normalizePromoCode(raw);
  if (!code) {
    return { ok: false, message: "프로모 코드를 입력해 주세요." };
  }
  const { data, error } = await admin
    .from("promo_codes")
    .select("id, code, benefit, starts_at, ends_at, max_uses, use_count, active")
    .eq("code", code)
    .maybeSingle();
  if (error) {
    return { ok: false, message: error.message };
  }
  if (!data) {
    return { ok: false, message: "유효하지 않은 프로모 코드입니다." };
  }
  if (!isPromoActiveNow(String(data.starts_at), String(data.ends_at), data.active !== false)) {
    return { ok: false, message: "사용 기간이 아닌 프로모 코드입니다." };
  }
  const maxUses = data.max_uses as number | null;
  const useCount = Number(data.use_count ?? 0);
  if (maxUses != null && useCount >= maxUses) {
    return { ok: false, message: "이미 사용이 마감된 프로모 코드입니다." };
  }
  return {
    ok: true,
    codeId: String(data.id),
    code: String(data.code),
    benefit: String(data.benefit) as PromoBenefit,
  };
}

function entitlementsForBenefit(benefit: PromoBenefit): {
  planTier: string;
  matchingEnabled: boolean;
  promoSource: string;
} {
  if (benefit === "matching_enabled") {
    return {
      planTier: "pro",
      matchingEnabled: true,
      promoSource: "promo:matching",
    };
  }
  return {
    planTier: "basic_lifetime",
    matchingEnabled: false,
    promoSource: "promo:basic_lifetime",
  };
}

export async function getActiveEarlyBirdCampaign(admin: Admin) {
  const { data } = await admin
    .from("promo_campaigns")
    .select("id, slug, benefit, starts_at, ends_at, active, memo")
    .eq("slug", "early_bird")
    .maybeSingle();
  if (!data || data.active === false) return null;
  if (!isPromoActiveNow(String(data.starts_at), String(data.ends_at), true)) {
    return null;
  }
  return data;
}

export async function applySignupPromotions(
  admin: Admin,
  input: {
    userId: string;
    newUsername: string;
    referrerUsername?: string;
    promoCode?: string;
  }
): Promise<{ applied: string[]; errors: string[] }> {
  const applied: string[] = [];
  const errors: string[] = [];

  let planTier = "free";
  let matchingEnabled = false;
  let promoSource: string | null = null;

  const earlyBird = await getActiveEarlyBirdCampaign(admin);
  if (earlyBird) {
    const ent = entitlementsForBenefit(
      String(earlyBird.benefit) as PromoBenefit
    );
    planTier = ent.planTier;
    matchingEnabled = ent.matchingEnabled;
    promoSource = "early_bird";
    applied.push("early_bird");
  }

  if (input.promoCode?.trim()) {
    const promo = await validatePromoCode(admin, input.promoCode);
    if (!promo.ok) {
      errors.push(promo.message);
    } else {
      const ent = entitlementsForBenefit(promo.benefit);
      planTier = ent.planTier;
      matchingEnabled = ent.matchingEnabled;
      promoSource = `promo_code:${promo.code}`;

      const { error: redeemErr } = await admin.from("promo_redemptions").insert({
        code_id: promo.codeId,
        user_id: input.userId,
      });
      if (redeemErr) {
        errors.push(redeemErr.message);
      } else {
        const { data: row } = await admin
          .from("promo_codes")
          .select("use_count")
          .eq("id", promo.codeId)
          .maybeSingle();
        await admin
          .from("promo_codes")
          .update({ use_count: Number(row?.use_count ?? 0) + 1 })
          .eq("id", promo.codeId);
        applied.push(`promo:${promo.code}`);
      }
    }
  }

  if (input.referrerUsername?.trim()) {
    const ref = await validateReferrerUsername(admin, input.referrerUsername);
    if (!ref.ok) {
      errors.push(ref.message);
    } else if (ref.username === normalizeReferrerUsername(input.newUsername)) {
      errors.push("본인 아이디는 추천인으로 등록할 수 없습니다.");
    } else {
      const { error: refErr } = await admin.from("referrals").insert({
        referred_user_id: input.userId,
        referrer_username: ref.username,
        referrer_user_id: ref.userId,
      });
      if (refErr) {
        errors.push(refErr.message);
      } else {
        applied.push(`referral:${ref.username}`);
      }
    }
  }

  if (!promoSource && applied.length === 0) {
    return { applied, errors };
  }

  await admin
    .from("profiles")
    .update({
      plan_tier: planTier,
      matching_enabled: matchingEnabled,
      promo_source: promoSource,
    })
    .eq("id", input.userId);

  return { applied, errors };
}
