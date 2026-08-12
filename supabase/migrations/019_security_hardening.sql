-- =============================================================================
-- 현장동선: 보안 하드닝 (P0~P1)
-- - admin_upsert_profile: service_role 전용
-- - plan_tier / matching_enabled / promo_source: 서버만 변경
-- - 비밀번호 힌트 재설정 시도 제한 테이블
-- =============================================================================

-- 1) 프로필 upsert RPC는 서버(service_role)만
revoke all on function public.admin_upsert_profile(uuid, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.admin_upsert_profile(uuid, text, text, text, text, text)
  to service_role;

-- 2) 요금·매칭 entitlement 컬럼: 클라이언트 JWT로는 변경 불가
create or replace function public.protect_profile_entitlements()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  jwt_role text := coalesce(auth.jwt() ->> 'role', '');
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if new.plan_tier is not distinct from old.plan_tier
     and new.matching_enabled is not distinct from old.matching_enabled
     and new.promo_source is not distinct from old.promo_source then
    return new;
  end if;

  -- PostgREST service_role / 직접 service 키
  if jwt_role = 'service_role'
     or current_setting('role', true) = 'service_role'
     or session_user in ('postgres', 'supabase_admin') then
    return new;
  end if;

  raise exception 'plan_tier / matching_enabled / promo_source 는 서버만 변경할 수 있습니다.'
    using errcode = '42501';
end;
$$;

drop trigger if exists trg_protect_profile_entitlements on public.profiles;
create trigger trg_protect_profile_entitlements
  before update on public.profiles
  for each row
  execute function public.protect_profile_entitlements();

revoke all on function public.protect_profile_entitlements() from public, anon, authenticated;

-- 3) 비밀번호 힌트 재설정 시도 제한 (service_role만)
create table if not exists public.auth_reset_attempts (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  ip text not null default '',
  failed_count int not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now(),
  constraint auth_reset_attempts_user_ip unique (username, ip)
);

create index if not exists auth_reset_attempts_locked_idx
  on public.auth_reset_attempts (locked_until);

alter table public.auth_reset_attempts enable row level security;
revoke all on table public.auth_reset_attempts from public, anon, authenticated;
grant all on table public.auth_reset_attempts to postgres, service_role;
