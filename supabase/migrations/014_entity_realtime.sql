-- =============================================================================
-- 현장동선: 고객·매물·네비 실시간 (앱이 켜져 있을 때만 캐시 동기화)
-- Supabase SQL Editor에서 이 파일 전체를 한 번 실행
-- =============================================================================

alter table public.customers replica identity full;
alter table public.listed_properties replica identity full;
alter table public.schedules replica identity full;

do $$
begin
  begin
    alter publication supabase_realtime add table public.customers;
  exception
    when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.listed_properties;
  exception
    when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.schedules;
  exception
    when duplicate_object then null;
  end;
end $$;
