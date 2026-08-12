-- =============================================================================
-- 현장동선: 프로모 코드 · 추천인 · 요금 플랜
-- =============================================================================

alter table public.profiles
  add column if not exists plan_tier text not null default 'free',
  add column if not exists matching_enabled boolean not null default true,
  add column if not exists promo_source text;

comment on column public.profiles.plan_tier is 'free | basic_lifetime | pro 등';
comment on column public.profiles.matching_enabled is '조건 매칭·사이트 매칭 유료 기능';
comment on column public.profiles.promo_source is 'early_bird | promo_code:CODE | referral 등';

-- 기존 가입자는 매칭 유지
update public.profiles
set matching_enabled = true
where promo_source is null;

create table if not exists public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  benefit text not null default 'basic_lifetime_free',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  max_uses int,
  use_count int not null default 0,
  active boolean not null default true,
  memo text not null default '',
  created_by_name text not null default '',
  created_at timestamptz not null default now(),
  constraint promo_codes_code_unique unique (code),
  constraint promo_codes_code_upper check (code = upper(code))
);

create index if not exists promo_codes_active_idx
  on public.promo_codes (active, starts_at, ends_at);

create table if not exists public.promo_redemptions (
  id uuid primary key default gen_random_uuid(),
  code_id uuid not null references public.promo_codes (id) on delete restrict,
  user_id uuid not null references auth.users (id) on delete cascade,
  redeemed_at timestamptz not null default now(),
  constraint promo_redemptions_user_unique unique (user_id)
);

create index if not exists promo_redemptions_code_idx
  on public.promo_redemptions (code_id);

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referred_user_id uuid not null references auth.users (id) on delete cascade,
  referrer_username text not null,
  referrer_user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint referrals_referred_user_unique unique (referred_user_id)
);

create index if not exists referrals_referrer_username_idx
  on public.referrals (referrer_username);

create table if not exists public.promo_campaigns (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  benefit text not null default 'basic_lifetime_free',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  active boolean not null default true,
  memo text not null default '',
  created_at timestamptz not null default now(),
  constraint promo_campaigns_slug_unique unique (slug)
);

alter table public.promo_codes enable row level security;
alter table public.promo_redemptions enable row level security;
alter table public.referrals enable row level security;
alter table public.promo_campaigns enable row level security;

revoke all on table public.promo_codes from public, anon, authenticated;
revoke all on table public.promo_redemptions from public, anon, authenticated;
revoke all on table public.referrals from public, anon, authenticated;
revoke all on table public.promo_campaigns from public, anon, authenticated;

grant all on table public.promo_codes to postgres, service_role;
grant all on table public.promo_redemptions to postgres, service_role;
grant all on table public.referrals to postgres, service_role;
grant all on table public.promo_campaigns to postgres, service_role;
