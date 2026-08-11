import { loadAppAuth } from "@/lib/supabase/appAuth";
import { getAccessToken } from "@/lib/auth";
import {
  DEMO_CORE_IDS,
  DEMO_SEED_VERSION,
  buildDemoSeedData,
  demoSeedBaseDate,
  isDemoEntityId,
  DEMO_GANGDONG_OFFICE_ADDRESS,
  DEMO_TEST_PHONE,
} from "@/lib/demoSeedPayload";

export {
  DEMO_SEED_VERSION,
  DEMO_GANGDONG_OFFICE_ADDRESS,
  DEMO_TEST_PHONE,
  buildDemoSeedData,
  isDemoEntityId,
};

const SEED_SKIP_KEY = `realty_seed_skip_${DEMO_SEED_VERSION}`;

/**
 * 로그인 계정에 테스트용 고객·매물·방문일정 시드
 * - 서버(service_role) API로 심어 RLS/컬럼 이슈를 피함
 * - 데모 행이 없으면 같은 버전이라도 복구
 */
export async function seedDemoDataIfNeeded(): Promise<void> {
  if (typeof window === "undefined") return;

  try {
    if (sessionStorage.getItem(SEED_SKIP_KEY)) return;
  } catch {
    /* ignore */
  }

  try {
    const token = await getAccessToken();
    if (!token) return;

    const appAuth = loadAppAuth();
    const res = await fetch("/api/demo/seed", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        forceMissing: true,
        createdAt: appAuth?.user?.createdAt ?? null,
      }),
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as {
        message?: string;
      } | null;
      console.warn("[seedDemo] api failed:", body?.message ?? res.status);
      try {
        sessionStorage.setItem(SEED_SKIP_KEY, "1");
      } catch {
        /* ignore */
      }
      return;
    }

    try {
      sessionStorage.removeItem(SEED_SKIP_KEY);
    } catch {
      /* ignore */
    }
  } catch (e) {
    console.warn("[seedDemo] skipped:", e);
    try {
      sessionStorage.setItem(SEED_SKIP_KEY, "1");
    } catch {
      /* ignore */
    }
  }
}

/** 로컬/테스트용 — 페이로드만 필요할 때 */
export function peekDemoSeedData(baseDate?: Date) {
  return buildDemoSeedData(demoSeedBaseDate(baseDate ?? null));
}

export { DEMO_CORE_IDS };
