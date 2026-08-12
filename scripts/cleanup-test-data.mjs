/**
 * 회원가입 체험용 demo_* 리스트는 유지하고, 그 외 테스트·임시 데이터 삭제
 * 사용: node scripts/cleanup-test-data.mjs
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

if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 필요");
  process.exit(1);
}

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const DEMO_PREFIX = "demo_";
const ADMIN_TEST_PREFIX = "admin_test_soft";

async function deleteNonDemoRows(table) {
  const { data: rows, error: listErr } = await supabase
    .from(table)
    .select("id");
  if (listErr) throw new Error(`${table} list: ${listErr.message}`);

  const toDelete = (rows ?? [])
    .map((r) => String(r.id))
    .filter((id) => !id.startsWith(DEMO_PREFIX));

  if (toDelete.length === 0) {
    console.log(`✓ ${table}: 삭제할 행 없음`);
    return;
  }

  const { error, count } = await supabase
    .from(table)
    .delete({ count: "exact" })
    .in("id", toDelete);
  if (error) throw new Error(`${table} delete: ${error.message}`);
  console.log(`✓ ${table}: ${count ?? toDelete.length}행 삭제 (demo_* 유지)`);
}

async function wipeTable(table) {
  const { error, count } = await supabase
    .from(table)
    .delete({ count: "exact" })
    .neq("id", "00000000-0000-0000-0000-000000000000");
  if (error) {
    const { error: e2, count: c2 } = await supabase
      .from(table)
      .delete({ count: "exact" })
      .gte("created_at", "1970-01-01");
    if (e2) throw new Error(`${table}: ${e2.message}`);
    console.log(`✓ ${table}: ${c2 ?? "?"}행 삭제`);
    return;
  }
  console.log(`✓ ${table}: ${count ?? "?"}행 삭제`);
}

console.log("=== 테스트 데이터 정리 (demo_* 체험 리스트 유지) ===\n");

for (const table of ["schedules", "listed_properties", "customers"]) {
  await deleteNonDemoRows(table);
}

for (const table of [
  "audit_logs",
  "promo_redemptions",
  "referrals",
  "promo_codes",
  "promo_campaigns",
  "admin_login_attempts",
]) {
  await wipeTable(table);
}

// test 전용 auth 계정 삭제 (demo는 cascade로 같이 삭제됨 — 재로그인/재가입 시 AuthGate가 demo 재시드)
const { data: authList } = await supabase.auth.admin.listUsers({
  page: 1,
  perPage: 100,
});
const testUser = authList?.users?.find(
  (u) => u.email === "test@users.direction.app"
);
if (testUser) {
  const { error } = await supabase.auth.admin.deleteUser(testUser.id);
  if (error) {
    console.warn(`! test 계정 삭제 실패: ${error.message}`);
  } else {
    console.log(`✓ test@users.direction.app 계정 삭제 (프로필·demo cascade)`);
  }
} else {
  console.log("· test@users.direction.app 계정 없음");
}

console.log("\n=== 잔여 확인 ===");
for (const table of ["customers", "listed_properties", "schedules"]) {
  const { count } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true });
  console.log(`${table}: ${count ?? 0}`);
}
const { data: leftUsers } = await supabase.auth.admin.listUsers({
  page: 1,
  perPage: 100,
});
console.log(`auth.users: ${leftUsers?.users?.length ?? 0}`);
console.log("\n=== 완료 ===");
