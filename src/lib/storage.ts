"use client";

import type {
  Customer,
  ListedProperty,
  NaviApp,
  NaviPreference,
  Schedule,
  User,
} from "./types";
import { createClient } from "./supabase/client";
import { getCachedUser, getCurrentUser, getSessionUserId } from "./auth";
import { isDemoEntityId } from "./seedDemo";
import {
  ensureEntityCacheUser,
  findCustomerInCache,
  findPropertyInCache,
  findScheduleInCache,
  removeCustomerFromCache,
  removePropertyFromCache,
  removeScheduleFromCache,
  setCustomersCache,
  setPropertiesCache,
  setSchedulesCache,
  upsertCustomerInCache,
  upsertPropertyInCache,
  upsertScheduleInCache,
} from "./entityCache";

type EntityTable = "customers" | "listed_properties" | "schedules";

type RowMeta = {
  id: string;
  user_id: string;
  workspace_id: string | null;
  created_by: string | null;
  created_by_name: string;
  deleted_at: string | null;
  workspace_shared?: boolean;
  payload: unknown;
};

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
  if (/failed to fetch|networkerror|load failed/i.test(msg)) {
    throw new Error(`${label}: 네트워크 연결을 확인해 주세요.`);
  }
  // 마이그레이션 미적용 시 컬럼 오류 — 원인 노출
  throw new Error(`${label}: ${msg}`);
}

async function resolveActor(): Promise<{ userId: string; name: string }> {
  const userId = await requireUserId();
  const user =
    getCachedUser() ||
    (await getCurrentUser()) ||
    ({ name: "", username: "" } as User);
  const name = (user.name || user.username || "회원").trim() || "회원";
  return { userId, name };
}

async function getWorkspaceId(userId: string): Promise<string | null> {
  try {
    const supabase = createClient();
    const { data } = await supabase
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", userId)
      .maybeSingle();
    return (data?.workspace_id as string | undefined) ?? null;
  } catch {
    return null;
  }
}

function withCreatorMeta<T extends { id: string; createdAt?: string }>(
  item: T,
  actor: { userId: string; name: string },
  workspaceId: string | null,
  existing?: { created_by?: string | null; created_by_name?: string }
): T & {
  createdBy: string;
  createdByName: string;
  workspaceId?: string;
} {
  const createdBy = existing?.created_by || actor.userId;
  const createdByName =
    existing?.created_by_name?.trim() ||
    (item as { createdByName?: string }).createdByName ||
    actor.name;
  return {
    ...item,
    createdBy,
    createdByName,
    ...(workspaceId ? { workspaceId } : {}),
  };
}

function hasWorkspaceSharedColumn(table: EntityTable) {
  return table === "schedules" || table === "listed_properties";
}

function baseSelectCols(withShared: boolean) {
  return (
    "id, user_id, workspace_id, created_by, created_by_name, deleted_at, payload" +
    (withShared ? ", workspace_shared" : "")
  );
}

function isMissingWorkspaceSharedColumn(error: { message?: string } | null) {
  const msg = (error?.message || "").toLowerCase();
  return (
    msg.includes("workspace_shared") ||
    msg.includes("does not exist") ||
    msg.includes("schema cache")
  );
}

async function findRow(
  table: EntityTable,
  id: string
): Promise<RowMeta | null> {
  const supabase = createClient();
  const trySelect = async (withShared: boolean) => {
    const { data, error } = await supabase
      .from(table)
      .select(baseSelectCols(withShared && hasWorkspaceSharedColumn(table)))
      .eq("id", id)
      .maybeSingle();
    return { data, error };
  };

  let { data, error } = await trySelect(true);
  if (
    error &&
    table === "listed_properties" &&
    isMissingWorkspaceSharedColumn(error)
  ) {
    ({ data, error } = await trySelect(false));
  }
  if (error || !data) return null;
  return data as unknown as RowMeta;
}

