/** 전각 영숫자 → 반각 (모바일 입력 실수 방지) */
function toHalfWidth(value: string): string {
  return value.replace(/[！-～]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xfee0)
  );
}

/** 아이디 → Supabase Auth 이메일 매핑 (실제 메일함 불필요) */
export function usernameToEmail(username: string): string {
  const safe = normalizeUsername(username).replace(/[^a-z0-9._-]/g, "_");
  return `${safe}@users.direction.app`;
}

export function normalizeUsername(username: string): string {
  return toHalfWidth(username).trim().toLowerCase();
}
