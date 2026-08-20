"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import {
  getAuthEpoch,
  peekCurrentUser,
  subscribeAuthChange,
} from "@/lib/auth";
import { isForeignTeamItem } from "@/lib/teamActionGuard";
import { findMatchingPropertiesGrouped } from "@/lib/matchCustomerProperty";
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
      const ownPairs: string[] = [];
      const partnerPairs: string[] = [];
      for (const c of customers) {
        if (c.contractCompleted) continue;
        const { own, partner } = findMatchingPropertiesGrouped(c, properties);
        for (const p of own) {
          if (p.contractCompleted) continue;
          ownPairs.push(matchPairKey(c.id, p.id));
        }
        for (const p of partner) {
          if (p.contractCompleted) continue;
          partnerPairs.push(matchPairKey(c.id, p.id));
        }
      }
      syncMatchPairs(ownPairs, partnerPairs);
    };

    // N×M 매칭은 첫 페인트 이후. 뱃지는 idle 또는 0.8초 안에 맞춰진다.
    if (typeof requestIdleCallback === "function") {
      const idleId = requestIdleCallback(runMatch, { timeout: 800 });
      return () => cancelIdleCallback(idleId);
    }
    const timer = window.setTimeout(runMatch, 0);
    return () => window.clearTimeout(timer);
  }, [userId, customers, properties, schedules]);

  return null;
}
