-- 매물도 일정처럼 팀 공유 on/off (기본 비공유)
alter table public.listed_properties
  add column if not exists workspace_shared boolean not null default false;

create index if not exists listed_properties_workspace_shared_idx
  on public.listed_properties (workspace_id, workspace_shared)
  where deleted_at is null;

drop policy if exists "listed_properties_select_shared" on public.listed_properties;
create policy "listed_properties_select_shared"
  on public.listed_properties for select
  using (
    auth.uid() = user_id
    or (
      workspace_id is not null
      and workspace_shared = true
      and public.is_workspace_member(workspace_id)
    )
  );
