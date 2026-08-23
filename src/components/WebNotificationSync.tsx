"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import {
  collectUnseenMatchPairKeys,
} from "@/lib/alertCounts";
import {
  deepLinkForMatchPair,
} from "@/lib/alertMessaging";
import {
  peekCustomers,
  peekProperties,
  subscribeEntityCache,
} from "@/lib/entityCache";
import {
  getTeamAlertsSnapshot,
  subscribeTeamAlerts,
} from "@/lib/teamAlerts";
import {
  getAuthEpoch,
  peekCurrentUser,
  subscribeAuthChange,
} from "@/lib/auth";
import {
  resolveEntitiesForPair,
  showMatchWebNotification,
} from "@/lib/webNotifications";
import type { Customer, ListedProperty } from "@/lib/types";

function useAlertSnap() {
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
  return peekCurrentUser()?.id ?? null;
}

function useEntityLists(): {
  customers: Customer[] | null;
  properties: ListedProperty[] | null;
} {
  const customers = useSyncExternalStore(
    subscribeEntityCache,
    peekCustomers,
    () => null
  );
  const properties = useSyncExternalStore(
    subscribeEntityCache,
    peekProperties,
    () => null
  );
  return { customers, properties };
}

/** 탭이 열려 있을 때 새 매칭 — Notification API (markMatchSeen 호출 없음) */
export function WebNotificationSync() {
  const snap = useAlertSnap();
  const userId = useAuthUserId();
  const { customers, properties } = useEntityLists();
  const prevRef = useRef<{ own: Set<string>; partner: Set<string> } | null>(
    null
  );

  useEffect(() => {
    if (!userId) {
      prevRef.current = null;
      return;
    }
    if (customers === null || properties === null) return;

    const current = collectUnseenMatchPairKeys(snap);
    const prev = prevRef.current;

    if (prev) {
      for (const pairKey of current.own) {
        if (prev.own.has(pairKey)) continue;
        const entities = resolveEntitiesForPair(pairKey, customers, properties);
        if (!entities) continue;
        showMatchWebNotification({
          userId,
          kind: "match",
          pairKey,
          customer: entities.customer,
          property: entities.property,
          url: deepLinkForMatchPair(
            entities.customer.id,
            entities.property.id,
            "customer"
          ),
        });
      }
      for (const pairKey of current.partner) {
        if (prev.partner.has(pairKey)) continue;
        const entities = resolveEntitiesForPair(pairKey, customers, properties);
        if (!entities) continue;
        const onCustomerSide = snap.unseenNewMatchCustomer.includes(pairKey);
        const side: "customer" | "property" = onCustomerSide
          ? "customer"
          : "property";
        showMatchWebNotification({
          userId,
          kind: "newMatch",
          pairKey,
          customer: entities.customer,
          property: entities.property,
          side,
          url: deepLinkForMatchPair(
            entities.customer.id,
            entities.property.id,
            side
          ),
        });
      }
    }

    prevRef.current = {
      own: new Set(current.own),
      partner: new Set(current.partner),
    };
  }, [snap, userId, customers, properties]);

  return null;
}
