"use client";

import type {
  Customer,
  ListedProperty,
  NaviApp,
  NaviPreference,
  Schedule,
} from "./types";
import { createClient } from "./supabase/client";
import { getSessionUserId } from "./auth";

async function requireUserId(): Promise<string | null> {
  return getSessionUserId();
}

export async function getCustomers(): Promise<Customer[]> {
  const userId = await requireUserId();
  if (!userId) return [];

  const supabase = createClient();
  const { data, error } = await supabase
    .from("customers")
    .select("payload")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error || !data) return [];
  return data.map((row) => row.payload as Customer);
}

export async function saveCustomers(customers: Customer[]): Promise<void> {
  const userId = await requireUserId();
  if (!userId) return;

  const supabase = createClient();
  const { data: existing } = await supabase
    .from("customers")
    .select("id")
    .eq("user_id", userId);
  const nextIds = new Set(customers.map((c) => c.id));
  const toDelete = (existing ?? [])
    .map((r) => r.id as string)
    .filter((id) => !nextIds.has(id));

  if (toDelete.length > 0) {
    await supabase
      .from("customers")
      .delete()
      .eq("user_id", userId)
      .in("id", toDelete);
  }

  if (customers.length === 0) return;

  const rows = customers.map((c) => ({
    id: c.id,
    user_id: userId,
    payload: c,
    created_at: c.createdAt,
    updated_at: c.updatedAt,
  }));

  await supabase.from("customers").upsert(rows, { onConflict: "user_id,id" });
}

export async function upsertCustomer(customer: Customer): Promise<Customer[]> {
  const userId = await requireUserId();
  if (!userId) return [];

  const supabase = createClient();
  await supabase.from("customers").upsert(
    {
      id: customer.id,
      user_id: userId,
      payload: customer,
      created_at: customer.createdAt,
      updated_at: customer.updatedAt,
    },
    { onConflict: "user_id,id" }
  );
  return getCustomers();
}

export async function getCustomerById(
  id: string
): Promise<Customer | undefined> {
  const userId = await requireUserId();
  if (!userId) return undefined;

  const supabase = createClient();
  const { data, error } = await supabase
    .from("customers")
    .select("payload")
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return undefined;
  return data.payload as Customer;
}

export async function getListedProperties(): Promise<ListedProperty[]> {
  const userId = await requireUserId();
  if (!userId) return [];

  const supabase = createClient();
  const { data, error } = await supabase
    .from("listed_properties")
    .select("payload")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error || !data) return [];
  return data.map((row) => row.payload as ListedProperty);
}

export async function saveListedProperties(
  properties: ListedProperty[]
): Promise<void> {
  const userId = await requireUserId();
  if (!userId) return;

  const supabase = createClient();
  const { data: existing } = await supabase
    .from("listed_properties")
    .select("id")
    .eq("user_id", userId);
  const nextIds = new Set(properties.map((p) => p.id));
  const toDelete = (existing ?? [])
    .map((r) => r.id as string)
    .filter((id) => !nextIds.has(id));

  if (toDelete.length > 0) {
    await supabase
      .from("listed_properties")
      .delete()
      .eq("user_id", userId)
      .in("id", toDelete);
  }

  if (properties.length === 0) return;

  const rows = properties.map((p) => ({
    id: p.id,
    user_id: userId,
    payload: p,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
  }));

  await supabase
    .from("listed_properties")
    .upsert(rows, { onConflict: "user_id,id" });
}

export async function upsertListedProperty(
  property: ListedProperty
): Promise<ListedProperty[]> {
  const userId = await requireUserId();
  if (!userId) return [];

  const supabase = createClient();
  await supabase.from("listed_properties").upsert(
    {
      id: property.id,
      user_id: userId,
      payload: property,
      created_at: property.createdAt,
      updated_at: property.updatedAt,
    },
    { onConflict: "user_id,id" }
  );
  return getListedProperties();
}

export async function getListedPropertyById(
  id: string
): Promise<ListedProperty | undefined> {
  const userId = await requireUserId();
  if (!userId) return undefined;

  const supabase = createClient();
  const { data, error } = await supabase
    .from("listed_properties")
    .select("payload")
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return undefined;
  return data.payload as ListedProperty;
}

export async function getSchedules(): Promise<Schedule[]> {
  const userId = await requireUserId();
  if (!userId) return [];

  const supabase = createClient();
  const { data, error } = await supabase
    .from("schedules")
    .select("payload")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error || !data) return [];
  return data.map((row) => row.payload as Schedule);
}

