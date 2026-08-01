/** Vercel 환경변수에 키가 여러 번 붙여넣어진 경우 첫 JWT만 사용 */
export function sanitizeSupabaseKey(key: string | undefined | null): string {
  if (!key) return "";
  const match = key.match(
    /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/
  );
  return match?.[0] ?? key.trim();
}
