-- =============================================================================
-- 현장동선: profiles.ui_prefs 실시간 (같은 계정 PC·모바일 알람·숨김 동기화)
-- Supabase SQL Editor에서 이 파일 전체를 한 번 실행
-- =============================================================================

alter table public.profiles replica identity full;

do $$
begin
  begin
    alter publication supabase_realtime add table public.profiles;
  exception
    when duplicate_object then null;
  end;
end $$;
