import { createClient } from "@supabase/supabase-js";
import { sanitizeSupabaseKey } from "./keys";

/** 서버 전용. service_role 키 — 클라이언트/NEXT_PUBLIC에 절대 노출하지 말 것 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = sanitizeSupabaseKey(
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  if (!url || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY가 없습니다. 비밀번호 재설정용으로 .env.local에 서버 전용으로만 설정하세요."
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
