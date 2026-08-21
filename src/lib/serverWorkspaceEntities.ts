import type { createAdminClient } from "@/lib/supabase/admin";
import type { ForeignSharedEntity } from "@/lib/serverShareAlertScan";
import type { Customer, ListedProperty } from "@/lib/types";

type Admin = ReturnType<typeof createAdminClient>;

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

function enrichCustomer(row: RowMeta): Customer {
  const payload = row.payload as Customer;
  return {
    ...payload,
    createdBy: row.created_by || payload.createdBy,
    createdByName: row.created_by_name || payload.createdByName || "",
    workspaceId: row.workspace_id || payload.workspaceId,
    workspaceShared: row.workspace_shared ?? payload.workspaceShared ?? false,
  };
}

function enrichProperty(row: RowMeta): ListedProperty {
  const payload = row.payload as ListedProperty;
  return {
    ...payload,
    createdBy: row.created_by || payload.createdBy,
    createdByName: row.created_by_name || payload.createdByName || "",
    workspaceId: row.workspace_id || payload.workspaceId,
    workspaceShared: row.workspace_shared ?? payload.workspaceShared ?? false,
  };
}

async function getWorkspaceId(admin: Admin, userId: string): Promise<string | null> {
  const { data } = await admin
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userId)
    .maybeSingle();
  return (data?.workspace_id as string | undefined) ?? null;
}

async function listTable<T>(
  admin: Admin,
  table: "customers" | "listed_properties",
  userId: string,
  mapRow: (row: RowMeta) => T
): Promise<T[]> {
  const workspaceId = await getWorkspaceId(admin, userId);
  const selectCols =
    "id, user_id, workspace_id, created_by, created_by_name, deleted_at, workspace_shared, payload";

  const { data: own, error } = await admin
    .from(table)
    .select(selectCols)
    .eq("user_id", userId)
    .is("deleted_at", null);

  if (error || !own) return [];

  const byId = new Map<string, RowMeta>();
  for (const row of own as unknown as RowMeta[]) {
    byId.set(row.id, row);
  }

  if (workspaceId) {
    const { data: shared } = await admin
      .from(table)
      .select(selectCols)
      .eq("workspace_id", workspaceId)
      .eq("workspace_shared", true)
      .is("deleted_at", null);
    if (shared) {
      for (const row of shared as unknown as RowMeta[]) {
        if (!byId.has(row.id)) byId.set(row.id, row);
      }
    }
  }

  return [...byId.values()]
    .filter((row) => !row.id.startsWith("demo_") || row.user_id === userId)
    .map(mapRow);
}

async function listTableAllWorkspace<T>(
  admin: Admin,
  table: "customers" | "listed_properties",
  userId: string,
  mapRow: (row: RowMeta) => T
): Promise<T[]> {
  const workspaceId = await getWorkspaceId(admin, userId);
  const selectCols =
    "id, user_id, workspace_id, created_by, created_by_name, deleted_at, workspace_shared, payload";

  const { data: own, error } = await admin
    .from(table)
    .select(selectCols)
    .eq("user_id", userId)
    .is("deleted_at", null);

  if (error || !own) return [];

  const byId = new Map<string, RowMeta>();
  for (const row of own as unknown as RowMeta[]) {
    byId.set(row.id, row);
  }

  if (workspaceId) {
    const { data: workspaceRows } = await admin
      .from(table)
      .select(selectCols)
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null);
    if (workspaceRows) {
      for (const row of workspaceRows as unknown as RowMeta[]) {
        if (!byId.has(row.id)) byId.set(row.id, row);
      }
    }
  }

  return [...byId.values()]
    .filter((row) => !row.id.startsWith("demo_") || row.user_id === userId)
    .map(mapRow);
}

export async function loadWorkspaceCustomersForUser(
  admin: Admin,
  userId: string
): Promise<Customer[]> {
  return listTable(admin, "customers", userId, enrichCustomer);
}

export async function loadWorkspacePropertiesForUser(
  admin: Admin,
  userId: string
): Promise<ListedProperty[]> {
  return listTable(admin, "listed_properties", userId, enrichProperty);
}

export async function loadMatchPoolCustomersForUser(
  admin: Admin,
  userId: string
): Promise<Customer[]> {
  return listTableAllWorkspace(admin, "customers", userId, enrichCustomer);
}

export async function loadMatchPoolPropertiesForUser(
  admin: Admin,
  userId: string
): Promise<ListedProperty[]> {
  return listTableAllWorkspace(
    admin,
    "listed_properties",
    userId,
    enrichProperty
  );
}

type SchedulePayload = {
  guestName?: string;
  customerName?: string;
};

async function listForeignSharedRows(
  admin: Admin,
  table: "customers" | "listed_properties" | "schedules",
  userId: string,
  workspaceId: string
): Promise<RowMeta[]> {
  const selectCols =
    "id, user_id, workspace_id, created_by, created_by_name, deleted_at, workspace_shared, payload";
  const { data } = await admin
    .from(table)
    .select(selectCols)
    .eq("workspace_id", workspaceId)
    .eq("workspace_shared", true)
    .is("deleted_at", null);
  if (!data) return [];
  return (data as unknown as RowMeta[]).filter(
    (row) =>
      row.user_id !== userId &&
      row.created_by !== userId &&
      !row.id.startsWith("demo_")
  );
}

export async function loadForeignSharedEntitiesForUser(
  admin: Admin,
  userId: string
): Promise<ForeignSharedEntity[]> {
  const workspaceId = await getWorkspaceId(admin, userId);
  if (!workspaceId) return [];

  const [customers, properties, schedules] = await Promise.all([
    listForeignSharedRows(admin, "customers", userId, workspaceId),
    listForeignSharedRows(admin, "listed_properties", userId, workspaceId),
    listForeignSharedRows(admin, "schedules", userId, workspaceId),
  ]);

  const out: ForeignSharedEntity[] = [];

  for (const row of customers) {
    const payload = row.payload as Customer;
    out.push({
      id: row.id,
      tab: "customers",
      label: payload.name?.trim() || "고객",
    });
  }
  for (const row of properties) {
    const payload = row.payload as ListedProperty;
    out.push({
      id: row.id,
      tab: "properties",
      label: payload.address?.trim() || payload.roomType?.trim() || "매물",
    });
  }
  for (const row of schedules) {
    const payload = row.payload as SchedulePayload;
    out.push({
      id: row.id,
      tab: "navi",
      label:
        payload.guestName?.trim() ||
        payload.customerName?.trim() ||
        "방문 일정",
    });
  }

  return out;
}
