-- =============================================================================
-- 현장동선: 관리자(슈퍼/직원) 계정
-- Supabase SQL Editor에서 이 파일 전체를 한 번 실행
-- =============================================================================

create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  password_hash text not null,
  display_name text not null default '',
  title text not null default '직원',
  role text not null default 'staff'
    check (role in ('super', 'staff')),
  active boolean not null default true,
  created_by uuid references public.admin_users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admin_users_username_unique unique (username),
  constraint admin_users_username_lower check (username = lower(username))
);

create index if not exists admin_users_username_idx on public.admin_users (username);

alter table public.admin_users enable row level security;

revoke all on table public.admin_users from public, anon, authenticated;
grant all on table public.admin_users to postgres, service_role;
