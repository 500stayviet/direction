/**
 * DB 현황 조회 — node scripts/inspect-db.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const env = Object.fromEntries(
  readFileSync(join(root, ".env.local"), "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const DEMO_IDS = new Set([
  "demo_cust_1",
  "demo_prop_1",
  "demo_sch_1",
]);

async function countTable(table, filter) {
  let q = supabase.from(table).select("*", { count: "exact", head: true });
  if (filter) q = filter(q);
  const { count, error } = await q;
  if (error) return `ERR: ${error.message}`;
  return count ?? 0;
}

async function listIds(table, limit = 50) {
  const { data, error } = await supabase.from(table).select("id, user_id").limit(limit);
  if (error) return [];
  return data ?? [];
}

console.log("=== profiles ===", await countTable("profiles"));
const { data: profiles } = await supabase
  .from("profiles")
  .select("id, username, shop_name, plan_tier, promo_source, demo_seed_version");
console.log(profiles);

console.log("\n=== auth users ===");
const { data: authList } = await supabase.auth.admin.listUsers({ page: 1, perPage: 100 });
for (const u of authList?.users ?? []) {
  console.log(`- ${u.email} (${u.id}) created=${u.created_at}`);
}

for (const table of ["customers", "listed_properties", "schedules"]) {
  const rows = await listIds(table, 100);
  const demo = rows.filter((r) => DEMO_IDS.has(r.id));
  const adminTest = rows.filter((r) => String(r.id).startsWith("admin_test_soft"));
  const other = rows.filter(
    (r) => !DEMO_IDS.has(r.id) && !String(r.id).startsWith("admin_test_soft")
  );
  console.log(`\n=== ${table} total=${rows.length} demo=${demo.length} admin_test=${adminTest.length} other=${other.length} ===`);
  if (adminTest.length) console.log("  admin_test:", adminTest.map((r) => r.id));
  if (other.length) console.log("  other:", other.slice(0, 20).map((r) => r.id));
}

for (const table of [
  "audit_logs",
  "deleted_accounts",
  "promo_codes",
  "promo_redemptions",
  "referrals",
  "promo_campaigns",
  "admin_users",
  "admin_login_attempts",
  "workspaces",
  "workspace_members",
]) {
  console.log(`${table}:`, await countTable(table));
}
