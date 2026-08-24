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
import {
  getCachedUser,
  getCurrentUser,
  getSessionUserId,
  peekCurrentUser,
} from "./auth";
import {
  DEMO_CREATOR_NAME,
  isDemoEntityId,
  isDemoHiddenForUser,
} from "./demoSeedPayload";
import { foldDoorPasswordsIntoNotes } from "./propertyPasswords";
import { postImmediateAlertDispatch } from "./immediateAlertDispatch";
import {
  applyCustomerDueComplete,
  applyPropertyDueComplete,
  applyScheduleDueComplete,
} from "./contractAutoComplete";
import {
  ensureEntityCacheUser,
  findCustomerInCache,
  findPropertyInCache,
  findScheduleInCache,
  peekCustomers,
  peekProperties,
  peekSchedules,
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
import {
  ensureTeamShareHidesUser,
  hideBucketForTable,
  hideSharedEntity,
  isSharedEntityHidden,
  pruneHiddenToLiveIds,
  unhideSharedEntity,
} from "./teamShareHides";
import { findDongInText, parseSeoulAddress } from "./seoulRegions";
import { parsePreferredDong } from "./preferredLocation";
import { applyMatchPoolRedaction } from "./matchPoolRedaction";
import { MATCH_POOL_CACHE_TTL_MS } from "./accountStatusPolicy";

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
    const { forceRelogin } = await import("./auth");
    forceRelogin();
    throw new Error("로그인이 필요합니다.");
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

async function resolveActor(): Promise<{
  userId: string;
  name: string;
  shopName: string;
  phone: string;
}> {
  const userId = await requireUserId();
  const user =
    getCachedUser() ||
    (await getCurrentUser()) ||
    ({ name: "", username: "", shopName: "", phone: "" } as User);
  const name = (user.name || user.username || "회원").trim() || "회원";
  const shopName = (user.shopName || "").trim();
  const phone = (user.phone || "").trim();
  return { userId, name, shopName, phone };
}

/** 업장 조회는 화면 이동·저장마다 치지 않도록 짧게 캐시 */
let workspaceIdCache: {
  userId: string;
  workspaceId: string | null;
  at: number;
} | null = null;
const WORKSPACE_ID_TTL_MS = 5 * 60 * 1000;
const workspaceIdListeners = new Set<() => void>();

export function subscribeWorkspaceIdCache(listener: () => void): () => void {
  workspaceIdListeners.add(listener);
  return () => workspaceIdListeners.delete(listener);
}

export function invalidateWorkspaceIdCache(): void {
  workspaceIdCache = null;
  workspaceIdListeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* ignore */
    }
  });
}

export async function getMyWorkspaceId(): Promise<string | null> {
  const userId = await getSessionUserId();
  if (!userId) return null;
  return getWorkspaceId(userId);
}

async function getWorkspaceId(userId: string): Promise<string | null> {
  if (
    workspaceIdCache &&
    workspaceIdCache.userId === userId &&
    Date.now() - workspaceIdCache.at < WORKSPACE_ID_TTL_MS
  ) {
    return workspaceIdCache.workspaceId;
  }
  try {
    const supabase = createClient();
    const { data } = await supabase
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", userId)
      .maybeSingle();
    const workspaceId = (data?.workspace_id as string | undefined) ?? null;
    workspaceIdCache = { userId, workspaceId, at: Date.now() };
    return workspaceId;
  } catch {
    return null;
  }
}

function agencyDongForSnapshot(
  item: { preferredDongs?: string[]; address?: string },
  shopName: string
): string {
  if (Array.isArray(item.preferredDongs)) {
    for (const raw of item.preferredDongs) {
      const parsed = parsePreferredDong(String(raw ?? ""));
      if (parsed?.dong?.trim()) return parsed.dong.trim();
    }
  }
  if (item.address?.trim()) {
    const dong = parseSeoulAddress(item.address).dong?.trim();
    if (dong) return dong;
  }
  return findDongInText(shopName)?.dong?.trim() || "";
}

