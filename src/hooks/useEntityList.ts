"use client";

import {
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
  type Dispatch,
  type SetStateAction,
} from "react";
import { getSessionUserId, peekCurrentUser } from "@/lib/auth";
import {
  ensureEntityCacheUser,
  peekCustomers,
  peekProperties,
  peekSchedules,
  subscribeEntityCache,
} from "@/lib/entityCache";
import {
  getCustomers,
  getListedProperties,
  getSchedules,
} from "@/lib/storage";
import type { Customer, ListedProperty, Schedule } from "@/lib/types";

/**
 * sessionStorage/메모리 캐시는 클라이언트 전용.
 * useSyncExternalStore의 getServerSnapshot=null 로 SSR·hydration을 맞추고,
 * hydration 이후에만 캐시 스냅샷을 쓴다 (등록 N명 불일치 방지).
 *
 * getSnapshot은 순수 읽기만 — ensureEntityCacheUser(notify)는 이펙트에서.
 */
function useEntityListState<T>(
  peek: () => T[] | null,
  loadFresh: () => Promise<T[]>
) {
  const cached = useSyncExternalStore(
    subscribeEntityCache,
    peek,
    () => null
  );

  /** 낙관적 갱신용. null이면 캐시를 그대로 표시 */
  const [override, setOverride] = useState<T[] | null>(null);
  const [loading, setLoading] = useState(true);

  const items = override ?? cached ?? [];

  const setItems = useCallback<Dispatch<SetStateAction<T[]>>>(
    (action) => {
      setOverride((prev) => {
        const base = prev ?? cached ?? [];
        return typeof action === "function" ? action(base) : action;
      });
    },
    [cached]
  );

  // 캐시가 바뀌면 override를 비워 캐시를 따름 (기존 subscribe → setItems(cached)와 동일)
  useEffect(() => {
    if (cached) {
      setOverride(null);
      setLoading(false);
    }
  }, [cached]);

  // 렌더 중 notify 금지 — session 캐시 채우기는 마운트/세션 확정 후
  useEffect(() => {
    const syncedId = peekCurrentUser()?.id ?? null;
    if (syncedId) ensureEntityCacheUser(syncedId);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const userId = await getSessionUserId();
      ensureEntityCacheUser(userId);
      if (cancelled) return;
      if (peek()) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        await loadFresh();
        if (!cancelled) setLoading(false);
      } catch {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadFresh, peek]);

  return { items, loading, setItems };
}

export function useCustomersList() {
  return useEntityListState<Customer>(peekCustomers, getCustomers);
}

export function usePropertiesList() {
  return useEntityListState<ListedProperty>(
    peekProperties,
    getListedProperties
  );
}

export function useSchedulesList() {
  return useEntityListState<Schedule>(peekSchedules, getSchedules);
}