async function softDeleteRow(
  table: EntityTable,
  id: string,
  entityLabel: string
): Promise<void> {
  const actor = await resolveActor();
  const row = await findRow(table, id);
  if (!row || row.deleted_at) return;

  const supabase = createClient();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from(table)
    .update({
      deleted_at: now,
      deleted_by: actor.userId,
      updated_at: now,
    })
    .eq("user_id", row.user_id)
    .eq("id", id);
  throwIfError(error, `${entityLabel} 삭제 실패`);
}

async function listActivePayloads<T>(
  table: EntityTable,
  mapRow: (row: RowMeta) => T
): Promise<T[]> {
  try {
    // anon 폴백 방지 — 토큰을 세션에 올린 뒤 조회
    const { getAccessToken } = await import("./auth");
    const token = await getAccessToken();
    if (!token) return [];

    const userId = await requireUserId();
    const workspaceId = await getWorkspaceId(userId);
    const supabase = createClient();
    const canSharedCol = hasWorkspaceSharedColumn(table);

    const selectOwn = async (withSharedCol: boolean) => {
      const selectCols = baseSelectCols(withSharedCol && canSharedCol);
      return supabase
        .from(table)
        .select(selectCols)
        .eq("user_id", userId)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false });
    };

    let { data, error } = await selectOwn(canSharedCol);
    if (
      error &&
      table === "listed_properties" &&
      isMissingWorkspaceSharedColumn(error)
    ) {
      ({ data, error } = await selectOwn(false));
    }
    if (error || !data) return [];

    const ownRows = data as unknown as RowMeta[];
    const byId = new Map(ownRows.map((r) => [r.id, r]));

    // 팀 공유 행 (다른 회원) — 컬럼/권한 없으면 조용히 스킵
    if (workspaceId && canSharedCol) {
      const selectCols = baseSelectCols(true);
      const shared = await supabase
        .from(table)
        .select(selectCols)
        .eq("workspace_id", workspaceId)
        .eq("workspace_shared", true)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false });
      if (!shared.error && shared.data) {
        for (const row of shared.data as unknown as RowMeta[]) {
          if (!byId.has(row.id)) byId.set(row.id, row);
        }
      }
    } else if (workspaceId && table === "customers") {
      const selectCols = baseSelectCols(false);
      const shared = await supabase
        .from(table)
        .select(selectCols)
        .eq("workspace_id", workspaceId)
        .is("deleted_at", null)
        .neq("user_id", userId)
        .order("updated_at", { ascending: false });
      if (!shared.error && shared.data) {
        for (const row of shared.data as unknown as RowMeta[]) {
          if (!byId.has(row.id)) byId.set(row.id, row);
        }
      }
    }

    const rows = [...byId.values()].filter((row) => {
      if (!isDemoEntityId(row.id)) return true;
      return row.user_id === userId;
    });

    return rows.map(mapRow);
  } catch {
    return [];
  }
}

function enrichCustomer(row: RowMeta): Customer {
  const payload = row.payload as Customer;
  return {
    ...payload,
    createdBy: row.created_by || payload.createdBy,
    createdByName:
      row.created_by_name || payload.createdByName || "",
    workspaceId: row.workspace_id || payload.workspaceId,
  };
}

function enrichProperty(row: RowMeta): ListedProperty {
  const payload = row.payload as ListedProperty;
  return {
    ...payload,
    createdBy: row.created_by || payload.createdBy,
    createdByName:
      row.created_by_name || payload.createdByName || "",
    workspaceId: row.workspace_id || payload.workspaceId,
    workspaceShared:
      row.workspace_shared ?? payload.workspaceShared ?? false,
  };
}

function enrichSchedule(row: RowMeta): Schedule {
  const payload = row.payload as Schedule;
  return {
    ...payload,
    createdBy: row.created_by || payload.createdBy,
    createdByName:
      row.created_by_name || payload.createdByName || "",
    workspaceId: row.workspace_id || payload.workspaceId,
    workspaceShared:
      row.workspace_shared ?? payload.workspaceShared ?? false,
  };
}

export async function getCustomers(): Promise<Customer[]> {
  const userId = await getSessionUserId();
  ensureEntityCacheUser(userId);
  const list = await listActivePayloads("customers", enrichCustomer);
  setCustomersCache(list);
  return list;
}