function withCreatorMeta<T extends { id: string; createdAt?: string }>(
  item: T,
  actor: { userId: string; name: string; shopName: string; phone: string },
  workspaceId: string | null,
  existing?: { created_by?: string | null; created_by_name?: string }
): T & {
  createdBy: string;
  createdByName: string;
  createdByShopName?: string;
  createdByPhone?: string;
  createdByDong?: string;
  workspaceId?: string;
} {
  const createdBy = existing?.created_by || actor.userId;
  const createdByName = isDemoEntityId(item.id)
    ? DEMO_CREATOR_NAME
    : existing?.created_by_name?.trim() ||
      (item as { createdByName?: string }).createdByName ||
      actor.name;
  const preserveAgencySnapshots = Boolean(
    existing?.created_by && existing.created_by !== actor.userId
  );
  const itemAgency = item as {
    createdByShopName?: string;
    createdByPhone?: string;
    createdByDong?: string;
    preferredDongs?: string[];
    address?: string;
  };
  const agencySnapshots =
    preserveAgencySnapshots || isDemoEntityId(item.id)
      ? {
          createdByShopName: itemAgency.createdByShopName,
          createdByPhone: itemAgency.createdByPhone,
          createdByDong: itemAgency.createdByDong,
        }
      : {
          createdByShopName:
            actor.shopName && actor.shopName !== "현장동선"
              ? actor.shopName
              : itemAgency.createdByShopName,
          createdByPhone: actor.phone || itemAgency.createdByPhone,
          createdByDong:
            agencyDongForSnapshot(itemAgency, actor.shopName) ||
            itemAgency.createdByDong,
        };
  return {
    ...item,
    createdBy,
    createdByName,
    ...(agencySnapshots.createdByShopName
      ? { createdByShopName: agencySnapshots.createdByShopName }
      : {}),
    ...(agencySnapshots.createdByPhone
      ? { createdByPhone: agencySnapshots.createdByPhone }
      : {}),
    ...(agencySnapshots.createdByDong
      ? { createdByDong: agencySnapshots.createdByDong }
      : {}),
    ...(workspaceId ? { workspaceId } : {}),
  };
}

function hasWorkspaceSharedColumn(table: EntityTable) {
  return (
    table === "schedules" ||
    table === "listed_properties" ||
    table === "customers"
  );
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
    (table === "listed_properties" || table === "customers") &&
    isMissingWorkspaceSharedColumn(error)
  ) {
    ({ data, error } = await trySelect(false));
  }
  if (error || !data) return null;
  const row = data as unknown as RowMeta;
  if (!(await canAccessEntityRow(row))) return null;
  return row;
}

/**
 * 기존 행은 UPDATE만 (팀원 수정 시 upsert INSERT RLS를 피함).
 * 등록자·소속 팀은 바꾸지 않음 (013 트리거).
 */
async function writeEntityRow(
  table: EntityTable,
  existing: RowMeta | null,
  rowBody: Record<string, unknown>,
  label: string
) {
  const supabase = createClient();
  const run = async (body: Record<string, unknown>) => {
    if (existing) {
      const {
        user_id: _userId,
        id: _id,
        workspace_id: _workspaceId,
        created_at: _createdAt,
        ...patch
      } = body;
      return supabase
        .from(table)
        .update(patch)
        .eq("user_id", existing.user_id)
        .eq("id", existing.id);
    }
    return supabase.from(table).insert(body);
  };

  let { error } = await run(rowBody);
  if (error && isMissingWorkspaceSharedColumn(error)) {
    const { workspace_shared: _ignored, ...withoutShared } = rowBody;
    ({ error } = await run(withoutShared));
  }
  throwIfError(error, label);
}

/** 본인 행이거나, 같은 팀 + 팀 공유 켠 행만 접근 허용 */
async function canAccessEntityRow(row: RowMeta): Promise<boolean> {
  try {
    const userId = await getSessionUserId();
    if (!userId) return false;
    if (row.user_id === userId) return true;
    if (isDemoEntityId(row.id)) return false;
    const payloadShared = Boolean(
      (row.payload as { workspaceShared?: boolean } | null)?.workspaceShared
    );
    const shared = row.workspace_shared === true || payloadShared;
    if (!shared || !row.workspace_id) return false;
    const myWorkspace = await getWorkspaceId(userId);
    return Boolean(myWorkspace && myWorkspace === row.workspace_id);
  } catch {
    return false;
  }
}

