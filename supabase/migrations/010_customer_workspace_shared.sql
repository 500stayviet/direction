-- 고객 항목별 팀 공유(opt-in) — 008 이후에도 안전하게 재적용 가능
alter table public.customers
  add column if not exists workspace_shared boolean not null default false;

create index if not exists customers_workspace_shared_idx
  on public.customers (workspace_id, workspace_shared)
  where deleted_at is null;

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
