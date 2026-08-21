import type { createAdminClient } from "@/lib/supabase/admin";
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