async function softDeleteRow(
  table: EntityTable,
  id: string,
  entityLabel: string
): Promise<void> {
  const actor = await resolveActor();
  const row = await findRow(table, id);
  if (!row) {
    throw new Error(`${entityLabel}을(를) 찾을 수 없습니다.`);
  }
  if (row.deleted_at) return;
  // 본인 또는 팀 공유된 항목만 삭제 가능 (findRow/canAccess 로 이미 검증)

  const supabase = createClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from(table)
    .update({
      deleted_at: now,
      deleted_by: actor.userId,
      updated_at: now,
    })
    .eq("user_id", row.user_id)
    .eq("id", id)
    .select("id")
    .maybeSingle();
  throwIfError(error, `${entityLabel} 삭제 실패`);
  if (!data) {
    throw new Error(`${entityLabel} 삭제 권한이 없거나 이미 삭제되었습니다.`);
  }
}

/** 팀원 공유 건 삭제 = 원본은 두고 내 목록에서만 숨김 */
async function hideForeignSharedRow(
  table: EntityTable,
  id: string
): Promise<boolean> {
  const actor = await resolveActor();
  const row = await findRow(table, id);
  if (!row || row.user_id === actor.userId) return false;
  ensureTeamShareHidesUser(actor.userId);
  hideSharedEntity(hideBucketForTable(table), id);
  if (table === "customers") removeCustomerFromCache(id);
  else if (table === "listed_properties") removePropertyFromCache(id);
  else removeScheduleFromCache(id);
  return true;
}

type ListFetchResult<T> =
  | { ok: true; items: T[] }
  | { ok: false };

async function listActivePayloads<T>(
  table: EntityTable,
  mapRow: (row: RowMeta) => T
): Promise<ListFetchResult<T>> {
  try {
    // anon 폴백 방지 — 토큰을 세션에 올린 뒤 조회
    const { getAccessToken } = await import("./auth");
    const token = await getAccessToken();
    // 토큰·네트워크 실패 시 빈 배열로 덮어쓰지 않음 (호출부에서 이전 캐시 유지)
    if (!token) return { ok: false };

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
      (table === "listed_properties" || table === "customers") &&
      isMissingWorkspaceSharedColumn(error)
    ) {
      ({ data, error } = await selectOwn(false));
    }
    if (error || !data) return { ok: false };

    const ownRows = data as unknown as RowMeta[];
    const byId = new Map(ownRows.map((r) => [r.id, r]));

    // 팀 공유 행 (다른 회원) — workspace_shared = true 만
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
    }

    const demoExpired = isDemoHiddenForUser(peekCurrentUser());
    const rows = [...byId.values()].filter((row) => {
      if (!isDemoEntityId(row.id)) return true;
      if (demoExpired) return false;
      return row.user_id === userId;
    });

    ensureTeamShareHidesUser(userId);
    const bucket = hideBucketForTable(table);
    const liveForeignIds = rows
      .filter((row) => row.user_id !== userId)
      .map((row) => row.id);
    pruneHiddenToLiveIds(bucket, liveForeignIds);
    const visible = rows.filter(
      (row) =>
        row.user_id === userId || !isSharedEntityHidden(bucket, row.id)
    );

    return { ok: true, items: visible.map(mapRow) };
  } catch {
    return { ok: false };
  }
}

