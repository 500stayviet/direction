/** 아이디 → Supabase Auth 이메일 매핑 (실제 메일함 불필요) */
export function usernameToEmail(username: string): string {
  const safe = username
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "_");
  return `${safe}@users.direction.app`;
}

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}
