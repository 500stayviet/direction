/** 앱 켤 때·로그인 직후·탭 복귀(debounce) — account-status 최소 간격 */
export const ACCOUNT_STATUS_SYNC_MIN_MS = 5 * 60 * 1000;

/** 서버 last_seen_at UPDATE 최소 간격 (account-status) */
export const LAST_SEEN_UPDATE_MIN_MS = 15 * 60 * 1000;

/** match-pool API 클라이언트 캐시 TTL */
export const MATCH_POOL_CACHE_TTL_MS = 3 * 60 * 1000;
