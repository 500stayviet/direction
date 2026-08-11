-- 공유(켜짐) 항목: 같은 팀원이 수정·삭제(소프트) 가능
-- 비공유 항목: 등록자만 수정·삭제
-- 복구는 관리자(service_role) API에서 처리

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