/** 매칭 풀 — 워크스페이스 전체(팀원 비공유 포함). 리스트 표시용 아님 */
async function listWorkspaceMatchPoolPayloads<T>(
  table: EntityTable,
  mapRow: (row: RowMeta) => T
): Promise<ListFetchResult<T>> {
  if (table === "schedules") return { ok: true, items: [] };
  try {
    const { getAccessToken } = await import("./auth");
    const token = await getAccessToken();
    if (!token) return { ok: false };

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
      (table === "listed_properties" || table === "customers") &&
      isMissingWorkspaceSharedColumn(error)
    ) {
      ({ data, error } = await selectOwn(false));
    }
    if (error || !data) return { ok: false };

    const byId = new Map((data as unknown as RowMeta[]).map((r) => [r.id, r]));

    if (workspaceId && canSharedCol) {
      const selectCols = baseSelectCols(true);
      const workspaceRows = await supabase
        .from(table)
        .select(selectCols)
        .eq("workspace_id", workspaceId)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false });
      if (!workspaceRows.error && workspaceRows.data) {
        for (const row of workspaceRows.data as unknown as RowMeta[]) {
          if (!byId.has(row.id)) byId.set(row.id, row);
        }
      }
    }

    const demoExpired = isDemoHiddenForUser(peekCurrentUser());
    const rows = [...byId.values()].filter((row) => {
      if (!isDemoEntityId(row.id)) return true;
      if (demoExpired) return false;
      return row.user_id === userId;
    });

    return { ok: true, items: rows.map(mapRow) };
  } catch {
    return { ok: false };
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
    workspaceShared:
      row.workspace_shared ?? payload.workspaceShared ?? false,
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

function persistDueCustomers(original: Customer[], next: Customer[]) {
  const changed = next.filter(
    (c, i) => c.contractCompleted && !original[i]?.contractCompleted
  );
  if (changed.length === 0) return;
  void Promise.all(
    changed.map((c) => upsertCustomer(c).catch(() => undefined))
  );
}

function persistDueProperties(
  original: ListedProperty[],
  next: ListedProperty[]
) {
  const changed = next.filter(
    (p, i) => p.contractCompleted && !original[i]?.contractCompleted
  );
  if (changed.length === 0) return;
  void Promise.all(
    changed.map((p) => upsertListedProperty(p).catch(() => undefined))
  );
}

export type EntityListLoadResult<T> = {
  ok: boolean;
  items: T[];
};

/** 부팅 직후 빈 응답이 캐시를 지우며 「없습니다」 깜빡임 — 기존 캐시가 있으면 거부 */
function rejectSuspiciousEmptyFetch<T>(
  next: T[],
  peek: () => T[] | null,
  mapCached: (items: T[]) => T[]
): EntityListLoadResult<T> | null {
  const prev = peek();
  if (next.length === 0 && (prev?.length ?? 0) > 0) {
    return { ok: false, items: mapCached(prev!) };
  }
  return null;
}

let customersInflight: Promise<EntityListLoadResult<Customer>> | null = null;

async function fetchCustomersList(): Promise<EntityListLoadResult<Customer>> {
  const userId = await getSessionUserId();
  if (userId) ensureEntityCacheUser(userId);
  const result = await listActivePayloads("customers", enrichCustomer);
  if (!result.ok) {
    const cached = peekCustomers();
    if (cached === null) return { ok: false, items: [] };
    return {
      ok: false,
      items: cached.map(applyCustomerDueComplete),
    };
  }
  const next = result.items.map(applyCustomerDueComplete);
  const suspicious = rejectSuspiciousEmptyFetch(
    next,
    peekCustomers,
    (items) => items.map(applyCustomerDueComplete)
  );
  if (suspicious) return suspicious;
  persistDueCustomers(result.items, next);
  setCustomersCache(next);
  return { ok: true, items: next };
}

export async function loadCustomersList(): Promise<
  EntityListLoadResult<Customer>
> {
  if (customersInflight) return customersInflight;
  customersInflight = fetchCustomersList().finally(() => {
    customersInflight = null;
  });
  return customersInflight;
}

export async function getCustomers(): Promise<Customer[]> {
  const result = await loadCustomersList();
  return result.items;
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
  const shared = Boolean(customer.workspaceShared === true);
  const payload = withCreatorMeta(
    {
      ...customer,
      workspaceShared: shared,
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

  const rowBody = {
    id: payload.id,
    user_id: ownerId,
    workspace_id: existing?.workspace_id || boundWorkspace,
    created_by: payload.createdBy,
    created_by_name: payload.createdByName,
    workspace_shared: shared,
    payload,
    created_at: payload.createdAt,
    updated_at: payload.updatedAt,
    deleted_at: null,
  };
  await writeEntityRow("customers", existing, rowBody, "고객 저장 실패");
  const saved: Customer = {
    ...payload,
    workspaceId: boundWorkspace || undefined,
    workspaceShared: shared,
  };
  // 방금 쓴 값만 캐시에 반영 — 저장 직후 전체 재조회 생략
  upsertCustomerInCache(saved);
  invalidateMatchPoolCache();
  postImmediateAlertDispatch({
    entityKind: "customer",
    entityId: saved.id,
    label: saved.name?.trim() || "고객",
    workspaceId: boundWorkspace,
    workspaceShared: shared,
  });
  return peekCustomers() ?? [saved];
}

export async function deleteCustomer(id: string): Promise<void> {
  if (await hideForeignSharedRow("customers", id)) return;
  const related = await getSchedulesByCustomer(id);
  for (const s of related) {
    await softDeleteRow("schedules", s.id, "일정");
    removeScheduleFromCache(s.id);
  }
  await softDeleteRow("customers", id, "고객");
  removeCustomerFromCache(id);

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

function isHiddenFromMe(table: EntityTable, id: string, ownerUserId?: string | null) {
  const myId = peekCurrentUser()?.id;
  if (!myId || !ownerUserId || ownerUserId === myId) return false;
  ensureTeamShareHidesUser(myId);
  return isSharedEntityHidden(hideBucketForTable(table), id);
}

export async function getCustomerById(
  id: string
): Promise<Customer | undefined> {
  const cached = findCustomerInCache(id);
  if (cached && isHiddenFromMe("customers", id, cached.createdBy)) {
    removeCustomerFromCache(id);
    return undefined;
  }
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
        const item = applyCustomerDueComplete(enrichCustomer(row));
        upsertCustomerInCache(item);
        if (item.contractCompleted && !cached.contractCompleted) {
          void upsertCustomer(item).catch(() => undefined);
        }
      } catch {
        /* ignore background refresh */
      }
    })();
    return applyCustomerDueComplete(cached);
  }
  try {
    const row = await findRow("customers", id);
    if (!row || row.deleted_at) return undefined;
    if (isHiddenFromMe("customers", id, row.user_id)) return undefined;
    if (isDemoEntityId(id)) {
      const userId = await requireUserId();
      if (row.user_id !== userId) return undefined;
    }
    const item = applyCustomerDueComplete(enrichCustomer(row));
    upsertCustomerInCache(item);
    if (item.contractCompleted && !(row.payload as Customer).contractCompleted) {
      void upsertCustomer(item).catch(() => undefined);
    }
    return item;
  } catch {
    return undefined;
  }
}

