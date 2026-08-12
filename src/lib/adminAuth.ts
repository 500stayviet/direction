import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/workspaceServer";

export type AdminRole = "super" | "staff";

export type AdminSession = {
  id: string;
  username: string;
  displayName: string;
  title: string;
  role: AdminRole;
};

type AdminRow = {
  id: string;
  username: string;
  password_hash: string;
  display_name: string;
  title: string;
  role: AdminRole;
  active: boolean;
};

const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const LOGIN_MAX_FAILS = 5;
const LOGIN_LOCK_MS = 30 * 60 * 1000;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

function sessionSecret(): string {
  const secret = (process.env.ADMIN_SESSION_SECRET ?? "").trim();
  if (secret) return secret;
  const fallback =
    (process.env.ADMIN_PASSWORD ?? "").trim() ||
    (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  if (fallback) return fallback;
  if (process.env.NODE_ENV === "production") {
    throw new Error("ADMIN_SESSION_SECRET is required in production");
  }
  return "direction-admin-dev-only";
}

export function hashAdminPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyAdminPassword(
  password: string,
  stored: string
): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  try {
    const next = scryptSync(password, salt, 64);
    const prev = Buffer.from(hash, "hex");
    if (prev.length !== next.length) return false;
    return timingSafeEqual(prev, next);
  } catch {
    return false;
  }
}

export function createAdminToken(session: AdminSession): string {
  const exp = Date.now() + SESSION_TTL_MS;
  const payload = Buffer.from(
    JSON.stringify({ ...session, exp }),
    "utf8"
  ).toString("base64url");
  const sig = createHmac("sha256", sessionSecret())
    .update(payload)
    .digest("base64url");
  return `${payload}.${sig}`;
}

export function parseAdminToken(token: string): AdminSession | null {
  const raw = token.trim();
  const i = raw.lastIndexOf(".");
  if (i <= 0) return null;
  const payload = raw.slice(0, i);
  const sig = raw.slice(i + 1);
  const expect = createHmac("sha256", sessionSecret())
    .update(payload)
    .digest("base64url");
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expect);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const data = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    ) as AdminSession & { exp?: number };
    if (!data?.id || !data.username || !data.role) return null;
    if (!data.exp || data.exp < Date.now()) return null;
    if (data.role !== "super" && data.role !== "staff") return null;
    return {
      id: data.id,
      username: data.username,
      displayName: data.displayName || data.username,
      title: data.title || (data.role === "super" ? "슈퍼관리자" : "직원"),
      role: data.role,
    };
  } catch {
    return null;
  }
}

