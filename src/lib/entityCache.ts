"use client";

import type { Customer, ListedProperty, Schedule } from "@/lib/types";

export type EntityBucket = "customers" | "properties" | "schedules";

type CacheState = {
  userId: string | null;
  customers: Customer[] | null;
  properties: ListedProperty[] | null;
  schedules: Schedule[] | null;
  updatedAt: Record<EntityBucket, number>;
};

const STORAGE_KEY = "realty_entity_cache_v1";

type Listener = () => void;
const listeners = new Set<Listener>();

let state: CacheState = {
  userId: null,
  customers: null,
  properties: null,
  schedules: null,
  updatedAt: { customers: 0, properties: 0, schedules: 0 },
};

function notify() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* ignore */
    }
  });
}

type StoredCache = {
  customers?: Customer[] | null;
  properties?: ListedProperty[] | null;
  schedules?: Schedule[] | null;
  updatedAt?: Partial<Record<EntityBucket, number>>;
};

function readStored(userId: string): StoredCache | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(`${STORAGE_KEY}:${userId}`);
    if (!raw) return null;
    return JSON.parse(raw) as StoredCache;
  } catch {
    return null;
  }
}

function persist() {
  if (typeof window === "undefined" || !state.userId) return;
  try {
    // null 버킷은 기존 session 값을 유지 — 고객만 갱신해도 매물·네비 캐시가 지워지지 않게
    const prev = readStored(state.userId) ?? {};
    sessionStorage.setItem(
      `${STORAGE_KEY}:${state.userId}`,
      JSON.stringify({
        customers: state.customers ?? prev.customers ?? null,
        properties: state.properties ?? prev.properties ?? null,
        schedules: state.schedules ?? prev.schedules ?? null,
        updatedAt: {
          customers:
            state.customers !== null
              ? state.updatedAt.customers
              : (prev.updatedAt?.customers ?? 0),
          properties:
            state.properties !== null
              ? state.updatedAt.properties
              : (prev.updatedAt?.properties ?? 0),
          schedules:
            state.schedules !== null
              ? state.updatedAt.schedules
              : (prev.updatedAt?.schedules ?? 0),
        },
      })
    );
  } catch {
    /* quota / private mode */
  }
}

/** sessionStorage에서 아직 비어 있는 버킷만 채움 */
function fillMissingFromSession(userId: string) {
  if (typeof window === "undefined") return false;
  const parsed = readStored(userId);
  if (!parsed) {
    if (state.userId !== userId) {
      state = {
        userId,
        customers: null,
        properties: null,
        schedules: null,
        updatedAt: { customers: 0, properties: 0, schedules: 0 },
      };
      return true;
    }
    return false;
  }

  let changed = state.userId !== userId;
  const next: CacheState = {
    userId,
    customers: state.userId === userId ? state.customers : null,
    properties: state.userId === userId ? state.properties : null,
    schedules: state.userId === userId ? state.schedules : null,
    updatedAt:
      state.userId === userId
        ? { ...state.updatedAt }
        : { customers: 0, properties: 0, schedules: 0 },
  };

  if (next.customers === null && parsed.customers) {
    next.customers = parsed.customers;
    next.updatedAt.customers = parsed.updatedAt?.customers ?? 0;
    changed = true;
  }
  if (next.properties === null && parsed.properties) {
    next.properties = parsed.properties;
    next.updatedAt.properties = parsed.updatedAt?.properties ?? 0;
    changed = true;
  }
  if (next.schedules === null && parsed.schedules) {
    next.schedules = parsed.schedules;
    next.updatedAt.schedules = parsed.updatedAt?.schedules ?? 0;
    changed = true;
  }

  if (changed) state = next;
  return changed;
}

export function ensureEntityCacheUser(userId: string | null) {
  if (!userId) {
    clearEntityCache();
    return;
  }
  if (fillMissingFromSession(userId)) {
    notify();
  }
}

export function subscribeEntityCache(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function peekCustomers(): Customer[] | null {
  return state.customers;
}

export function peekProperties(): ListedProperty[] | null {
  return state.properties;
}

export function peekSchedules(): Schedule[] | null {
  return state.schedules;
}

export function setCustomersCache(list: Customer[]) {
  state.customers = list;
  state.updatedAt.customers = Date.now();
  persist();
  notify();
}

export function setPropertiesCache(list: ListedProperty[]) {
  state.properties = list;
  state.updatedAt.properties = Date.now();
  persist();
  notify();
}

export function setSchedulesCache(list: Schedule[]) {
  state.schedules = list;
  state.updatedAt.schedules = Date.now();
  persist();
  notify();
}

export function upsertCustomerInCache(customer: Customer) {
  const prev = state.customers ?? [];
  const idx = prev.findIndex((c) => c.id === customer.id);
  const next =
    idx >= 0
      ? prev.map((c, i) => (i === idx ? customer : c))
      : [customer, ...prev];
  setCustomersCache(next);
}

export function removeCustomerFromCache(id: string) {
  if (!state.customers) return;
  setCustomersCache(state.customers.filter((c) => c.id !== id));
  if (state.schedules) {
    setSchedulesCache(state.schedules.filter((s) => s.customerId !== id));
  }
}

export function upsertPropertyInCache(property: ListedProperty) {
  const prev = state.properties ?? [];
  const idx = prev.findIndex((p) => p.id === property.id);
  const next =
    idx >= 0
      ? prev.map((p, i) => (i === idx ? property : p))
      : [property, ...prev];
  setPropertiesCache(next);
}

export function removePropertyFromCache(id: string) {
  if (!state.properties) return;
  setPropertiesCache(state.properties.filter((p) => p.id !== id));
}

export function upsertScheduleInCache(schedule: Schedule) {
  const prev = state.schedules ?? [];
  const idx = prev.findIndex((s) => s.id === schedule.id);
  const next =
    idx >= 0
      ? prev.map((s, i) => (i === idx ? schedule : s))
      : [schedule, ...prev];
  setSchedulesCache(next);
}

export function removeScheduleFromCache(id: string) {
  if (!state.schedules) return;
  setSchedulesCache(state.schedules.filter((s) => s.id !== id));
}

export function clearEntityCache() {
  if (state.userId && typeof window !== "undefined") {
    try {
      sessionStorage.removeItem(`${STORAGE_KEY}:${state.userId}`);
    } catch {
      /* ignore */
    }
  }
  state = {
    userId: null,
    customers: null,
    properties: null,
    schedules: null,
    updatedAt: { customers: 0, properties: 0, schedules: 0 },
  };
  notify();
}

export function findCustomerInCache(id: string): Customer | undefined {
  return state.customers?.find((c) => c.id === id);
}

export function findPropertyInCache(id: string): ListedProperty | undefined {
  return state.properties?.find((p) => p.id === id);
}

export function findScheduleInCache(id: string): Schedule | undefined {
  return state.schedules?.find((s) => s.id === id);
}
