-- 탈퇴 아이디: 30일 이내만 재사용 차단 (그 이후는 가입 API에서 해제)

create or replace function public.username_taken(p_username text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select
    exists (
      select 1
      from public.profiles
      where username = lower(trim(p_username))
    )
    or exists (
      select 1
      from public.deleted_accounts
      where username = lower(trim(p_username))
        and deleted_at > now() - interval '30 days'
    );
$$;

revoke all on function public.username_taken(text) from public;
grant execute on function public.username_taken(text) to anon, authenticated;
