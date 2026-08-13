"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { peekCurrentUser } from "@/lib/auth";
import { isForeignTeamItem } from "@/lib/teamActionGuard";
import { findMatchingProperties } from "@/lib/matchCustomerProperty";
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
  matchPairKey,
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
  return useMemo(() => getAlertBadgeCounts(), [snap]);
}

/** 로그인 후 리스트 기준으로 공유·매칭 알람 동기화 */
export function TeamAlertsSync() {
  const userId = peekCurrentUser()?.id ?? null;
  const customers = useCachedCustomers();
  const properties = useCachedProperties();
  const schedules = useCachedSchedules();

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

    const pairs: string[] = [];
    for (const c of customers) {
      if (c.contractCompleted) continue;
      const matched = findMatchingProperties(c, properties);
      for (const p of matched) {
        if (p.contractCompleted) continue;
        pairs.push(matchPairKey(c.id, p.id));
      }
    }
    syncMatchPairs(pairs);
  }, [userId, customers, properties, schedules]);

  return null;
}
