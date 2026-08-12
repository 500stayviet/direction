import { createAdminClient } from "@/lib/supabase/admin";
import { getClientIp } from "@/lib/adminAuth";

/** 관리자 로그인과 동일 정책: 15분 창 5회 실패 → 30분 잠금 */
const RESET_MAX_FAILS = 5;
const RESET_LOCK_MS = 30 * 60 * 1000;
const RESET_WINDOW_MS = 15 * 60 * 1000;

function isMissingResetAttempts(error: { message?: string; code?: string }) {
  const msg = (error.message ?? "").toLowerCase();
  return (
    msg.includes("auth_reset_attempts") ||
    msg.includes("does not exist") ||
    error.code === "42P01" ||
    error.code === "PGRST205"
  );
}

export { getClientIp };

export async function checkResetLock(
  admin: ReturnType<typeof createAdminClient>,
  username: string,
  ip: string
): Promise<{ locked: boolean; message?: string }> {
  const { data, error } = await admin
    .from("auth_reset_attempts")
    .select("failed_count, locked_until, updated_at")
    .eq("username", username)
    .eq("ip", ip)
    .maybeSingle();

  if (error && isMissingResetAttempts(error)) {
    return { locked: false };
  }
  if (!data) return { locked: false };

  const lockedUntil = data.locked_until
    ? Date.parse(String(data.locked_until))
    : NaN;
  if (Number.isFinite(lockedUntil) && lockedUntil > Date.now()) {
    return {
      locked: true,
      message:
        "비밀번호 재설정 시도가 너무 많습니다. 30분 후 다시 시도해 주세요.",
    };
  }
  return { locked: false };
}

export async function recordResetFailure(
  admin: ReturnType<typeof createAdminClient>,
  username: string,
  ip: string
) {
  const now = new Date();
  const { data, error } = await admin
    .from("auth_reset_attempts")
    .select("failed_count, updated_at")
    .eq("username", username)
    .eq("ip", ip)
    .maybeSingle();

  if (error && isMissingResetAttempts(error)) return;

  const updatedAt = data?.updated_at ? Date.parse(String(data.updated_at)) : 0;
  const withinWindow = updatedAt && Date.now() - updatedAt < RESET_WINDOW_MS;
  const nextFails = withinWindow ? (data?.failed_count ?? 0) + 1 : 1;
  const lockedUntil =
    nextFails >= RESET_MAX_FAILS
      ? new Date(Date.now() + RESET_LOCK_MS).toISOString()
      : null;

  await admin.from("auth_reset_attempts").upsert(
    {
      username,
      ip,
      failed_count: nextFails,
      locked_until: lockedUntil,
      updated_at: now.toISOString(),
    },
    { onConflict: "username,ip" }
  );
}

export async function clearResetFailures(
  admin: ReturnType<typeof createAdminClient>,
  username: string,
  ip: string
) {
  const { error } = await admin
    .from("auth_reset_attempts")
    .delete()
    .eq("username", username)
    .eq("ip", ip);
  if (error && isMissingResetAttempts(error)) return;
}
