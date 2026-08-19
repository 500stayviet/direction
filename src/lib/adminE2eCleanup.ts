import type { SupabaseClient } from "@supabase/supabase-js";
import { isE2eAuthUser } from "@/lib/e2eUserDetect";

const ENTITY_TABLES = ["customers", "listed_properties", "schedules"] as const;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function deleteByUserIds(
  admin: SupabaseClient,
  table: (typeof ENTITY_TABLES)[number],
  ids: string[]
): Promise<number> {
  if (!ids.length) return 0;
  let total = 0;
  for (const part of chunk(ids, 100)) {
    const { data, error } = await admin
      .from(table)
      .delete()
      .in("user_id", part)
      .select("id");
    if (error) throw new Error(`${table}.user_id: ${error.message}`);
    total += data?.length ?? 0;
  }
  return total;
}

async function deleteE2eMarkedEntities(
  admin: SupabaseClient
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};

  for (const table of ENTITY_TABLES) {
    const { data, error } = await admin
      .from(table)
      .delete()
      .eq("created_by_name", "e2e")
      .select("id");
    if (error) throw new Error(`${table}.created_by_name=e2e: ${error.message}`);
    counts[`${table}_e2e_marker`] = data?.length ?? 0;
  }

  const { data: rows, error } = await admin
    .from("customers")
    .select("id, payload");
  if (error) throw new Error(`customers scan: ${error.message}`);

  const ids = (rows ?? [])
    .filter((r) => {
      const name = String(
        (r.payload as { name?: string } | null)?.name ?? ""
      );
      const notes = String(
        (r.payload as { notes?: string } | null)?.notes ?? ""
      );
      if (notes.includes("e2e preferred location")) return true;
      if (/^(원룸선호|등록선호)(pref|prefu)/i.test(name)) return true;
      return false;
    })
    .map((r) => r.id);

  let nameNotes = 0;
  for (const part of chunk(ids, 100)) {
    const { data, error: delErr } = await admin
      .from("customers")
      .delete()
      .in("id", part)
      .select("id");
    if (delErr) throw new Error(`customers e2e name: ${delErr.message}`);
    nameNotes += data?.length ?? 0;
  }
  counts.customers_e2e_name_notes = nameNotes;
  return counts;
}

async function wipeTable(admin: SupabaseClient, table: string): Promise<number> {
  const { error, count } = await admin
    .from(table)
    .delete({ count: "exact" })
    .gte("created_at", "1970-01-01T00:00:00Z");
  if (error) throw new Error(`${table}: ${error.message}`);
  return count ?? 0;
}

async function clearParserSamples(
  admin: SupabaseClient,
  table: string
): Promise<number> {
  const { count: before } = await admin
    .from(table)
    .select("*", { count: "exact", head: true });
  const { error } = await admin
    .from(table)
    .delete()
    .gt("created_at", "1970-01-01T00:00:00Z");
  if (error) throw new Error(`${table}: ${error.message}`);
  return before ?? 0;
}

export type AdminE2eCleanupResult = {
  e2eUserCount: number;
  personalUserCount: number;
  entitiesByE2eUser: Record<string, number>;
  e2eMarkers: Record<string, number>;
  miscTables: Record<string, number>;
  parserSamples: Record<string, number>;
  testAuthDeleted: boolean;
};

/**
 * e2e·임시 테스트 데이터만 정리.
 * 개인 계정 고객·매물·네비, deleted_accounts(탈퇴), workspaces 는 건드리지 않음.
 */
export async function cleanupE2eTestData(
  admin: SupabaseClient
): Promise<AdminE2eCleanupResult> {
  const users: Array<{
    id: string;
    email?: string | null;
    user_metadata?: Record<string, unknown>;
  }> = [];
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw error;
    users.push(...(data.users ?? []));
    if (!data.users?.length || data.users.length < 200) break;
    page += 1;
  }

  const e2eUsers = users.filter((u) => isE2eAuthUser(u));
  const e2eIds = e2eUsers.map((u) => u.id);

  const e2eMarkers = await deleteE2eMarkedEntities(admin);

  const entitiesByE2eUser: Record<string, number> = {};
  for (const table of ENTITY_TABLES) {
    entitiesByE2eUser[table] = await deleteByUserIds(admin, table, e2eIds);
  }

  const miscTables: Record<string, number> = {};
  for (const table of [
    "audit_logs",
    "promo_redemptions",
    "referrals",
    "promo_codes",
    "promo_campaigns",
    "admin_login_attempts",
  ]) {
    miscTables[table] = await wipeTable(admin, table);
  }

  const parserSamples: Record<string, number> = {};
  for (const table of ["intake_parse_samples", "navi_meeting_parse_samples"]) {
    try {
      parserSamples[table] = await clearParserSamples(admin, table);
    } catch {
      parserSamples[table] = 0;
    }
  }

  const testUser = users.find((u) => u.email === "test@users.direction.app");
  let testAuthDeleted = false;
  if (testUser) {
    const { error } = await admin.auth.admin.deleteUser(testUser.id);
    testAuthDeleted = !error;
  }

  return {
    e2eUserCount: e2eUsers.length,
    personalUserCount: users.length - e2eUsers.length,
    entitiesByE2eUser,
    e2eMarkers,
    miscTables,
    parserSamples,
    testAuthDeleted,
  };
}
