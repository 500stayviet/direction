"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import {
  getAuthEpoch,
  peekCurrentUser,
  subscribeAuthChange,
} from "@/lib/auth";
import { useMatchPoolEntities } from "@/hooks/useMatchPool";
import { isForeignTeamItem } from "@/lib/teamActionGuard";
import {
  buildMatchAlertSideMaps,
  computeMatchPairKeys,
  indexCustomers,
  indexProperties,
} from "@/lib/matchPools";
import {
  peekCustomers,
  peekProperties,
  peekSchedules,
  subscribeEntityCache,
} from "@/lib/entityCache";
import {
  ensureTeamAlertsUser,
  getAlertBadgeCounts,
  getTeamAlertsSnapshot,
  subscribeTeamAlerts,
  syncMatchPairs,
  syncShareIds,
} from "@/lib/teamAlerts";
import type { Customer, ListedProperty, Schedule } from "@/lib/types";

function useTeamAlertsState() {
  return useSyncExternalStore(
    subscribeTeamAlerts,
    getTeamAlertsSnapshot,
    getTeamAlertsSnapshot
  );
}

function useAuthUserId(): string | null {
  const epoch = useSyncExternalStore(
    subscribeAuthChange,
    getAuthEpoch,
    () => 0
  );
  return useMemo(() => {
    void epoch;
    return peekCurrentUser()?.id ?? null;
  }, [epoch]);
}

function useCachedCustomers() {
  return useSyncExternalStore(
    subscribeEntityCache,
    peekCustomers,
    () => null as Customer[] | null
  );
}

function useCachedProperties() {
  return useSyncExternalStore(
    subscribeEntityCache,
    peekProperties,
    () => null as ListedProperty[] | null
  );
}

function useCachedSchedules() {
  return useSyncExternalStore(
    subscribeEntityCache,
    peekSchedules,
    () => null as Schedule[] | null
  );
}

export function useAlertBadgeCounts() {
  const snap = useTeamAlertsState();
  const userId = useAuthUserId();
  return useMemo(() => {
    if (!userId) {
      return { customers: 0, properties: 0, navi: 0 };
    }
    void snap;
    return getAlertBadgeCounts();
  }, [snap, userId]);
}

/** 로그인 후 리스트 기준으로 공유·매칭 알람 동기화 */
export function TeamAlertsSync() {
  const userId = useAuthUserId();
  const customers = useCachedCustomers();
  const properties = useCachedProperties();
  const schedules = useCachedSchedules();
  const matchPool = useMatchPoolEntities(userId);

  useEffect(() => {
    ensureTeamAlertsUser(userId);
    if (!userId) return;
    // 캐시 미로드(null)일 때 []로 동기화하면 known/unseen이 비었다가
    // 다시 채워지며 꺼둔 알람이 신규처럼 부활함
    if (customers === null || properties === null || schedules === null) return;

    syncShareIds(
      "customers",
      customers
        .filter((c) => isForeignTeamItem(c.createdBy, userId))
        .map((c) => c.id)
    );
    syncShareIds(
      "properties",
      properties
        .filter((p) => isForeignTeamItem(p.createdBy, userId))
        .map((p) => p.id)
    );
    syncShareIds(
      "navi",
      schedules
        .filter((s) => isForeignTeamItem(s.createdBy, userId))
        .map((s) => s.id)
    );

    const runMatch = () => {
      const poolCustomers = matchPool.customers ?? customers;
      const poolProperties = matchPool.properties ?? properties;
      const { ownKeys, siteKeys } = computeMatchPairKeys({
        customers: poolCustomers,
        properties: poolProperties,
        userId,
      });
      const sideMaps = buildMatchAlertSideMaps({
        userId,
        ownKeys,
        siteKeys,
        customersById: indexCustomers(poolCustomers),
        propertiesById: indexProperties(poolProperties),
      });
      syncMatchPairs(ownKeys, siteKeys, sideMaps);
    };

    // N×M 매칭은 첫 페인트 이후. 뱃지는 idle 또는 0.8초 안에 맞춰진다.
    if (typeof requestIdleCallback === "function") {
      const idleId = requestIdleCallback(runMatch, { timeout: 800 });
      return () => cancelIdleCallback(idleId);
    }
    const timer = window.setTimeout(runMatch, 0);
    return () => window.clearTimeout(timer);
  }, [
    userId,
    customers,
    properties,
    schedules,
    matchPool.customers,
    matchPool.properties,
  ]);

  return null;
}
