-- ★ 회원가입 "프로필 저장 실패" 해결용 — SQL Editor에서 이 파일 전체를 실행하세요.

grant usage on schema public to postgres, anon, authenticated, service_role;

grant select, insert, update, delete on table public.profiles to anon, authenticated, service_role;
grant select, insert, update, delete on table public.customers to anon, authenticated, service_role;
grant select, insert, update, delete on table public.listed_properties to anon, authenticated, service_role;
grant select, insert, update, delete on table public.schedules to anon, authenticated, service_role;

-- service_role / 서버에서 프로필을 안전하게 저장 (권한 우회용 SECURITY DEFINER)
create or replace function public.admin_upsert_profile(
  p_id uuid,
  p_username text,
  p_shop_name text,
  p_display_name text,
  p_phone text,
  p_password_hint text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id, username, shop_name, display_name, phone, password_hint
  ) values (
    p_id,
    lower(trim(p_username)),
    coalesce(nullif(trim(p_shop_name), ''), '현장동선'),
    coalesce(nullif(trim(p_display_name), ''), lower(trim(p_username))),
    coalesce(p_phone, ''),
    trim(p_password_hint)
  )
  on conflict (id) do update set
    username = excluded.username,
    shop_name = excluded.shop_name,
    display_name = excluded.display_name,
    phone = excluded.phone,
    password_hint = excluded.password_hint;
end;
$$;

revoke all on function public.admin_upsert_profile(uuid, text, text, text, text, text) from public;
grant execute on function public.admin_upsert_profile(uuid, text, text, text, text, text)
  to service_role, authenticated;
