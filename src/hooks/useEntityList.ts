"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type Dispatch,
  type SetStateAction,
} from "react";
import { getSessionUserId, peekCurrentUser } from "@/lib/auth";
import {
  ensureEntityCacheUser,
  hydrateEntityCacheIfNeeded,
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
 * hydration 이후 getSnapshot에서 session 캐시를 먼저 복원한다.
 */
function useEntityListState<T>(
  peek: () => T[] | null,
  loadFresh: () => Promise<T[]>
) {
  const readSnapshot = useMemo(
    () => () => {
      if (typeof window !== "undefined") {
        hydrateEntityCacheIfNeeded(peekCurrentUser()?.id ?? null);
      }
      return peek();
    },
    [peek]
  );

  const cached = useSyncExternalStore(
    subscribeEntityCache,
    readSnapshot,
    () => null
  );

  /** 낙관적 갱신용. null이면 캐시를 그대로 표시 */
  const [override, setOverride] = useState<T[] | null>(null);
  const [loading, setLoading] = useState(() => {
    if (typeof window === "undefined") return true;
    hydrateEntityCacheIfNeeded(peekCurrentUser()?.id ?? null);
    return peek() === null;
  });

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
      const hadCache = Boolean(peek());
      if (!hadCache) {
        setLoading(true);
      }
      try {
        await loadFresh();
      } catch {
        /* 캐시가 있으면 그대로 두고, 없으면 빈 목록 */
      }
      if (!cancelled) setLoading(false);
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
