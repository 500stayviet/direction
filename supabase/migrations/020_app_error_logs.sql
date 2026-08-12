-- =============================================================================
-- 현장동선: API 에러 로그 (관리자 「에러」탭)
-- HTTP 400~599 저장 (3xx 제외). service_role 전용.
-- =============================================================================

create table if not exists public.app_error_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  status int not null,
  method text not null default '',
  path text not null default '',
  message text not null default '',
  body_preview text not null default '',
  stack text not null default '',
  report_text text not null default '',
  ip text not null default '',
  user_agent text not null default ''
);

create index if not exists app_error_logs_created_at_idx
  on public.app_error_logs (created_at desc);

create index if not exists app_error_logs_status_idx
  on public.app_error_logs (status, created_at desc);

create index if not exists app_error_logs_path_idx
  on public.app_error_logs (path, created_at desc);

alter table public.app_error_logs enable row level security;
revoke all on table public.app_error_logs from public, anon, authenticated;
grant all on table public.app_error_logs to postgres, service_role;
