-- 테이블/함수 권한 (회원가입·조회 실패 시 이 파일을 SQL Editor에서 실행)
-- permission denied for table profiles 해결

grant usage on schema public to postgres, anon, authenticated, service_role;

grant all on table public.profiles to anon, authenticated, service_role;
grant all on table public.customers to anon, authenticated, service_role;
grant all on table public.listed_properties to anon, authenticated, service_role;
grant all on table public.schedules to anon, authenticated, service_role;

grant execute on function public.username_taken(text) to anon, authenticated, service_role;
grant execute on function public.verify_password_hint(text, text) to anon, authenticated, service_role;
