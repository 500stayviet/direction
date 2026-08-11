-- 업장 공유 공간 + 소프트 삭제 + 감사 로그
-- Supabase SQL Editor에서 이 파일 전체를 실행하세요.

-- ---------------------------------------------------------------------------
-- workspaces
-- ---------------------------------------------------------------------------
create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  share_code text not null,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workspaces_share_code_unique unique (share_code),
  constraint workspaces_share_code_upper check (share_code = upper(share_code))
);

create index if not exists workspaces_share_code_idx on public.workspaces (share_code);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  display_name text not null default '',
  joined_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create unique index if not exists workspace_members_user_unique
  on public.workspace_members (user_id);

create index if not exists workspace_members_workspace_idx
  on public.workspace_members (workspace_id);

-- ---------------------------------------------------------------------------
-- data table columns
-- ---------------------------------------------------------------------------
alter table public.customers
  add column if not exists workspace_id uuid references public.workspaces (id) on delete set null,
  add column if not exists created_by uuid references auth.users (id) on delete set null,
  add column if not exists created_by_name text not null default '',
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users (id) on delete set null;

alter table public.listed_properties
  add column if not exists workspace_id uuid references public.workspaces (id) on delete set null,
  add column if not exists created_by uuid references auth.users (id) on delete set null,
  add column if not exists created_by_name text not null default '',
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users (id) on delete set null;

alter table public.schedules
  add column if not exists workspace_id uuid references public.workspaces (id) on delete set null,
  add column if not exists created_by uuid references auth.users (id) on delete set null,
  add column if not exists created_by_name text not null default '',
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users (id) on delete set null,
  add column if not exists workspace_shared boolean not null default false;

create index if not exists customers_workspace_id_idx on public.customers (workspace_id);
create index if not exists listed_properties_workspace_id_idx on public.listed_properties (workspace_id);
create index if not exists schedules_workspace_id_idx on public.schedules (workspace_id);
create index if not exists customers_deleted_at_idx on public.customers (deleted_at);
create index if not exists listed_properties_deleted_at_idx on public.listed_properties (deleted_at);
create index if not exists schedules_deleted_at_idx on public.schedules (deleted_at);

-- ---------------------------------------------------------------------------
-- audit logs
-- ---------------------------------------------------------------------------
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces (id) on delete set null,
  actor_user_id uuid,
  actor_name text not null default '',
  action text not null,
  entity_type text not null,
  entity_id text not null default '',
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_workspace_idx on public.audit_logs (workspace_id, created_at desc);
create index if not exists audit_logs_created_at_idx on public.audit_logs (created_at desc);

-- ---------------------------------------------------------------------------
-- helpers
-- ---------------------------------------------------------------------------
create or replace function public.my_workspace_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select workspace_id
  from public.workspace_members
  where user_id = auth.uid()
  limit 1;
$$;

create or replace function public.is_workspace_member(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members
    where workspace_id = p_workspace_id
      and user_id = auth.uid()
  );
$$;