let propertiesInflight: Promise<EntityListLoadResult<ListedProperty>> | null =
  null;

async function fetchListedPropertiesList(): Promise<
  EntityListLoadResult<ListedProperty>
> {
  const userId = await getSessionUserId();
  if (userId) ensureEntityCacheUser(userId);
  const result = await listActivePayloads(
    "listed_properties",
    enrichProperty
  );
  if (!result.ok) {
    const cached = peekProperties();
    if (cached === null) return { ok: false, items: [] };
    return {
      ok: false,
      items: cached.map(applyPropertyDueComplete),
    };
  }
  const next = result.items.map(applyPropertyDueComplete);
  const suspicious = rejectSuspiciousEmptyFetch(
    next,
    peekProperties,
    (items) => items.map(applyPropertyDueComplete)
  );
  if (suspicious) return suspicious;
  persistDueProperties(result.items, next);
  setPropertiesCache(next);
  return { ok: true, items: next };
}

export async function loadListedPropertiesList(): Promise<
  EntityListLoadResult<ListedProperty>
> {
  if (propertiesInflight) return propertiesInflight;
  propertiesInflight = fetchListedPropertiesList().finally(() => {
    propertiesInflight = null;
  });
  return propertiesInflight;
}

export async function getListedProperties(): Promise<ListedProperty[]> {
  const result = await loadListedPropertiesList();
  return result.items;
}

let matchPoolFetchInflight: Promise<{
  customers: Customer[];
  properties: ListedProperty[];
} | null> | null = null;

let matchPoolCache: {
  customers: Customer[];
  properties: ListedProperty[];
  at: number;
} | null = null;

async function fetchMatchPoolFromApi(): Promise<{
  customers: Customer[];
  properties: ListedProperty[];
} | null> {
  if (
    matchPoolCache &&
    Date.now() - matchPoolCache.at < MATCH_POOL_CACHE_TTL_MS
  ) {
    return {
      customers: matchPoolCache.customers,
      properties: matchPoolCache.properties,
    };
  }
  if (matchPoolFetchInflight) return matchPoolFetchInflight;
  matchPoolFetchInflight = (async () => {
    const { getAccessToken } = await import("./auth");
    const token = await getAccessToken();
    if (!token) return null;
    try {
      const res = await fetch("/api/match-pool", {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "same-origin",
      });
      if (!res.ok) return null;
      const body = (await res.json()) as {
        ok?: boolean;
        customers?: Customer[];
        properties?: ListedProperty[];
      };
      if (
        !body.ok ||
        !Array.isArray(body.customers) ||
        !Array.isArray(body.properties)
      ) {
        return null;
      }
      matchPoolCache = {
        customers: body.customers,
        properties: body.properties,
        at: Date.now(),
      };
      return { customers: body.customers, properties: body.properties };
    } catch {
      return null;
    }
  })().finally(() => {
    matchPoolFetchInflight = null;
  });
  return matchPoolFetchInflight;
}

