"use client";

import { useMemo, useSyncExternalStore } from "react";
import {
  getListCardAlertBadges,
  getTeamAlertsSnapshot,
  subscribeTeamAlerts,
  type AlertTab,
  type ListCardBadge,
} from "@/lib/teamAlerts";

export function useListCardAlertBadges(input: {
  tab: AlertTab;
  id: string;
  deadlineLabel?: string | null;
  deadlineAt?: number;
}): ListCardBadge[] {
  const snap = useSyncExternalStore(
    subscribeTeamAlerts,
    getTeamAlertsSnapshot,
    getTeamAlertsSnapshot
  );
  const { tab, id, deadlineLabel, deadlineAt } = input;
  return useMemo(() => {
    void snap;
    return getListCardAlertBadges({ tab, id, deadlineLabel, deadlineAt });
  }, [snap, tab, id, deadlineLabel, deadlineAt]);
}
