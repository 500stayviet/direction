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

async function requireUserId(): Promise<string> {
  const id = await getSessionUserId();
  if (!id) {
    throw new Error("로그인이 필요합니다. 다시 로그인해 주세요.");
  }
  return id;
}

function throwIfError(error: { message: string } | null, label: string): void {
  if (!error) return;
  const msg = error.message || "unknown";
  // 네트워크 단절 등은 원인 메시지를 짧게
  if (/failed to fetch|networkerror|load failed/i.test(msg)) {
    throw new Error(`${label}: 네트워크 연결을 확인해 주세요.`);
  }
  throw new Error(`${label}: ${msg}`);
}

export async function getCustomers(): Promise<Customer[]> {
  try {
    const userId = await requireUserId();
    const supabase = createClient();
    const { data, error } = await supabase
      .from("customers")
      .select("payload")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (error || !data) return [];
    return data.map((row) => row.payload as Customer);
  } catch {
    return [];
  }
}

export async function saveCustomers(customers: Customer[]): Promise<void> {
  const userId = await requireUserId();
  const supabase = createClient();
  const { data: existing, error: readError } = await supabase
    .from("customers")
    .select("id")
    .eq("user_id", userId);
  throwIfError(readError, "손님 목록 조회 실패");

  const nextIds = new Set(customers.map((c) => c.id));
  const toDelete = (existing ?? [])
    .map((r) => r.id as string)
    .filter((id) => !nextIds.has(id));

  if (toDelete.length > 0) {
    const { error } = await supabase
      .from("customers")
      .delete()
      .eq("user_id", userId)
      .in("id", toDelete);
    throwIfError(error, "손님 삭제 실패");
  }

  if (customers.length === 0) return;

  const rows = customers.map((c) => ({
    id: c.id,
    user_id: userId,
    payload: c,
    created_at: c.createdAt,
    updated_at: c.updatedAt,
  }));

  const { error } = await supabase
    .from("customers")
    .upsert(rows, { onConflict: "user_id,id" });
  throwIfError(error, "손님 저장 실패");
}

export async function upsertCustomer(customer: Customer): Promise<Customer[]> {
  const userId = await requireUserId();
  const supabase = createClient();
  const { error } = await supabase.from("customers").upsert(
    {
      id: customer.id,
      user_id: userId,
      payload: customer,
      created_at: customer.createdAt,
      updated_at: customer.updatedAt,
    },
    { onConflict: "user_id,id" }
  );
  throwIfError(error, "손님 저장 실패");
  return getCustomers();
}

export async function getCustomerById(
  id: string
): Promise<Customer | undefined> {
  try {
    const userId = await requireUserId();
    const supabase = createClient();
    const { data, error } = await supabase
      .from("customers")
      .select("payload")
      .eq("user_id", userId)
      .eq("id", id)
      .maybeSingle();

    if (error || !data) return undefined;
    return data.payload as Customer;
  } catch {
    return undefined;
  }
}

export async function getListedProperties(): Promise<ListedProperty[]> {
  try {
    const userId = await requireUserId();
    const supabase = createClient();
    const { data, error } = await supabase
      .from("listed_properties")
      .select("payload")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (error || !data) return [];
    return data.map((row) => row.payload as ListedProperty);
  } catch {
    return [];
  }
}

export async function saveListedProperties(
  properties: ListedProperty[]
): Promise<void> {
  const userId = await requireUserId();
  const supabase = createClient();
  const { data: existing, error: readError } = await supabase
    .from("listed_properties")
    .select("id")
    .eq("user_id", userId);
  throwIfError(readError, "매물 목록 조회 실패");

  const nextIds = new Set(properties.map((p) => p.id));
  const toDelete = (existing ?? [])
    .map((r) => r.id as string)
    .filter((id) => !nextIds.has(id));

  if (toDelete.length > 0) {
    const { error } = await supabase
      .from("listed_properties")
      .delete()
      .eq("user_id", userId)
      .in("id", toDelete);
    throwIfError(error, "매물 삭제 실패");
  }

  if (properties.length === 0) return;

  const rows = properties.map((p) => ({
    id: p.id,
    user_id: userId,
    payload: p,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
  }));

  const { error } = await supabase
    .from("listed_properties")
    .upsert(rows, { onConflict: "user_id,id" });
  throwIfError(error, "매물 저장 실패");
}

export async function upsertListedProperty(
  property: ListedProperty
): Promise<ListedProperty[]> {
  const userId = await requireUserId();
  const supabase = createClient();
  const { error } = await supabase.from("listed_properties").upsert(
    {
      id: property.id,
      user_id: userId,
      payload: property,
      created_at: property.createdAt,
      updated_at: property.updatedAt,
    },
    { onConflict: "user_id,id" }
  );
  throwIfError(error, "매물 저장 실패");
  return getListedProperties();
}

export async function getListedPropertyById(
  id: string
): Promise<ListedProperty | undefined> {
  try {
    const userId = await requireUserId();
    const supabase = createClient();
    const { data, error } = await supabase
      .from("listed_properties")
      .select("payload")
      .eq("user_id", userId)
      .eq("id", id)
      .maybeSingle();

    if (error || !data) return undefined;
    return data.payload as ListedProperty;
  } catch {
    return undefined;
  }
}

