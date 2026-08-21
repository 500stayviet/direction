-- 팀공유 Web Push — alert_push_log.kind 에 share 추가

alter table public.alert_push_log
  drop constraint if exists alert_push_log_kind_check;

alter table public.alert_push_log
  add constraint alert_push_log_kind_check
  check (kind in ('match', 'newMatch', 'share'));

comment on table public.alert_push_log is 'Sent match/share push dedup log';
