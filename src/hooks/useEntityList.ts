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
import {
  getAccessToken,
  getAuthEpoch,
  getSessionUserId,
  peekCurrentUser,
  subscribeAuthChange,
} from "@/lib/auth";
import {
  ensureEntityCacheUser,
  hydrateEntityCacheIfNeeded,
  peekCustomers,
  peekProperties,
  peekSchedules,
  subscribeEntityCache,
} from "@/lib/entityCache";
import {
  loadCustomersList,
  loadListedPropertiesList,
  loadSchedulesList,
  type EntityListLoadResult,
} from "@/lib/storage";
import type { Customer, ListedProperty, Schedule } from "@/lib/types";

/** pending = 아직 확정 전(로딩). ready = fetch 성공 또는 캐시로 표시 가능 */
export type EntityListStatus = "pending" | "ready";

function hasListCache<T>(peek: () => T[] | null): boolean {
  return peek() !== null;
}

/** 카드 없을 때 「불러오는 중」 */
export function showEntityListLoading(
  status: EntityListStatus,
  count: number
): boolean {
  return status === "pending" && count === 0;
}

/** fetch·캐시로 「등록된 … 없습니다」 확정 */
export function isEntityListEmptyConfirmed(
  status: EntityListStatus,
  count: number
): boolean {
  return status === "ready" && count === 0;
}

function resolveStatusAfterFetch<T>(
  peek: () => T[] | null,
  result: EntityListLoadResult<T>
): EntityListStatus {
  if (result.ok) return "ready";
  if (hasListCache(peek)) return "ready";
  return "pending";
}

/**
 * sessionStorage/메모리 캐시는 클라이언트 전용.
 * fetch 실패 + 캐시 없음 → pending 유지(auth 재시도).
 * 캐시 있으면 즉시 ready( stale-while-revalidate ).
 */
function useEntityListState<T>(
  peek: () => T[] | null,
  loadFresh: () => Promise<EntityListLoadResult<T>>
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

  const [override, setOverride] = useState<T[] | null>(null);
  const [status, setStatus] = useState<EntityListStatus>("pending");
  const [authEpoch, setAuthEpoch] = useState(0);

  const items = override ?? cached ?? [];
  const loading = showEntityListLoading(status, items.length);

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
      setStatus("ready");
      return;
    }
    if (!hasListCache(peek)) {
      setStatus("pending");
    }
  }, [cached, peek]);

  useEffect(() => {
    const syncedId = peekCurrentUser()?.id ?? null;
    if (syncedId) ensureEntityCacheUser(syncedId);
  }, []);

  useEffect(() => subscribeAuthChange(() => setAuthEpoch(getAuthEpoch())), []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const userId = await getSessionUserId();
      if (userId) ensureEntityCacheUser(userId);
      if (cancelled) return;

      const user = peekCurrentUser();
      const token = await getAccessToken();
      if (!user?.id || !token) {
        setStatus(hasListCache(peek) ? "ready" : "pending");
        return;
      }

      if (!hasListCache(peek)) {
        setStatus("pending");
      }

      try {
        const result = await loadFresh();
        if (cancelled) return;
        setStatus(resolveStatusAfterFetch(peek, result));
      } catch {
        if (cancelled) return;
        setStatus(hasListCache(peek) ? "ready" : "pending");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loadFresh, peek, authEpoch]);

  return { items, status, loading, setItems };
}

export function useCustomersList() {
  return useEntityListState<Customer>(peekCustomers, loadCustomersList);
}

export function usePropertiesList() {
  return useEntityListState<ListedProperty>(
    peekProperties,
    loadListedPropertiesList
  );
}

export function useSchedulesList() {
  return useEntityListState<Schedule>(peekSchedules, loadSchedulesList);
}