let matchPoolCustomersInflight: Promise<Customer[]> | null = null;

export async function getMatchPoolCustomers(): Promise<Customer[]> {
  if (matchPoolCustomersInflight) return matchPoolCustomersInflight;
  matchPoolCustomersInflight = (async () => {
    const fromApi = await fetchMatchPoolFromApi();
    if (fromApi) {
      return fromApi.customers.map(applyCustomerDueComplete);
    }
    const result = await listWorkspaceMatchPoolPayloads(
      "customers",
      enrichCustomer
    );
    if (!result.ok) return [];
    try {
      const userId = await requireUserId();
      const redacted = applyMatchPoolRedaction({
        customers: result.items,
        properties: [],
        viewerUserId: userId,
      });
      return redacted.customers.map(applyCustomerDueComplete);
    } catch {
      return result.items.map(applyCustomerDueComplete);
    }
  })().finally(() => {
    matchPoolCustomersInflight = null;
  });
  return matchPoolCustomersInflight;
}

let matchPoolPropertiesInflight: Promise<ListedProperty[]> | null = null;

export async function getMatchPoolProperties(): Promise<ListedProperty[]> {
  if (matchPoolPropertiesInflight) return matchPoolPropertiesInflight;
  matchPoolPropertiesInflight = (async () => {
    const fromApi = await fetchMatchPoolFromApi();
    if (fromApi) {
      return fromApi.properties.map(applyPropertyDueComplete);
    }
    const result = await listWorkspaceMatchPoolPayloads(
      "listed_properties",
      enrichProperty
    );
    if (!result.ok) return [];
    try {
      const userId = await requireUserId();
      const redacted = applyMatchPoolRedaction({
        customers: [],
        properties: result.items,
        viewerUserId: userId,
      });
      return redacted.properties.map(applyPropertyDueComplete);
    } catch {
      return result.items.map(applyPropertyDueComplete);
    }
  })().finally(() => {
    matchPoolPropertiesInflight = null;
  });
  return matchPoolPropertiesInflight;
}