export async function saveSchedules(schedules: Schedule[]): Promise<void> {
  const userId = await requireUserId();
  if (!userId) return;

  const supabase = createClient();
  const { data: existing } = await supabase
    .from("schedules")
    .select("id")
    .eq("user_id", userId);
  const nextIds = new Set(schedules.map((s) => s.id));
  const toDelete = (existing ?? [])
    .map((r) => r.id as string)
    .filter((id) => !nextIds.has(id));

  if (toDelete.length > 0) {
    await supabase
      .from("schedules")
      .delete()
      .eq("user_id", userId)
      .in("id", toDelete);
  }

  if (schedules.length === 0) return;

  const rows = schedules.map((s) => ({
    id: s.id,
    user_id: userId,
    payload: s,
    created_at: s.createdAt,
    updated_at: s.updatedAt,
  }));

  await supabase.from("schedules").upsert(rows, { onConflict: "user_id,id" });
}

export async function upsertSchedule(schedule: Schedule): Promise<Schedule[]> {
  const userId = await requireUserId();
  if (!userId) return [];

  const supabase = createClient();
  await supabase.from("schedules").upsert(
    {
      id: schedule.id,
      user_id: userId,
      payload: schedule,
      created_at: schedule.createdAt,
      updated_at: schedule.updatedAt,
    },
    { onConflict: "user_id,id" }
  );
  return getSchedules();
}

export async function getScheduleById(
  id: string
): Promise<Schedule | undefined> {
  const userId = await requireUserId();
  if (!userId) return undefined;

  const supabase = createClient();
  const { data, error } = await supabase
    .from("schedules")
    .select("payload")
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return undefined;
  return data.payload as Schedule;
}

export async function getSchedulesByCustomer(
  customerId: string
): Promise<Schedule[]> {
  const all = await getSchedules();
  return all.filter((s) => s.customerId === customerId);
}

export async function getNaviPreference(): Promise<NaviPreference | null> {
  const userId = await requireUserId();
  if (!userId) return null;

  const supabase = createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("navi_preference")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data?.navi_preference) return null;
  return data.navi_preference as NaviPreference;
}

export async function setNaviPreference(
  app: NaviApp,
  remember: boolean
): Promise<void> {
  const userId = await requireUserId();
  if (!userId) return;

  const supabase = createClient();
  await supabase
    .from("profiles")
    .update({
      navi_preference: remember ? { app, remember: true } : null,
    })
    .eq("id", userId);
}

export async function clearNaviPreference(): Promise<void> {
  const userId = await requireUserId();
  if (!userId) return;

  const supabase = createClient();
  await supabase
    .from("profiles")
    .update({ navi_preference: null })
    .eq("id", userId);
}

export async function touchRecentCustomer(customerId: string): Promise<void> {
  const userId = await requireUserId();
  if (!userId) return;

  const supabase = createClient();
  const { data } = await supabase
    .from("profiles")
    .select("recent_customer_ids")
    .eq("id", userId)
    .maybeSingle();

  const ids = (
    (data?.recent_customer_ids as string[] | null) ?? []
  ).filter((id) => id !== customerId);
  ids.unshift(customerId);

  await supabase
    .from("profiles")
    .update({ recent_customer_ids: ids.slice(0, 20) })
    .eq("id", userId);
}

export async function getRecentCustomers(): Promise<Customer[]> {
  const userId = await requireUserId();
  if (!userId) return [];

  const supabase = createClient();
  const { data } = await supabase
    .from("profiles")
    .select("recent_customer_ids")
    .eq("id", userId)
    .maybeSingle();

  const ids = (data?.recent_customer_ids as string[] | null) ?? [];
  const customers = await getCustomers();
  const map = new Map(customers.map((c) => [c.id, c]));
  const recent = ids.map((id) => map.get(id)).filter(Boolean) as Customer[];
  if (recent.length > 0) return recent;
  return customers.slice(0, 10);
}

export async function getDemoSeedVersion(): Promise<string | null> {
  const userId = await requireUserId();
  if (!userId) return null;

  const supabase = createClient();
  const { data } = await supabase
    .from("profiles")
    .select("demo_seed_version")
    .eq("id", userId)
    .maybeSingle();

  return data?.demo_seed_version ?? null;
}

export async function setDemoSeedVersion(version: string): Promise<void> {
  const userId = await requireUserId();
  if (!userId) return;

  const supabase = createClient();
  await supabase
    .from("profiles")
    .update({ demo_seed_version: version })
    .eq("id", userId);
}
