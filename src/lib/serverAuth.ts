import { createAdminClient } from "@/lib/supabase/admin";

export async function getAuthUserFromToken(accessToken: string) {
  const token = accessToken.trim();
  if (!token) return null;
  const admin = createAdminClient();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;
  return { admin, user: data.user, accessToken: token };
}

export function getBearerToken(request: Request): string {
  const authHeader = request.headers.get("authorization") ?? "";
  if (authHeader.startsWith("Bearer ")) return authHeader.slice(7).trim();
  return "";
}

export function requireAdminKey(request: Request): boolean {
  const expectedId = (process.env.ADMIN_ID ?? "").trim();
  const expectedPw = (process.env.ADMIN_PASSWORD ?? "").trim();
  if (!expectedId || !expectedPw) return false;

  const gotId = (request.headers.get("x-admin-id") ?? "").trim();
  const gotPw = (request.headers.get("x-admin-password") ?? "").trim();
  return gotId === expectedId && gotPw === expectedPw;
}

export function generateShareCode(length = 8): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}
