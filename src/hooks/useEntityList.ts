"use client";

import { useEffect, useState } from "react";
import { getSessionUserId } from "@/lib/auth";
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

export function useCustomersList() {
  const [items, setItems] = useState<Customer[]>(() => peekCustomers() ?? []);
  const [loading, setLoading] = useState(() => peekCustomers() === null);

  useEffect(() => {
    let cancelled = false;
    const unsub = subscribeEntityCache(() => {
      const cached = peekCustomers();
      if (cached) setItems(cached);
    });

    void (async () => {
      const userId = await getSessionUserId();
      ensureEntityCacheUser(userId);
      if (cancelled) return;
      const cached = peekCustomers();
      if (cached) {
        setItems(cached);
        setLoading(false);
      } else {
        setLoading(true);
      }
      try {
        const fresh = await getCustomers();
        if (!cancelled) {
          setItems(fresh);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  return { items, loading, setItems };
}

export function usePropertiesList() {
  const [items, setItems] = useState<ListedProperty[]>(
    () => peekProperties() ?? []
  );
  const [loading, setLoading] = useState(() => peekProperties() === null);

  useEffect(() => {
    let cancelled = false;
    const unsub = subscribeEntityCache(() => {
      const cached = peekProperties();
      if (cached) setItems(cached);
    });

    void (async () => {
      const userId = await getSessionUserId();
      ensureEntityCacheUser(userId);
      if (cancelled) return;
      const cached = peekProperties();
      if (cached) {
        setItems(cached);
        setLoading(false);
      } else {
        setLoading(true);
      }
      try {
        const fresh = await getListedProperties();
        if (!cancelled) {
          setItems(fresh);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  return { items, loading, setItems };
}

export function useSchedulesList() {
  const [items, setItems] = useState<Schedule[]>(() => peekSchedules() ?? []);
  const [loading, setLoading] = useState(() => peekSchedules() === null);

  useEffect(() => {
    let cancelled = false;
    const unsub = subscribeEntityCache(() => {
      const cached = peekSchedules();
      if (cached) setItems(cached);
    });

    void (async () => {
      const userId = await getSessionUserId();
      ensureEntityCacheUser(userId);
      if (cancelled) return;
      const cached = peekSchedules();
      if (cached) {
        setItems(cached);
        setLoading(false);
      } else {
        setLoading(true);
      }
      try {
        const fresh = await getSchedules();
        if (!cancelled) {
          setItems(fresh);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  return { items, loading, setItems };
}
