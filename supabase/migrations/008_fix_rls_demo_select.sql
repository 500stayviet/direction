-- RLS: anon이 is_workspace_member EXECUTE 없어 조회가 통째로 실패하던 문제 완화
-- + 매물 workspace_shared 컬럼 보강

grant execute on function public.my_workspace_id() to anon, authenticated, service_role;
grant execute on function public.is_workspace_member(uuid) to anon, authenticated, service_role;

alter table public.listed_properties
  add column if not exists workspace_shared boolean not null default false;

create index if not exists listed_properties_workspace_shared_idx
  on public.listed_properties (workspace_id, workspace_shared)
  where deleted_at is null;

-- 본인 행은 함수 호출 없이 통과하도록 정책 분리
drop policy if exists "customers_select_shared" on public.customers;
create policy "customers_select_own"
  on public.customers for select
  using (auth.uid() = user_id);
create policy "customers_select_workspace"
  on public.customers for select
  using (
    workspace_id is not null
    and public.is_workspace_member(workspace_id)
  );

drop policy if exists "listed_properties_select_shared" on public.listed_properties;
create policy "listed_properties_select_own"
  on public.listed_properties for select
  using (auth.uid() = user_id);
create policy "listed_properties_select_workspace"
  on public.listed_properties for select
  using (
    workspace_id is not null
    and workspace_shared = true
    and public.is_workspace_member(workspace_id)
  );

drop policy if exists "schedules_select_shared" on public.schedules;
create policy "schedules_select_own"
  on public.schedules for select
  using (auth.uid() = user_id);
create policy "schedules_select_workspace"
  on public.schedules for select
  using (
    workspace_id is not null
    and workspace_shared = true
    and public.is_workspace_member(workspace_id)
  );
