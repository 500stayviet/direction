-- =============================================================================
-- 메시지·사진 인테이크 파싱 샘플 수집 (파서 개선용)
-- =============================================================================

create table if not exists public.intake_parse_samples (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  kind text not null check (kind in ('customer', 'property')),
  source text not null check (source in ('message', 'photo')),
  raw_text text not null,
  parsed jsonb not null default '{}',
  missing_fields text[] not null default '{}',
  status text not null default 'new' check (status in ('new', 'exported', 'reviewed')),
  raw_hash text not null default '',
  created_at timestamptz not null default now(),
  exported_at timestamptz,
  reviewed_at timestamptz
);

create index if not exists intake_parse_samples_status_created_idx
  on public.intake_parse_samples (status, created_at desc);

create index if not exists intake_parse_samples_created_idx
  on public.intake_parse_samples (created_at desc);

create index if not exists intake_parse_samples_raw_hash_idx
  on public.intake_parse_samples (raw_hash);

alter table public.intake_parse_samples enable row level security;

revoke all on table public.intake_parse_samples from public, anon, authenticated;
grant all on table public.intake_parse_samples to service_role;
