"use client";

import { useEffect, useState } from "react";
import {
  getMatchPoolCustomers,
  getMatchPoolProperties,
} from "@/lib/storage";
import type { Customer, ListedProperty } from "@/lib/types";

export function useMatchPoolEntities(userId: string | null | undefined) {
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [properties, setProperties] = useState<ListedProperty[] | null>(null);

  useEffect(() => {
    if (!userId) {
      setCustomers(null);
      setProperties(null);
      return;
    }
    let cancelled = false;
    void Promise.all([getMatchPoolCustomers(), getMatchPoolProperties()]).then(
      ([nextCustomers, nextProperties]) => {
        if (cancelled) return;
        setCustomers(nextCustomers);
        setProperties(nextProperties);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return { customers, properties };
}
