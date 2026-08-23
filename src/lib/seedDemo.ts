import { loadAppAuth } from "@/lib/supabase/appAuth";
import { getAccessToken } from "@/lib/auth";
import {
  DEMO_CORE_IDS,
  DEMO_CREATOR_LABEL_VERSION,
  DEMO_SEED_VERSION,
  isDemoHiddenForUser,
} from "@/lib/demoSeedPayload";
import {
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
  // v2: 고객 매칭 + 매물 팀공유 뱃지
  return `realty_demo_alerts_v2:${userId}`;
}

function hasInjectedDemoAlerts(userId: string): boolean {
  try {
    return localStorage.getItem(demoAlertsFlagKey(userId)) === "1";
  } catch {
    return false;
  }
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

/** 시드 upsert 후 서버에서 리스트를 다시 받음 — clearEntityCache는 빈 화면 깜빡임 유발 */
function invalidateAfterDemoSeed() {
  void import("@/lib/storage")
    .then((m) => m.refreshAllEntityLists())
    .catch(() => undefined);
}

function injectDemoAlertsOnce(userId: string) {
  if (hasInjectedDemoAlerts(userId)) return;

  ensureTeamAlertsUser(userId);
  const [custId, propId, schId] = DEMO_CORE_IDS;
  injectDemoTestAlerts({
    matchPairs: [matchPairKey(custId, propId)],
    sharePropertyIds: [propId],
  });

  markDemoAlertsInjected(userId);
}

/**
 * 로그인 계정에 테스트용 고객·매물·방문일정 시드
 * - 서버(service_role) API로 심어 RLS/컬럼 이슈를 피함
 * - 탭 세션(로그인)당 한 번만 시도
 * - 이미 시드된 버전이면 삭제한 데모를 되살리지 않음
 * - 시드 후 체험 알람: 고객은 매칭, 매물은 팀공유 (한 번씩)
 * - 가입일로부터 7일이 지나면 시드하지 않고 데모 카드를 만료 처리
 */
export async function seedDemoDataIfNeeded(): Promise<void> {
  if (typeof window === "undefined") return;

  const appAuth = loadAppAuth();
  const userId = appAuth?.user?.id;
  if (!userId) return;

  try {
    if (sessionStorage.getItem(seedSkipKey(userId))) {
      if (isDemoHiddenForUser(appAuth.user)) {
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