export async function saveCustomers(customers: Customer[]): Promise<void> {
  const actor = await resolveActor();
  const supabase = createClient();

  const { data: existing, error: readError } = await supabase
    .from("customers")
    .select("id, user_id")
    .eq("user_id", actor.userId)
    .is("deleted_at", null);
  throwIfError(readError, "고객 목록 조회 실패");

  const nextIds = new Set(customers.map((c) => c.id));
  const toSoftDelete = (existing ?? []).filter(
    (r) => !nextIds.has(r.id as string)
  );

  for (const row of toSoftDelete) {
    await softDeleteRow("customers", row.id as string, "고객");
  }

  if (customers.length === 0) return;

  for (const c of customers) {
    await upsertCustomer(c);
  }
}

export async function upsertCustomer(customer: Customer): Promise<Customer[]> {
  const actor = await resolveActor();
  const workspaceId = await getWorkspaceId(actor.userId);
  const existing = await findRow("customers", customer.id);
  const ownerId = existing?.user_id || actor.userId;
  const demo = isDemoEntityId(customer.id);
  const boundWorkspace = demo
    ? null
    : workspaceId || existing?.workspace_id || null;
  const payload = withCreatorMeta(
    customer,
    actor,
    boundWorkspace,
    existing
      ? {
          created_by: existing.created_by,
          created_by_name: existing.created_by_name,
        }
      : undefined
  );

  const supabase = createClient();
  const { error } = await supabase.from("customers").upsert(
    {
      id: payload.id,
      user_id: ownerId,
      workspace_id: boundWorkspace,
      created_by: payload.createdBy,
      created_by_name: payload.createdByName,
      payload,
      created_at: payload.createdAt,
      updated_at: payload.updatedAt,
      deleted_at: null,
    },
    { onConflict: "user_id,id" }
  );
  throwIfError(error, "고객 저장 실패");
  upsertCustomerInCache({
    ...payload,
    workspaceId: boundWorkspace || undefined,
  });
  return getCustomers();
}

export async function deleteCustomer(id: string): Promise<void> {
  removeCustomerFromCache(id);
  const related = await getSchedulesByCustomer(id);
  for (const s of related) {
    removeScheduleFromCache(s.id);
    await softDeleteRow("schedules", s.id, "일정");
  }
  await softDeleteRow("customers", id, "고객");

  try {
    const actor = await resolveActor();
    const supabase = createClient();
    const { data } = await supabase
      .from("profiles")
      .select("recent_customer_ids")
      .eq("id", actor.userId)
      .maybeSingle();
    const ids = ((data?.recent_customer_ids as string[] | null) ?? []).filter(
      (x) => x !== id
    );
    await supabase
      .from("profiles")
      .update({ recent_customer_ids: ids })
      .eq("id", actor.userId);
  } catch {
    /* ignore */
  }
}

export async function getCustomerById(
  id: string
): Promise<Customer | undefined> {
  const cached = findCustomerInCache(id);
  if (cached) {
    void (async () => {
      try {
        const row = await findRow("customers", id);
        if (!row || row.deleted_at) {
          removeCustomerFromCache(id);
          return;
        }
        if (isDemoEntityId(id)) {
          const userId = await requireUserId();
          if (row.user_id !== userId) {
            removeCustomerFromCache(id);
            return;
          }
        }
        upsertCustomerInCache(enrichCustomer(row));
      } catch {
        /* ignore background refresh */
      }
    })();
    return cached;
  }
  try {
    const row = await findRow("customers", id);
    if (!row || row.deleted_at) return undefined;
    if (isDemoEntityId(id)) {
      const userId = await requireUserId();
      if (row.user_id !== userId) return undefined;
    }
    const item = enrichCustomer(row);
    upsertCustomerInCache(item);
    return item;
  } catch {
    return undefined;
  }
}

export async function getListedProperties(): Promise<ListedProperty[]> {
  const userId = await getSessionUserId();
  ensureEntityCacheUser(userId);
  const list = await listActivePayloads("listed_properties", enrichProperty);
  setPropertiesCache(list);
  return list;
}

