/** Playwright uniqueUser(prefix) → prefix + 6 hex */
export const E2E_USERNAME_PREFIX =
  /^(e2e|auth|fail|cachea|cacheb|own|mem|sus|del|tgl|join|bad|pref|prefu|intro|talk|msg|choice|pchoice|cform)[a-f0-9]{6}$/i;

export function isE2eUsername(value: string): boolean {
  return E2E_USERNAME_PREFIX.test(String(value ?? "").toLowerCase());
}

export function isE2eProfileMeta(meta: Record<string, unknown>): boolean {
  const shop = String(meta.shop_name ?? "");
  const display = String(meta.display_name ?? "");
  const hint = String(meta.password_hint ?? "");
  if (hint === "e2e-hint") return true;
  if (/^이투이[a-f0-9]{6}$/i.test(shop)) return true;
  if (/^테스터[a-f0-9]{6}$/i.test(display)) return true;
  return false;
}

export function isE2eAuthUser(u: {
  email?: string | null;
  user_metadata?: Record<string, unknown>;
}): boolean {
  const meta = u.user_metadata ?? {};
  const username = String(meta.username ?? "");
  const emailLocal = String(u.email ?? "").split("@")[0];
  return (
    isE2eUsername(username) ||
    isE2eUsername(emailLocal) ||
    isE2eProfileMeta(meta)
  );
}