export async function getSchedules(): Promise<Schedule[]> {
  try {
    const userId = await requireUserId();
    const supabase = createClient();
    const { data, error } = await supabase
      .from("schedules")
      .select("payload")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (error || !data) return [];
    return data.map((row) => row.payload as Schedule);
  } catch {
    return [];
  }
}

export async function saveSchedules(schedules: Schedule[]): Promise<void> {
  const userId = await requireUserId();
  const supabase = createClient();
  const { data: existing, error: readError } = await supabase
    .from("schedules")
    .select("id")
    .eq("user_id", userId);
  throwIfError(readError, "일정 목록 조회 실패");

  const nextIds = new Set(schedules.map((s) => s.id));
  const toDelete = (existing ?? [])
    .map((r) => r.id as string)
    .filter((id) => !nextIds.has(id));

  if (toDelete.length > 0) {
    const { error } = await supabase
      .from("schedules")
      .delete()
      .eq("user_id", userId)
      .in("id", toDelete);
    throwIfError(error, "일정 삭제 실패");
  }

  if (schedules.length === 0) return;

  const rows = schedules.map((s) => ({
    id: s.id,
    user_id: userId,
    payload: s,
    created_at: s.createdAt,
    updated_at: s.updatedAt,
  }));

  const { error } = await supabase
    .from("schedules")
    .upsert(rows, { onConflict: "user_id,id" });
  throwIfError(error, "일정 저장 실패");
}

export async function upsertSchedule(schedule: Schedule): Promise<Schedule[]> {
  const userId = await requireUserId();
  const supabase = createClient();
  const { error } = await supabase.from("schedules").upsert(
    {
      id: schedule.id,
      user_id: userId,
      payload: schedule,
      created_at: schedule.createdAt,
      updated_at: schedule.updatedAt,
    },
    { onConflict: "user_id,id" }
  );
  throwIfError(error, "일정 저장 실패");
  return getSchedules();
}

export async function getScheduleById(
  id: string
): Promise<Schedule | undefined> {
  try {
    const userId = await requireUserId();
    const supabase = createClient();
    const { data, error } = await supabase
      .from("schedules")
      .select("payload")
      .eq("user_id", userId)
      .eq("id", id)
      .maybeSingle();

    if (error || !data) return undefined;
    return data.payload as Schedule;
  } catch {
    return undefined;
  }
}

export async function getSchedulesByCustomer(
  customerId: string
): Promise<Schedule[]> {
  const all = await getSchedules();
  return all.filter((s) => s.customerId === customerId);
}

/** 내비 앱 '항상 사용' 유지 기간 */
export const NAVI_REMEMBER_DAYS = 15;

/** 체크한 '항상 이 앱'이 아직 유효한지 (약 15일) */
export function isActiveNaviPreference(
  pref: NaviPreference | null | undefined
): pref is NaviPreference {
  if (!pref?.remember || !pref.app) return false;
  // savedAt 없는 예전 설정은 만료로 보고 다시 선택
  if (!pref.savedAt) return false;
  const saved = Date.parse(pref.savedAt);
  if (!Number.isFinite(saved)) return false;
  const ttlMs = NAVI_REMEMBER_DAYS * 24 * 60 * 60 * 1000;
  return Date.now() - saved < ttlMs;
}

export async function getNaviPreference(): Promise<NaviPreference | null> {
  try {
    const userId = await requireUserId();
    const supabase = createClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("navi_preference")
      .eq("id", userId)
      .maybeSingle();

    if (error || !data?.navi_preference) return null;
    const pref = data.navi_preference as NaviPreference;
    if (!isActiveNaviPreference(pref)) {
      // 만료·예전 설정 정리 후 매번 선택하게
      void supabase
        .from("profiles")
        .update({ navi_preference: null })
        .eq("id", userId);
      return null;
    }
    return pref;
  } catch {
    return null;
  }
}

export async function setNaviPreference(
  app: NaviApp,
  remember: boolean
): Promise<void> {
  const userId = await requireUserId();
  const supabase = createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      navi_preference: remember
        ? {
            app,
            remember: true,
            savedAt: new Date().toISOString(),
          }
        : null,
    })
    .eq("id", userId);
  throwIfError(error, "내비 설정 저장 실패");
}

export async function clearNaviPreference(): Promise<void> {
  const userId = await requireUserId();
  const supabase = createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ navi_preference: null })
    .eq("id", userId);
  throwIfError(error, "내비 설정 초기화 실패");
}

export async function touchRecentCustomer(customerId: string): Promise<void> {
  try {
    const userId = await requireUserId();
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
  } catch {
    /* 최근 목록은 부가 기능 — 저장 실패해도 본 저장은 유지 */
  }
}

export async function getRecentCustomers(): Promise<Customer[]> {
  try {
    const userId = await requireUserId();
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
  } catch {
    return [];
  }
}

export async function getDemoSeedVersion(): Promise<string | null> {
  try {
    const userId = await requireUserId();
    const supabase = createClient();
    const { data } = await supabase
      .from("profiles")
      .select("demo_seed_version")
      .eq("id", userId)
      .maybeSingle();

    return data?.demo_seed_version ?? null;
  } catch {
    return null;
  }
}

export async function setDemoSeedVersion(version: string): Promise<void> {
  try {
    const userId = await requireUserId();
    const supabase = createClient();
    await supabase
      .from("profiles")
      .update({ demo_seed_version: version })
      .eq("id", userId);
  } catch {
    /* ignore */
  }
}