export async function saveListedProperties(
  properties: ListedProperty[]
): Promise<void> {
  const actor = await resolveActor();
  const supabase = createClient();
  const { data: existing, error: readError } = await supabase
    .from("listed_properties")
    .select("id, user_id")
    .eq("user_id", actor.userId)
    .is("deleted_at", null);
  throwIfError(readError, "매물 목록 조회 실패");

  const nextIds = new Set(properties.map((p) => p.id));
  for (const row of existing ?? []) {
    if (!nextIds.has(row.id as string)) {
      await softDeleteRow("listed_properties", row.id as string, "매물");
    }
  }
  for (const p of properties) {
    await upsertListedProperty(p);
  }
}

export async function upsertListedProperty(
  property: ListedProperty
): Promise<ListedProperty[]> {
  const actor = await resolveActor();
  const workspaceId = await getWorkspaceId(actor.userId);
  const existing = await findRow("listed_properties", property.id);
  const ownerId = existing?.user_id || actor.userId;
  const demo = isDemoEntityId(property.id);
  const boundWorkspace = demo
    ? null
    : workspaceId || existing?.workspace_id || null;
  const shared = Boolean(property.workspaceShared === true);
  const payload = withCreatorMeta(
    {
      ...property,
      workspaceShared: shared,
      partnerAgencyShared: Boolean(property.partnerAgencyShared === true),
    },
    actor,
    boundWorkspace,
    existing
      ? {
          created_by: existing.created_by,
          created_by_name: existing.created_by_name,
        }
      : undefined
  );

  const supabase = createClient();
  const rowBody = {
    id: payload.id,
    user_id: ownerId,
    workspace_id: boundWorkspace,
    created_by: payload.createdBy,
    created_by_name: payload.createdByName,
    workspace_shared: shared,
    payload,
    created_at: payload.createdAt,
    updated_at: payload.updatedAt,
    deleted_at: null,
  };
  let { error } = await supabase
    .from("listed_properties")
    .upsert(rowBody, { onConflict: "user_id,id" });
  if (error && isMissingWorkspaceSharedColumn(error)) {
    const { workspace_shared: _ignored, ...withoutShared } = rowBody;
    ({ error } = await supabase
      .from("listed_properties")
      .upsert(withoutShared, { onConflict: "user_id,id" }));
  }
  throwIfError(error, "매물 저장 실패");
  upsertPropertyInCache({
    ...payload,
    workspaceId: boundWorkspace || undefined,
    workspaceShared: shared,
  });
  return getListedProperties();
}

export async function deleteListedProperty(id: string): Promise<void> {
  removePropertyFromCache(id);
  await softDeleteRow("listed_properties", id, "매물");
}

export async function getListedPropertyById(
  id: string
): Promise<ListedProperty | undefined> {
  const cached = findPropertyInCache(id);
  if (cached) {
    void (async () => {
      try {
        const row = await findRow("listed_properties", id);
        if (!row || row.deleted_at) {
          removePropertyFromCache(id);
          return;
        }
        if (isDemoEntityId(id)) {
          const userId = await requireUserId();
          if (row.user_id !== userId) {
            removePropertyFromCache(id);
            return;
          }
        }
        upsertPropertyInCache(enrichProperty(row));
      } catch {
        /* ignore */
      }
    })();
    return cached;
  }
  try {
    const row = await findRow("listed_properties", id);
    if (!row || row.deleted_at) return undefined;
    if (isDemoEntityId(id)) {
      const userId = await requireUserId();
      if (row.user_id !== userId) return undefined;
    }
    const item = enrichProperty(row);
    upsertPropertyInCache(item);
    return item;
  } catch {
    return undefined;
  }
}

export async function getSchedules(): Promise<Schedule[]> {
  const userId = await getSessionUserId();
  ensureEntityCacheUser(userId);
  const list = await listActivePayloads("schedules", enrichSchedule);
  setSchedulesCache(list);
  return list;
}

