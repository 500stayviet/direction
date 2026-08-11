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

/** 회원가입·중복확인 공통 아이디 규칙 */
export function validateUsernameFormat(
  raw: string
): { ok: true; username: string } | { ok: false; message: string } {
  const username = normalizeUsername(raw);
  if (!username) {
    return { ok: false, message: "아이디를 입력해 주세요." };
  }
  if (username.length < 4) {
    return { ok: false, message: "아이디는 4자 이상이어야 합니다." };
  }
  if (!/^[a-z0-9._-]+$/.test(username)) {
    return {
      ok: false,
      message: "아이디는 영문 소문자, 숫자, . _ - 만 사용할 수 있습니다.",
    };
  }
  return { ok: true, username };
}
