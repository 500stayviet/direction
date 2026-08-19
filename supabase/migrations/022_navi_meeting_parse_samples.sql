-- =============================================================================
-- 네비(현장동선) → 미팅 확정 파싱 샘플 수집 (파서 개선용)
-- =============================================================================

create table if not exists public.navi_meeting_parse_samples (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,

  -- 일정 id (schedules.id 는 uuid가 아니라 prefix_id 형태)
  schedule_id text not null unique,

  -- 스케줄에서 추출(마스킹 포함)한 원문 페이로드
  raw_payload jsonb not null default '{}',

  -- 관리자/커서에 보여줄 파싱 결과 (현재는 raw_payload 기반 요약)
  parsed jsonb not null default '{}',

  missing_fields text[] not null default '{}',

  status text not null default 'new' check (status in ('new', 'exported', 'reviewed')),

  created_at timestamptz not null default now(),
  exported_at timestamptz,
  reviewed_at timestamptz
);

create index if not exists navi_meeting_parse_samples_status_created_idx
  on public.navi_meeting_parse_samples (status, created_at desc);

create index if not exists navi_meeting_parse_samples_created_idx
  on public.navi_meeting_parse_samples (created_at desc);

alter table public.navi_meeting_parse_samples enable row level security;
revoke all on table public.navi_meeting_parse_samples from public, anon, authenticated;
grant all on table public.navi_meeting_parse_samples to service_role;

