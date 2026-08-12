"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { peekCurrentUser } from "@/lib/auth";
import { isForeignTeamItem } from "@/lib/teamActionGuard";
import { findMatchingProperties } from "@/lib/matchCustomerProperty";
import {
  ensureTeamAlertsUser,
  getAlertBadgeCounts,
  getTeamAlertsSnapshot,
  matchPairKey,
  subscribeTeamAlerts,
  syncMatchPairs,
  syncShareIds,
} from "@/lib/teamAlerts";
import {
  useCustomersList,
  usePropertiesList,
  useSchedulesList,
} from "@/hooks/useEntityList";

function useTeamAlertsState() {
  return useSyncExternalStore(
    subscribeTeamAlerts,
    getTeamAlertsSnapshot,
    getTeamAlertsSnapshot
  );
}

export function useAlertBadgeCounts() {
  const snap = useTeamAlertsState();
  return useMemo(() => getAlertBadgeCounts(), [snap]);
}

/** 로그인 후 리스트 기준으로 공유·매칭 알람 동기화 */
export function TeamAlertsSync() {
  const userId = peekCurrentUser()?.id ?? null;
  const { items: customers } = useCustomersList();
  const { items: properties } = usePropertiesList();
  const { items: schedules } = useSchedulesList();
  useTeamAlertsState();

  useEffect(() => {
    ensureTeamAlertsUser(userId);
    if (!userId) return;

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
