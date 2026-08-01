-- 현장동선: profiles + 계정별 데이터 + RLS
-- Supabase SQL Editor에서 실행하거나 CLI로 적용하세요.
-- Authentication → Providers → Email 에서 "Confirm email" 을 OFF 권장 (아이디 로그인).

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  shop_name text not null default '현장동선',
  display_name text not null default '',
  phone text not null default '',
  password_hint text not null,
  navi_preference jsonb,
  recent_customer_ids jsonb not null default '[]'::jsonb,
  demo_seed_version text,
  created_at timestamptz not null default now(),
  constraint profiles_username_unique unique (username),
  constraint profiles_username_lower check (username = lower(username))
);

create index if not exists profiles_username_idx on public.profiles (username);

alter table public.profiles enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- customers / listed_properties / schedules (payload = 앱 타입 JSON)
-- ---------------------------------------------------------------------------
create table if not exists public.customers (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists customers_user_id_idx on public.customers (user_id);

alter table public.customers enable row level security;

create policy "customers_all_own"
  on public.customers for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.listed_properties (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists listed_properties_user_id_idx
  on public.listed_properties (user_id);

alter table public.listed_properties enable row level security;

create policy "listed_properties_all_own"
  on public.listed_properties for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.schedules (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists schedules_user_id_idx on public.schedules (user_id);

alter table public.schedules enable row level security;

create policy "schedules_all_own"
  on public.schedules for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Public RPCs (anon 호출 가능 — 힌트/아이디 중복만, 비밀번호·힌트 원문 노출 없음)
-- ---------------------------------------------------------------------------
create or replace function public.username_taken(p_username text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where username = lower(trim(p_username))
  );
$$;

revoke all on function public.username_taken(text) from public;
grant execute on function public.username_taken(text) to anon, authenticated;

create or replace function public.verify_password_hint(
  p_username text,
  p_hint text
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where username = lower(trim(p_username))
      and password_hint = trim(p_hint)
  );
$$;

revoke all on function public.verify_password_hint(text, text) from public;
grant execute on function public.verify_password_hint(text, text) to anon, authenticated;
