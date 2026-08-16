import { loadAppAuth } from "@/lib/supabase/appAuth";
import { getAccessToken } from "@/lib/auth";
import {
  DEMO_CORE_IDS,
  DEMO_CREATOR_LABEL_VERSION,
  DEMO_SEED_VERSION,
  isDemoSeedExpired,
} from "@/lib/demoSeedPayload";
import {
  clearEntityCache,
  removeCustomerFromCache,
  removePropertyFromCache,
  removeScheduleFromCache,
} from "@/lib/entityCache";
import {
  ensureTeamAlertsUser,
  injectDemoTestAlerts,
  matchPairKey,
} from "@/lib/teamAlerts";

function seedSkipKey(userId: string) {
  return `realty_seed_done_${DEMO_SEED_VERSION}:${DEMO_CREATOR_LABEL_VERSION}:${userId}`;
}

function demoAlertsFlagKey(userId: string) {
  // 시드 버전과 무관 — 버전 bump 때마다 알람이 다시 켜지지 않게
  return `realty_demo_alerts_once:${userId}`;
}

function hasInjectedDemoAlerts(userId: string): boolean {
  try {
    if (localStorage.getItem(demoAlertsFlagKey(userId)) === "1") return true;
    // 예전 버전별 키 → 한 번이라도 주입했으면 재주입 금지로 이관
    const suffix = `:${userId}`;
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (
        key &&
        key.startsWith("realty_demo_alerts_") &&
        key.endsWith(suffix) &&
        localStorage.getItem(key) === "1"
      ) {
        localStorage.setItem(demoAlertsFlagKey(userId), "1");
        return true;
      }
    }
  } catch {
    /* ignore */
  }
  return false;
}

function markDemoAlertsInjected(userId: string) {
  try {
    localStorage.setItem(demoAlertsFlagKey(userId), "1");
  } catch {
    /* ignore */
  }
}

function purgeExpiredDemoFromCache() {
  const [custId, propId, schId] = DEMO_CORE_IDS;
  removeCustomerFromCache(custId);
  removePropertyFromCache(propId);
  removeScheduleFromCache(schId);
}

/** 시드 upsert 후 옛 payload(선호위치 없음)가 캐시에 남지 않게 */
function invalidateAfterDemoSeed() {
  clearEntityCache();
}

function injectDemoAlertsOnce(userId: string) {
  if (hasInjectedDemoAlerts(userId)) return;

  ensureTeamAlertsUser(userId);
  const [custId, propId, schId] = DEMO_CORE_IDS;
  injectDemoTestAlerts({
    customerIds: [custId],
    propertyIds: [propId],
    scheduleIds: [schId],
    matchPairs: [matchPairKey(custId, propId)],
  });

  markDemoAlertsInjected(userId);
}

/**
 * 로그인 계정에 테스트용 고객·매물·방문일정 시드
 * - 서버(service_role) API로 심어 RLS/컬럼 이슈를 피함
 * - 탭 세션(로그인)당 한 번만 시도
 * - 이미 시드된 버전이면 삭제한 데모를 되살리지 않음
 * - 시드 후 체험용 알람(공유·매칭)을 한 번 띄움
 * - 가입일로부터 7일이 지나면 시드하지 않고 데모 카드를 만료 처리
 */
export async function seedDemoDataIfNeeded(): Promise<void> {
  if (typeof window === "undefined") return;

  const appAuth = loadAppAuth();
  const userId = appAuth?.user?.id;
  if (!userId) return;

  try {
    if (sessionStorage.getItem(seedSkipKey(userId))) {
      if (isDemoSeedExpired(appAuth.user.createdAt)) {
        purgeExpiredDemoFromCache();
      }
      injectDemoAlertsOnce(userId);
      return;
    }
  } catch {
    /* ignore */
  }

  try {
    const token = await getAccessToken();
    if (!token) return;

    const res = await fetch("/api/demo/seed", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        forceMissing: false,
        createdAt: appAuth?.user?.createdAt ?? null,
      }),
    });

    const body = (await res.json().catch(() => null)) as {
      message?: string;
      expired?: boolean;
      seeded?: boolean;
      relabeled?: boolean;
    } | null;

    if (!res.ok) {
      console.warn("[seedDemo] api failed:", body?.message ?? res.status);
    }

    if (body?.expired) {
      purgeExpiredDemoFromCache();
    } else {
      if (body?.seeded || body?.relabeled) invalidateAfterDemoSeed();
      injectDemoAlertsOnce(userId);
    }

    try {
      sessionStorage.setItem(seedSkipKey(userId), "1");
    } catch {
      /* ignore */
    }
  } catch (e) {
    console.warn("[seedDemo] skipped:", e);
    try {
      sessionStorage.setItem(seedSkipKey(userId), "1");
    } catch {
      /* ignore */
    }
  }
}
