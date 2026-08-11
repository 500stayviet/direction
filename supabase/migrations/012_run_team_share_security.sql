-- =============================================================================
-- 현장동선: 팀 공유 보안·권한 (Supabase SQL Editor에서 이 파일 전체를 한 번 실행)
-- 포함: workspace_shared 컬럼 + SELECT opt-in + 팀원 수정·삭제(공유 켠 건만)
-- =============================================================================

-- 0) 컬럼 먼저 추가 (정책에서 참조하므로 반드시 선행)
alter table public.customers
  add column if not exists workspace_shared boolean not null default false;

alter table public.listed_properties
  add column if not exists workspace_shared boolean not null default false;

alter table public.schedules
  add column if not exists workspace_shared boolean not null default false;

create index if not exists customers_workspace_shared_idx
  on public.customers (workspace_id, workspace_shared)
  where deleted_at is null;

-- 1) 고객 SELECT: 본인 전체 + 팀원은 공유 켠 건만
drop policy if exists "customers_select_own" on public.customers;
drop policy if exists "customers_select_workspace" on public.customers;
drop policy if exists "customers_select_shared" on public.customers;

create policy "customers_select_own"
  on public.customers for select
  using (auth.uid() = user_id);

create policy "customers_select_workspace"
  on public.customers for select
  using (
    workspace_id is not null
    and workspace_shared = true
    and public.is_workspace_member(workspace_id)
  );

-- 2) UPDATE: 본인 항상 / 팀원은 공유 켠 건만 (수정·소프트삭제)
drop policy if exists "customers_update_shared" on public.customers;
drop policy if exists "customers_update_own" on public.customers;
drop policy if exists "customers_update_workspace_shared" on public.customers;

create policy "customers_update_own"
  on public.customers for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "customers_update_workspace_shared"
  on public.customers for update
  using (
    workspace_id is not null
    and workspace_shared = true
    and public.is_workspace_member(workspace_id)
  )
  with check (
    workspace_id is not null
    and workspace_shared = true
    and public.is_workspace_member(workspace_id)
  );

drop policy if exists "listed_properties_update_shared" on public.listed_properties;
drop policy if exists "listed_properties_update_own" on public.listed_properties;
drop policy if exists "listed_properties_update_workspace_shared" on public.listed_properties;

create policy "listed_properties_update_own"
  on public.listed_properties for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "listed_properties_update_workspace_shared"
  on public.listed_properties for update
  using (
    workspace_id is not null
    and workspace_shared = true
    and public.is_workspace_member(workspace_id)
  )
  with check (
    workspace_id is not null
    and workspace_shared = true
    and public.is_workspace_member(workspace_id)
  );

drop policy if exists "schedules_update_shared" on public.schedules;
drop policy if exists "schedules_update_own" on public.schedules;
drop policy if exists "schedules_update_workspace_shared" on public.schedules;

create policy "schedules_update_own"
  on public.schedules for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "schedules_update_workspace_shared"
  on public.schedules for update
  using (
    workspace_id is not null
    and workspace_shared = true
    and public.is_workspace_member(workspace_id)
  )
  with check (
    workspace_id is not null
    and workspace_shared = true
    and public.is_workspace_member(workspace_id)
  );

-- 3) 매물·일정 SELECT: 본인 + 공유 켠 건만
drop policy if exists "listed_properties_select_own" on public.listed_properties;
drop policy if exists "listed_properties_select_workspace" on public.listed_properties;
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

drop policy if exists "schedules_select_own" on public.schedules;
drop policy if exists "schedules_select_workspace" on public.schedules;
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