export function invalidateMatchPoolCache(): void {
  matchPoolCache = null;
  matchPoolFetchInflight = null;
  matchPoolCustomersInflight = null;
  matchPoolPropertiesInflight = null;
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
  const folded = foldDoorPasswordsIntoNotes(property);
  const sanitized: ListedProperty = folded.hasPartnerAgency
    ? {
        ...folded,
        tenantPhone: "",
        landlordPhone: "",
        partnerAgencyShared: false,
      }
    : folded;
  const payload = withCreatorMeta(
    {
      ...sanitized,
      workspaceShared: shared,
      partnerAgencyShared: sanitized.hasPartnerAgency
        ? false
        : Boolean(sanitized.partnerAgencyShared === true),
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

  const rowBody = {
    id: payload.id,
    user_id: ownerId,
    workspace_id: existing?.workspace_id || boundWorkspace,
    created_by: payload.createdBy,
    created_by_name: payload.createdByName,
    workspace_shared: shared,
    payload,
    created_at: payload.createdAt,
    updated_at: payload.updatedAt,
    deleted_at: null,
  };
  await writeEntityRow(
    "listed_properties",
    existing,
    rowBody,
    "매물 저장 실패"
  );
  const saved: ListedProperty = {
    ...payload,
    workspaceId: boundWorkspace || undefined,
    workspaceShared: shared,
  };
  upsertPropertyInCache(saved);
  invalidateMatchPoolCache();
  postImmediateAlertDispatch({
    entityKind: "property",
    entityId: saved.id,
    label: saved.address?.trim() || saved.roomType?.trim() || "매물",
    workspaceId: boundWorkspace,
    workspaceShared: shared,
  });
  return peekProperties() ?? [saved];
}

export async function deleteListedProperty(id: string): Promise<void> {
  if (await hideForeignSharedRow("listed_properties", id)) return;
  await softDeleteRow("listed_properties", id, "매물");
  removePropertyFromCache(id);
}

export async function getListedPropertyById(
  id: string
): Promise<ListedProperty | undefined> {
  const cached = findPropertyInCache(id);
  if (cached && isHiddenFromMe("listed_properties", id, cached.createdBy)) {
    removePropertyFromCache(id);
    return undefined;
  }
  if (cached) {
    try {
      const row = await findRow("listed_properties", id);
      if (!row || row.deleted_at) {
        removePropertyFromCache(id);
        return undefined;
      }
      if (isDemoEntityId(id)) {
        const userId = await requireUserId();
        if (row.user_id !== userId) {
          removePropertyFromCache(id);
          return undefined;
        }
      }
      const item = applyPropertyDueComplete(enrichProperty(row));
      upsertPropertyInCache(item);
      if (item.contractCompleted && !cached.contractCompleted) {
        void upsertListedProperty(item).catch(() => undefined);
      }
      return item;
    } catch {
      return applyPropertyDueComplete(cached);
    }
  }
  try {
    const row = await findRow("listed_properties", id);
    if (!row || row.deleted_at) return undefined;
    if (isHiddenFromMe("listed_properties", id, row.user_id)) return undefined;
    if (isDemoEntityId(id)) {
      const userId = await requireUserId();
      if (row.user_id !== userId) return undefined;
    }
    const item = applyPropertyDueComplete(enrichProperty(row));
    upsertPropertyInCache(item);
    if (
      item.contractCompleted &&
      !(row.payload as ListedProperty).contractCompleted
    ) {
      void upsertListedProperty(item).catch(() => undefined);
    }
    return item;
  } catch {
    return undefined;
  }
}

function persistDueSchedules(original: Schedule[], next: Schedule[]) {
  const changed = next.filter(
    (s, i) => s.visitCompleted && !original[i]?.visitCompleted
  );
  if (changed.length === 0) return;
  void Promise.all(
    changed.map((s) => upsertSchedule(s).catch(() => undefined))
  );
}

let schedulesInflight: Promise<EntityListLoadResult<Schedule>> | null = null;

async function fetchSchedulesList(): Promise<EntityListLoadResult<Schedule>> {
  const userId = await getSessionUserId();
  if (userId) ensureEntityCacheUser(userId);
  const result = await listActivePayloads("schedules", enrichSchedule);
  if (!result.ok) {
    const cached = peekSchedules();
    if (cached === null) return { ok: false, items: [] };
    return {
      ok: false,
      items: cached.map(applyScheduleDueComplete),
    };
  }
  const next = result.items.map(applyScheduleDueComplete);
  const suspicious = rejectSuspiciousEmptyFetch(
    next,
    peekSchedules,
    (items) => items.map(applyScheduleDueComplete)
  );
  if (suspicious) return suspicious;
  persistDueSchedules(result.items, next);
  setSchedulesCache(next);
  return { ok: true, items: next };
}

export async function loadSchedulesList(): Promise<
  EntityListLoadResult<Schedule>
> {
  if (schedulesInflight) return schedulesInflight;
  schedulesInflight = fetchSchedulesList().finally(() => {
    schedulesInflight = null;
  });
  return schedulesInflight;
}

export async function getSchedules(): Promise<Schedule[]> {
  const result = await loadSchedulesList();
  return result.items;
}

export async function refreshAllEntityLists(): Promise<void> {
  await Promise.all([getCustomers(), getListedProperties(), getSchedules()]);
}

function asRealtimeRow(
  record: Record<string, unknown> | null | undefined
): RowMeta | null {
  if (!record || typeof record.id !== "string" || !record.id) return null;
  return {
    id: record.id,
    user_id: String(record.user_id ?? ""),
    workspace_id: (record.workspace_id as string | null) ?? null,
    created_by: (record.created_by as string | null) ?? null,
    created_by_name: String(record.created_by_name ?? ""),
    deleted_at: (record.deleted_at as string | null) ?? null,
    workspace_shared: Boolean(record.workspace_shared),
    payload: record.payload,
  };
}

function removeRealtimeId(table: EntityTable, id: string) {
  if (table === "customers") removeCustomerFromCache(id);
  else if (table === "listed_properties") removePropertyFromCache(id);
  else removeScheduleFromCache(id);
}

/** 실시간 행 변경 → entityCache만 고침 (화면별 재조회 없음) */
export async function applyRealtimeEntityChange(input: {
  table: string;
  eventType: string;
  newRecord?: Record<string, unknown> | null;
  oldRecord?: Record<string, unknown> | null;
}): Promise<void> {
  const table = input.table as EntityTable;
  if (
    table !== "customers" &&
    table !== "listed_properties" &&
    table !== "schedules"
  ) {
    return;
  }

  const event = input.eventType.toUpperCase();
  const id =
    (typeof input.newRecord?.id === "string" && input.newRecord.id) ||
    (typeof input.oldRecord?.id === "string" && input.oldRecord.id) ||
    "";
  if (!id) return;

  if (event === "DELETE") {
    unhideSharedEntity(hideBucketForTable(table), id);
    removeRealtimeId(table, id);
    return;
  }

  const row = asRealtimeRow(input.newRecord);
  if (!row) {
    removeRealtimeId(table, id);
    return;
  }

  if (row.deleted_at) {
    unhideSharedEntity(hideBucketForTable(table), id);
    removeRealtimeId(table, id);
    return;
  }

  if (isDemoEntityId(row.id)) {
    const userId = await getSessionUserId();
    if (
      !userId ||
      row.user_id !== userId ||
      isDemoHiddenForUser(peekCurrentUser())
    ) {
      removeRealtimeId(table, id);
      return;
    }
  }

  if (!(await canAccessEntityRow(row))) {
    unhideSharedEntity(hideBucketForTable(table), id);
    removeRealtimeId(table, id);
    return;
  }

  const viewerId = await getSessionUserId();
  if (
    viewerId &&
    row.user_id !== viewerId &&
    isSharedEntityHidden(hideBucketForTable(table), id)
  ) {
    removeRealtimeId(table, id);
    return;
  }

  if (!row.payload || typeof row.payload !== "object") return;

  if (table === "customers") {
    upsertCustomerInCache(applyCustomerDueComplete(enrichCustomer(row)));
  } else if (table === "listed_properties") {
    upsertPropertyInCache(applyPropertyDueComplete(enrichProperty(row)));
  } else {
    upsertScheduleInCache(applyScheduleDueComplete(enrichSchedule(row)));
  }
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

  const rowBody = {
    id: payload.id,
    user_id: ownerId,
    workspace_id: existing?.workspace_id || boundWorkspace,
    created_by: payload.createdBy,
    created_by_name: payload.createdByName,
    workspace_shared: Boolean(payload.workspaceShared),
    payload,
    created_at: payload.createdAt,
    updated_at: payload.updatedAt,
    deleted_at: null,
  };
  await writeEntityRow("schedules", existing, rowBody, "일정 저장 실패");
  const saved: Schedule = {
    ...payload,
    workspaceId: boundWorkspace || undefined,
  };
  upsertScheduleInCache(saved);
  const shared = Boolean(payload.workspaceShared);
  postImmediateAlertDispatch({
    entityKind: "schedule",
    entityId: saved.id,
    label:
      saved.guestName?.trim() ||
      saved.title?.trim() ||
      "방문 일정",
    workspaceId: boundWorkspace,
    workspaceShared: shared,
  });
  return peekSchedules() ?? [saved];
}

export async function deleteSchedule(id: string): Promise<void> {
  if (await hideForeignSharedRow("schedules", id)) return;
  await softDeleteRow("schedules", id, "일정");
  removeScheduleFromCache(id);
}

export async function getScheduleById(
  id: string
): Promise<Schedule | undefined> {
  const cached = findScheduleInCache(id);
  if (cached && isHiddenFromMe("schedules", id, cached.createdBy)) {
    removeScheduleFromCache(id);
    return undefined;
  }
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
        const item = applyScheduleDueComplete(enrichSchedule(row));
        upsertScheduleInCache(item);
        if (item.visitCompleted && !cached.visitCompleted) {
          void upsertSchedule(item).catch(() => undefined);
        }
      } catch {
        /* ignore */
      }
    })();
    return applyScheduleDueComplete(cached);
  }
  try {
    const row = await findRow("schedules", id);
    if (!row || row.deleted_at) return undefined;
    if (isHiddenFromMe("schedules", id, row.user_id)) return undefined;
    if (isDemoEntityId(id)) {
      const userId = await requireUserId();
      if (row.user_id !== userId) return undefined;
    }
    const item = applyScheduleDueComplete(enrichSchedule(row));
    upsertScheduleInCache(item);
    if (item.visitCompleted && !(row.payload as Schedule).visitCompleted) {
      void upsertSchedule(item).catch(() => undefined);
    }
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