revoke all on function public.my_workspace_id() from public;
grant execute on function public.my_workspace_id() to authenticated, service_role;
revoke all on function public.is_workspace_member(uuid) from public;
grant execute on function public.is_workspace_member(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RLS: workspaces / members (client read own; writes via service_role APIs)
-- ---------------------------------------------------------------------------
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists "workspaces_select_member" on public.workspaces;
create policy "workspaces_select_member"
  on public.workspaces for select
  using (public.is_workspace_member(id));

drop policy if exists "workspace_members_select_own_space" on public.workspace_members;
create policy "workspace_members_select_own_space"
  on public.workspace_members for select
  using (public.is_workspace_member(workspace_id));

-- audit: no client access
revoke all on table public.audit_logs from public, anon, authenticated;
grant all on table public.audit_logs to postgres, service_role;

revoke all on table public.workspaces from public, anon;
grant select on table public.workspaces to authenticated;
grant all on table public.workspaces to postgres, service_role;

revoke all on table public.workspace_members from public, anon;
grant select on table public.workspace_members to authenticated;
grant all on table public.workspace_members to postgres, service_role;

grant all on table public.customers to authenticated, service_role;
grant all on table public.listed_properties to authenticated, service_role;
grant all on table public.schedules to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Replace data RLS: own OR workspace member; hide soft-deleted from normal select via app filter
-- ---------------------------------------------------------------------------
drop policy if exists "customers_all_own" on public.customers;
drop policy if exists "customers_select_shared" on public.customers;
drop policy if exists "customers_insert_own" on public.customers;
drop policy if exists "customers_update_shared" on public.customers;
drop policy if exists "customers_delete_own" on public.customers;

create policy "customers_select_shared"
  on public.customers for select
  using (
    auth.uid() = user_id
    or (workspace_id is not null and public.is_workspace_member(workspace_id))
  );

create policy "customers_insert_own"
  on public.customers for insert
  with check (
    auth.uid() = user_id
    and (
      workspace_id is null
      or public.is_workspace_member(workspace_id)
    )
  );

create policy "customers_update_shared"
  on public.customers for update
  using (
    auth.uid() = user_id
    or (workspace_id is not null and public.is_workspace_member(workspace_id))
  )
  with check (
    auth.uid() = user_id
    or (workspace_id is not null and public.is_workspace_member(workspace_id))
  );

create policy "customers_delete_own"
  on public.customers for delete
  using (auth.uid() = user_id);

drop policy if exists "listed_properties_all_own" on public.listed_properties;
drop policy if exists "listed_properties_select_shared" on public.listed_properties;
drop policy if exists "listed_properties_insert_own" on public.listed_properties;
drop policy if exists "listed_properties_update_shared" on public.listed_properties;
drop policy if exists "listed_properties_delete_own" on public.listed_properties;

create policy "listed_properties_select_shared"
  on public.listed_properties for select
  using (
    auth.uid() = user_id
    or (workspace_id is not null and public.is_workspace_member(workspace_id))
  );

create policy "listed_properties_insert_own"
  on public.listed_properties for insert
  with check (
    auth.uid() = user_id
    and (
      workspace_id is null
      or public.is_workspace_member(workspace_id)
    )
  );

create policy "listed_properties_update_shared"
  on public.listed_properties for update
  using (
    auth.uid() = user_id
    or (workspace_id is not null and public.is_workspace_member(workspace_id))
  )
  with check (
    auth.uid() = user_id
    or (workspace_id is not null and public.is_workspace_member(workspace_id))
  );

create policy "listed_properties_delete_own"
  on public.listed_properties for delete
  using (auth.uid() = user_id);

drop policy if exists "schedules_all_own" on public.schedules;
drop policy if exists "schedules_select_shared" on public.schedules;
drop policy if exists "schedules_insert_own" on public.schedules;
drop policy if exists "schedules_update_shared" on public.schedules;
drop policy if exists "schedules_delete_own" on public.schedules;

create policy "schedules_select_shared"
  on public.schedules for select
  using (
    auth.uid() = user_id
    or (
      workspace_id is not null
      and public.is_workspace_member(workspace_id)
      and workspace_shared = true
    )
  );

create policy "schedules_insert_own"
  on public.schedules for insert
  with check (
    auth.uid() = user_id
    and (
      workspace_id is null
      or public.is_workspace_member(workspace_id)
    )
  );

create policy "schedules_update_shared"
  on public.schedules for update
  using (
    auth.uid() = user_id
    or (workspace_id is not null and public.is_workspace_member(workspace_id))
  )
  with check (
    auth.uid() = user_id
    or (workspace_id is not null and public.is_workspace_member(workspace_id))
  );

create policy "schedules_delete_own"
  on public.schedules for delete
  using (auth.uid() = user_id);