export async function saveSchedules(schedules: Schedule[]): Promise<void> {
  const actor = await resolveActor();
  const supabase = createClient();
  const { data: existing, error: readError } = await supabase
    .from("schedules")
    .select("id")
    .eq("user_id", actor.userId)
    .is("deleted_at", null);
  throwIfError(readError, "일정 목록 조회 실패");

  const nextIds = new Set(schedules.map((s) => s.id));
  for (const row of existing ?? []) {
    if (!nextIds.has(row.id as string)) {
      await softDeleteRow("schedules", row.id as string, "일정");
    }
  }
  for (const s of schedules) {
    await upsertSchedule(s);
  }
}

export async function upsertSchedule(schedule: Schedule): Promise<Schedule[]> {
  const actor = await resolveActor();
  const workspaceId = await getWorkspaceId(actor.userId);
  const existing = await findRow("schedules", schedule.id);
  const ownerId = existing?.user_id || actor.userId;
  const demo = isDemoEntityId(schedule.id);
  const boundWorkspace = demo
    ? null
    : workspaceId || existing?.workspace_id || null;
  const payload = withCreatorMeta(
    {
      ...schedule,
      workspaceShared: schedule.workspaceShared ?? false,
    },
    actor,
    boundWorkspace,
    existing
      ? {
          created_by: existing.created_by,
          created_by_name: existing.created_by_name,
        }
      : undefined
  );

  const supabase = createClient();
  const { error } = await supabase.from("schedules").upsert(
    {
      id: payload.id,
      user_id: ownerId,
      workspace_id: boundWorkspace,
      created_by: payload.createdBy,
      created_by_name: payload.createdByName,
      workspace_shared: Boolean(payload.workspaceShared),
      payload,
      created_at: payload.createdAt,
      updated_at: payload.updatedAt,
      deleted_at: null,
    },
    { onConflict: "user_id,id" }
  );
  throwIfError(error, "일정 저장 실패");
  upsertScheduleInCache({
    ...payload,
    workspaceId: boundWorkspace || undefined,
  });
  return getSchedules();
}

export async function deleteSchedule(id: string): Promise<void> {
  removeScheduleFromCache(id);
  await softDeleteRow("schedules", id, "일정");
}

export async function getScheduleById(
  id: string
): Promise<Schedule | undefined> {
  const cached = findScheduleInCache(id);
  if (cached) {
    void (async () => {
      try {
        const row = await findRow("schedules", id);
        if (!row || row.deleted_at) {
          removeScheduleFromCache(id);
          return;
        }
        if (isDemoEntityId(id)) {
          const userId = await requireUserId();
          if (row.user_id !== userId) {
            removeScheduleFromCache(id);
            return;
          }
        }
        upsertScheduleInCache(enrichSchedule(row));
      } catch {
        /* ignore */
      }
    })();
    return cached;
  }
  try {
    const row = await findRow("schedules", id);
    if (!row || row.deleted_at) return undefined;
    if (isDemoEntityId(id)) {
      const userId = await requireUserId();
      if (row.user_id !== userId) return undefined;
    }
    const item = enrichSchedule(row);
    upsertScheduleInCache(item);
    return item;
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

export async function setScheduleWorkspaceShared(
  id: string,
  shared: boolean
): Promise<Schedule | undefined> {
  const schedule = await getScheduleById(id);
  if (!schedule) return undefined;
  const next = {
    ...schedule,
    workspaceShared: shared,
    updatedAt: new Date().toISOString(),
  };
  await upsertSchedule(next);
  return next;
}

/** 네비 앱 '항상 사용' 유지 기간 */
export const NAVI_REMEMBER_DAYS = 15;

const VALID_NAVI_APPS = new Set([
  "kakaonavi",
  "tmap",
  "navermap",
  "kakaomap",
]);

export function isActiveNaviPreference(
  pref: NaviPreference | null | undefined
): pref is NaviPreference {
  if (!pref?.remember || !pref.app) return false;
  if (!VALID_NAVI_APPS.has(pref.app)) return false;
  if (pref.app === "kakaonavi") return false;
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
  throwIfError(error, "네비 설정 저장 실패");
}

export async function clearNaviPreference(): Promise<void> {
  const userId = await requireUserId();
  const supabase = createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ navi_preference: null })
    .eq("id", userId);
  throwIfError(error, "네비 설정 초기화 실패");
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
    /* ignore */
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
