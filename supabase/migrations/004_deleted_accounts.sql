-- 계정 삭제 기록 보관 + 동일 아이디 재가입 차단
-- Supabase SQL Editor에서 이 파일 전체를 실행하세요.

create table if not exists public.deleted_accounts (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  former_user_id uuid not null,
  shop_name text not null default '',
  display_name text not null default '',
  phone text not null default '',
  password_hint text not null default '',
  profile_created_at timestamptz,
  deleted_at timestamptz not null default now(),
  data_snapshot jsonb not null default '{}'::jsonb,
  constraint deleted_accounts_username_unique unique (username),
  constraint deleted_accounts_username_lower check (username = lower(username))
);

create index if not exists deleted_accounts_username_idx
  on public.deleted_accounts (username);

create index if not exists deleted_accounts_former_user_id_idx
  on public.deleted_accounts (former_user_id);

alter table public.deleted_accounts enable row level security;

-- 일반 사용자 접근 불가 — service_role만 조회/저장 (관리자 보관용)
revoke all on table public.deleted_accounts from public, anon, authenticated;
grant all on table public.deleted_accounts to postgres, service_role;

-- 활성 계정 + 삭제된 계정 모두 아이디 사용 중으로 간주
create or replace function public.username_taken(p_username text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select
    exists (
      select 1
      from public.profiles
      where username = lower(trim(p_username))
    )
    or exists (
      select 1
      from public.deleted_accounts
      where username = lower(trim(p_username))
    );
$$;

revoke all on function public.username_taken(text) from public;
grant execute on function public.username_taken(text) to anon, authenticated;
