"use client";

import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadAppAuth } from "./appAuth";
import { sanitizeSupabaseKey } from "./keys";

let browserClient: SupabaseClient | null = null;

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = sanitizeSupabaseKey(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  if (!url || !anonKey) {
    throw new Error(
      "Supabase 환경변수가 없습니다. .env.local에 NEXT_PUBLIC_SUPABASE_URL과 NEXT_PUBLIC_SUPABASE_ANON_KEY를 설정하세요."
    );
  }

  if (typeof window !== "undefined") {
    if (!browserClient) {
      browserClient = createSupabaseClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storage: window.localStorage,
          flowType: "implicit",
        },
        global: {
          // Supabase 내부 세션이 비어도, 앱이 저장한 토큰으로 API 호출
          fetch: (input, init = {}) => {
            const headers = new Headers(init.headers ?? {});
            const appAuth = loadAppAuth();
            if (appAuth?.access_token && !headers.has("Authorization")) {
              headers.set("Authorization", `Bearer ${appAuth.access_token}`);
            }
            return fetch(input, { ...init, headers });
          },
        },
      });
    }
    return browserClient;
  }

  return createSupabaseClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/** 로그인 직후 등 클라이언트 싱글톤 재생성 */
export function resetBrowserClient(): void {
  browserClient = null;
}
