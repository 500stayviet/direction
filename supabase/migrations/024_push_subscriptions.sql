-- ============================================================
-- 현장동선: Web Push 구독 · 발송 로그
-- ============================================================

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

create index if not exists push_subscriptions_user_id_idx
  on public.push_subscriptions (user_id);

create table if not exists public.alert_push_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  pair_key text not null,
  kind text not null check (kind in ('match', 'newMatch')),
  sent_at timestamptz not null default now(),
  unique (user_id, pair_key, kind)
);

create index if not exists alert_push_log_user_id_idx
  on public.alert_push_log (user_id);

alter table public.push_subscriptions enable row level security;
alter table public.alert_push_log enable row level security;

-- service_role (Cron·API) only — 클라이언트 직접 접근 없음
revoke all on table public.push_subscriptions from public, anon, authenticated;
revoke all on table public.alert_push_log from public, anon, authenticated;
grant all on table public.push_subscriptions to postgres, service_role;
grant all on table public.alert_push_log to postgres, service_role;

comment on table public.push_subscriptions is 'Web Push subscription per device';
comment on table public.alert_push_log is 'Sent match push dedup log';
