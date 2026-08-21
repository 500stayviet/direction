# 팀공유 Web Push 규칙 (cron)

클라이언트 `syncShareIds` / `markShareSeen`와 동일한 기준으로 서버 cron이 푸시 후보를 계산한다.

## 대상

- 같은 `workspace`에서 **다른 팀원**이 `workspace_shared = true`로 올린 항목
- 탭: `customers` · `properties` · `navi`(schedules)

## 제외

- `demo_*` id
- `ui_prefs.hides`에 숨긴 id
- 해당 탭 `shareSeeded`가 false (앱에서 한 번도 리스트 동기화 안 함 → 첫 시드와 동일하게 푸시 없음)
- `knownShare[tab]`에 이미 있는 id (클라이언트가 이미 본 항목)

## 발송

- **즉시:** 고객·매물·일정 저장 직후 `POST /api/alerts/dispatch` (앱 꺼져 있어도)
- **백업:** GitHub Actions cron → `/api/cron/alerts` (1시간마다, 놓친 건 보정)
- `alert_push_log.kind = 'share'`, `pair_key = share:{tab}:{id}` 로 중복 방지
- 딥링크: `/{tab}?scrollShare={id}` (해제는 리스트 카드 탭 시만)
