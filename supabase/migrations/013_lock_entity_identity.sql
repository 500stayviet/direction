-- =============================================================================
-- 공유 행의 등록자(user_id)·소속 팀(workspace_id) 변경 잠금
-- 팀원은 내용 수정·소프트삭제만 가능. 주인을 가로채거나 팀에서 빼낼 수 없음.
-- 계정삭제·팀 참여(service_role)는 기존처럼 재바인딩 가능.
-- =============================================================================

create or replace function public.prevent_entity_identity_change()
returns trigger
language plpgsql
as $$
begin
  if coalesce(auth.role(), '') = 'service_role' then
    return NEW;
  end if;
  if current_user in ('postgres', 'supabase_admin', 'service_role') then
    return NEW;
  end if;

  if NEW.user_id is distinct from OLD.user_id then
    raise exception '등록자를 변경할 수 없습니다.';
  end if;
  if NEW.workspace_id is distinct from OLD.workspace_id then
    raise exception '소속 팀을 변경할 수 없습니다.';
  end if;
  return NEW;
end;
$$;

drop trigger if exists customers_lock_identity on public.customers;
create trigger customers_lock_identity
  before update on public.customers
  for each row
  execute procedure public.prevent_entity_identity_change();

drop trigger if exists listed_properties_lock_identity on public.listed_properties;
create trigger listed_properties_lock_identity
  before update on public.listed_properties
  for each row
  execute procedure public.prevent_entity_identity_change();

drop trigger if exists schedules_lock_identity on public.schedules;
create trigger schedules_lock_identity
  before update on public.schedules
  for each row
  execute procedure public.prevent_entity_identity_change();
