-- 공유 코드 5분 만료
alter table public.workspaces
  add column if not exists share_code_expires_at timestamptz;

-- 기존 코드는 즉시 만료 처리(재발급 유도)
update public.workspaces
set share_code_expires_at = now()
where share_code_expires_at is null;