export function getAdminBearer(request: Request): string {
  const auth = request.headers.get("authorization") ?? "";
  if (auth.startsWith("Bearer ")) return auth.slice(7).trim();
  return (request.headers.get("x-admin-token") ?? "").trim();
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

function isMissingAdminUsers(error: { message?: string } | null) {
  const msg = (error?.message || "").toLowerCase();
  return (
    msg.includes("admin_users") ||
    msg.includes("does not exist") ||
    msg.includes("schema cache")
  );
}

function isMissingLoginAttempts(error: { message?: string } | null) {
  const msg = (error?.message || "").toLowerCase();
  return (
    msg.includes("admin_login_attempts") ||
    msg.includes("does not exist") ||
    msg.includes("schema cache")
  );
}

async function ensureBootstrapSuper(
  admin: ReturnType<typeof createAdminClient>
): Promise<AdminRow | null> {
  const username = (process.env.ADMIN_ID ?? "").trim().toLowerCase();
  const password = (process.env.ADMIN_PASSWORD ?? "").trim();
  if (!username || !password) return null;

  const { data: existing, error } = await admin
    .from("admin_users")
    .select("id, username, password_hash, display_name, title, role, active")
    .eq("username", username)
    .maybeSingle();

  if (error && isMissingAdminUsers(error)) return null;
  if (existing) return existing as AdminRow;

  const { count } = await admin
    .from("admin_users")
    .select("*", { count: "exact", head: true });
  if ((count ?? 0) > 0) return null;

  const row = {
    username,
    password_hash: hashAdminPassword(password),
    display_name: "슈퍼관리자",
    title: "슈퍼관리자",
    role: "super" as const,
    active: true,
  };
  const { data, error: insErr } = await admin
    .from("admin_users")
    .insert(row)
    .select("id, username, password_hash, display_name, title, role, active")
    .maybeSingle();
  if (insErr || !data) return null;
  return data as AdminRow;
}

async function checkLoginLock(
  admin: ReturnType<typeof createAdminClient>,
  username: string,
  ip: string
): Promise<{ locked: boolean; message?: string }> {
  const { data, error } = await admin
    .from("admin_login_attempts")
    .select("failed_count, locked_until, updated_at")
    .eq("username", username)
    .eq("ip", ip)
    .maybeSingle();

  if (error && isMissingLoginAttempts(error)) {
    return { locked: false };
  }

  if (!data) return { locked: false };

  const lockedUntil = data.locked_until
    ? Date.parse(String(data.locked_until))
    : NaN;
  if (Number.isFinite(lockedUntil) && lockedUntil > Date.now()) {
    return {
      locked: true,
      message: "로그인 시도가 너무 많습니다. 30분 후 다시 시도해 주세요.",
    };
  }
  return { locked: false };
}

async function recordLoginFailure(
  admin: ReturnType<typeof createAdminClient>,
  username: string,
  ip: string
) {
  const now = new Date();
  const { data } = await admin
    .from("admin_login_attempts")
    .select("failed_count, updated_at")
    .eq("username", username)
    .eq("ip", ip)
    .maybeSingle();

  const updatedAt = data?.updated_at ? Date.parse(String(data.updated_at)) : 0;
  const withinWindow = updatedAt && Date.now() - updatedAt < LOGIN_WINDOW_MS;
  const nextFails = withinWindow ? (data?.failed_count ?? 0) + 1 : 1;
  const lockedUntil =
    nextFails >= LOGIN_MAX_FAILS
      ? new Date(Date.now() + LOGIN_LOCK_MS).toISOString()
      : null;

  await admin.from("admin_login_attempts").upsert(
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

async function clearLoginFailures(
  admin: ReturnType<typeof createAdminClient>,
  username: string,
  ip: string
) {
  await admin
    .from("admin_login_attempts")
    .delete()
    .eq("username", username)
    .eq("ip", ip);
}

async function validateSessionRow(
  admin: ReturnType<typeof createAdminClient>,
  session: AdminSession
): Promise<AdminSession | null> {
  if (session.id === "env-super") {
    const envId = (process.env.ADMIN_ID ?? "").trim().toLowerCase();
    if (!envId || session.username !== envId) return null;
    return session;
  }

  const { data, error } = await admin
    .from("admin_users")
    .select("id, username, display_name, title, role, active")
    .eq("id", session.id)
    .maybeSingle();

  if (error || !data || !data.active) return null;

  const role = data.role === "super" ? "super" : "staff";
  if (data.username !== session.username || role !== session.role) return null;

  return {
    id: String(data.id),
    username: String(data.username),
    displayName: String(data.display_name || data.username),
    title: String(
      data.title || (role === "super" ? "슈퍼관리자" : "직원")
    ),
    role,
  };
}

export async function loginAdmin(
  usernameRaw: string,
  password: string,
  ip = "unknown"
): Promise<
  | { ok: true; token: string; session: AdminSession }
  | { ok: false; message: string }
> {
  const username = usernameRaw.trim().toLowerCase();
  if (!username || !password) {
    return { ok: false, message: "아이디와 비밀번호를 입력해 주세요." };
  }

  try {
    const admin = createAdminClient();
    await ensureBootstrapSuper(admin);

    const lock = await checkLoginLock(admin, username, ip);
    if (lock.locked) {
      return { ok: false, message: lock.message ?? "잠시 후 다시 시도해 주세요." };
    }

    const { data, error } = await admin
      .from("admin_users")
      .select("id, username, password_hash, display_name, title, role, active")
      .eq("username", username)
      .maybeSingle();

    if (error && isMissingAdminUsers(error)) {
      const envId = (process.env.ADMIN_ID ?? "").trim().toLowerCase();
      const envPw = (process.env.ADMIN_PASSWORD ?? "").trim();
      if (username === envId && password === envPw && envId && envPw) {
        const session: AdminSession = {
          id: "env-super",
          username: envId,
          displayName: "슈퍼관리자",
          title: "슈퍼관리자",
          role: "super",
        };
        await writeAuditLog(admin, {
          actorName: `슈퍼관리자:${envId}`,
          action: "admin_login_success",
          entityType: "admin",
          entityId: "env-super",
          detail: { username: envId, ip },
        });
        return { ok: true, token: createAdminToken(session), session };
      }
      await recordLoginFailure(admin, username, ip);
      return {
        ok: false,
        message:
          "관리자 DB가 없습니다. Supabase에서 016_admin_users.sql 을 실행해 주세요.",
      };
    }

    const row = data as AdminRow | null;
    if (!row || !row.active) {
      await recordLoginFailure(admin, username, ip);
      await writeAuditLog(admin, {
        actorName: username,
        action: "admin_login_failed",
        entityType: "admin",
        entityId: username,
        detail: { username, ip, reason: "invalid_or_inactive" },
      });
      return { ok: false, message: "아이디 또는 비밀번호가 올바르지 않습니다." };
    }
    if (!verifyAdminPassword(password, row.password_hash)) {
      await recordLoginFailure(admin, username, ip);
      await writeAuditLog(admin, {
        actorName: username,
        action: "admin_login_failed",
        entityType: "admin",
        entityId: row.id,
        detail: { username, ip, reason: "bad_password" },
      });
      return { ok: false, message: "아이디 또는 비밀번호가 올바르지 않습니다." };
    }

    await clearLoginFailures(admin, username, ip);

    const session: AdminSession = {
      id: row.id,
      username: row.username,
      displayName: row.display_name || row.username,
      title: row.title || (row.role === "super" ? "슈퍼관리자" : "직원"),
      role: row.role === "super" ? "super" : "staff",
    };

    await writeAuditLog(admin, {
      actorUserId: row.id,
      actorName: `${session.title}:${session.displayName}`,
      action: "admin_login_success",
      entityType: "admin",
      entityId: row.id,
      detail: { username: row.username, role: session.role, ip },
    });

    return { ok: true, token: createAdminToken(session), session };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "로그인에 실패했습니다.",
    };
  }
}

export async function requireAdminSession(
  request: Request
): Promise<
  | { ok: true; session: AdminSession; admin: ReturnType<typeof createAdminClient> }
  | { ok: false; status: number; message: string }
> {
  const token = getAdminBearer(request);
  const parsed = token ? parseAdminToken(token) : null;
  if (!parsed) {
    return {
      ok: false,
      status: 401,
      message: "관리자 로그인이 필요합니다.",
    };
  }

  try {
    const admin = createAdminClient();
    const session = await validateSessionRow(admin, parsed);
    if (!session) {
      return {
        ok: false,
        status: 401,
        message: "세션이 만료되었거나 비활성화된 계정입니다.",
      };
    }
    return { ok: true, session, admin };
  } catch {
    return {
      ok: false,
      status: 503,
      message: "서버 설정을 확인해 주세요.",
    };
  }
}

export function requireSuper(
  session: AdminSession
): { ok: true } | { ok: false; status: number; message: string } {
  if (session.role !== "super") {
    return {
      ok: false,
      status: 403,
      message: "슈퍼관리자만 할 수 있습니다.",
    };
  }
  return { ok: true };
}
