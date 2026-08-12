-- =============================================================================
-- 현장동선: 같은 계정의 폰·PC 읽음·숨김 (profiles.ui_prefs)
-- Supabase SQL Editor에서 이 파일 전체를 한 번 실행
-- =============================================================================

alter table public.profiles
  add column if not exists ui_prefs jsonb not null default '{}'::jsonb;
