-- =============================================================================
-- 현장동선: 관리자 운영 (last_seen, 로그인 시도 제한)
-- =============================================================================

alter table public.profiles
  add column if not exists last_seen_at timestamptz;

create index if not exists profiles_last_seen_at_idx
  on public.profiles (last_seen_at desc);

create table if not exists public.admin_login_attempts (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  ip text not null default '',
  failed_count int not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now(),
  constraint admin_login_attempts_user_ip unique (username, ip)
);

create index if not exists admin_login_attempts_locked_idx
  on public.admin_login_attempts (locked_until);

alter table public.admin_login_attempts enable row level security;
revoke all on table public.admin_login_attempts from public, anon, authenticated;
grant all on table public.admin_login_attempts to postgres, service_role;

create index if not exists audit_logs_action_idx
  on public.audit_logs (action, created_at desc);
