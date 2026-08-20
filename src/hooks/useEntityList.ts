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

function hasUsableListCache<T>(peek: () => T[] | null): boolean {
  const list = peek();
  return list !== null && list.length > 0;
}

/**
 * sessionStorage/메모리 캐시는 클라이언트 전용.
 * 서버 fetch가 끝나기 전에는 리스트 UI가 「없습니다」를 보여 주지 않도록
 * loading을 유지한다 (캐시에 카드가 이미 있으면 즉시 표시).
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
    return !hasUsableListCache(peek);
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

  useEffect(() => {
    if (cached !== null) {
      setOverride(null);
    }
  }, [cached]);

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

      if (!hasUsableListCache(peek)) {
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
