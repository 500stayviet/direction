import type { SupabaseClient } from "@supabase/supabase-js";
import { usernameToEmail } from "@/lib/supabase/email";

/** 탈퇴 아이디 재가입 대기 일수 */
export const WITHDRAWN_USERNAME_COOLDOWN_DAYS = 30;

export type WithdrawnAccountRow = {
  username: string;
  former_user_id: string;
  deleted_at: string;
};

export function withdrawnUsernameCooldownEnds(
  deletedAt: string | Date
): Date {
  const d = typeof deletedAt === "string" ? new Date(deletedAt) : deletedAt;
  const end = new Date(d.getTime());
  end.setUTCDate(end.getUTCDate() + WITHDRAWN_USERNAME_COOLDOWN_DAYS);
  return end;
}

export function isUsernameInWithdrawnCooldown(
  deletedAt: string | Date | null | undefined,
  now: Date = new Date()
): boolean {
  if (!deletedAt) return true;
  const t = typeof deletedAt === "string" ? Date.parse(deletedAt) : deletedAt.getTime();
  if (!Number.isFinite(t)) return true;
  return now.getTime() < withdrawnUsernameCooldownEnds(new Date(t)).getTime();
}

export function daysUntilUsernameReusable(
  deletedAt: string | Date,
  now: Date = new Date()
): number {
  const left =
    withdrawnUsernameCooldownEnds(deletedAt).getTime() - now.getTime();
  return Math.max(1, Math.ceil(left / 86400000));
}

export function withdrawnUsernameBlockedMessage(
  deletedAt: string | Date,
  now: Date = new Date()
): string {
  const days = daysUntilUsernameReusable(deletedAt, now);
  return `탈퇴한 아이디입니다. ${days}일 후 같은 아이디로 다시 가입할 수 있습니다.`;
}

/** 탈퇴 쿨다운 종료 후 재가입 — 옛 Auth·profile 아이디·이메일만 비우고 데이터는 former_user_id에 유지 */
export async function releaseWithdrawnUsernameForReregister(
  admin: SupabaseClient,
  row: Pick<WithdrawnAccountRow, "username" | "former_user_id">
): Promise<void> {
  const formerId = row.former_user_id;
  const releasedUsername = `released_${formerId.replace(/-/g, "")}`;
  const releasedEmail = `released.${formerId}@users.direction.app`;

  const { data: authData, error: getErr } =
    await admin.auth.admin.getUserById(formerId);
  if (getErr || !authData.user) {
    throw new Error("탈퇴 계정 정보를 찾을 수 없습니다.");
  }

  const meta = authData.user.user_metadata ?? {};
  const { error: authErr } = await admin.auth.admin.updateUserById(formerId, {
    email: releasedEmail,
    user_metadata: {
      ...meta,
      username: releasedUsername,
      account_deleted: true,
      username_released_at: new Date().toISOString(),
    },
  });
  if (authErr) throw new Error(authErr.message);

  await admin
    .from("profiles")
    .update({ username: releasedUsername })
    .eq("id", formerId);

  const { error: delErr } = await admin
    .from("deleted_accounts")
    .delete()
    .eq("username", row.username);
  if (delErr) throw new Error(delErr.message);

  // 새 가입이 같은 synthetic email 을 쓸 수 있는지 (방어적 확인)
  const targetEmail = usernameToEmail(row.username);
  if (targetEmail === releasedEmail) {
    throw new Error("아이디 해제 처리에 실패했습니다.");
  }
}
