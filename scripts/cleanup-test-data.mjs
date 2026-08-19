/**
 * e2e·임시 테스트 데이터만 정리. 개인 계정 매물·고객·일정은 건드리지 않음.
 *
 * 사용:
 *   node --env-file=.env.local scripts/cleanup-test-data.mjs
 *   npm run cleanup:test-data
 *
 * Auth e2e 계정 전체 삭제는 cleanup-e2e-users.mjs (npm run cleanup:e2e-users) 사용.
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

/** cleanup-e2e-users.mjs 와 동일 */
const E2E_PREFIX =
  /^(e2e|auth|fail|cachea|cacheb|own|mem|sus|del|tgl|join|bad|pref|prefu|intro|talk|msg|choice|pchoice|cform)[a-f0-9]{6}$/i;

const ENTITY_TABLES = ["customers", "listed_properties", "schedules"];

function isE2eUsername(value) {
  return E2E_PREFIX.test(String(value ?? "").toLowerCase());
}

function isE2eProfileMeta(u) {
  const meta = u.user_metadata ?? {};
  const shop = String(meta.shop_name ?? "");
  const display = String(meta.display_name ?? "");
  const hint = String(meta.password_hint ?? "");
  if (hint === "e2e-hint") return true;
  if (/^이투이[a-f0-9]{6}$/i.test(shop)) return true;
  if (/^테스터[a-f0-9]{6}$/i.test(display)) return true;
  return false;
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function listAllUsers() {
  const users = [];
  let page = 1;
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw error;
    users.push(...(data.users ?? []));
    if (!data.users?.length || data.users.length < 200) break;
    page += 1;
  }
  return users;
}

async function deleteByUserIds(table, column, ids) {
  if (!ids.length) return 0;
  let total = 0;
  for (const part of chunk(ids, 100)) {
    const { data, error } = await supabase
      .from(table)
      .delete()
      .in(column, part)
      .select("id");
    if (error) throw new Error(`${table}.${column}: ${error.message}`);
    total += data?.length ?? 0;
  }
  return total;
}

/** created_by_name=e2e 또는 e2e 고객명 패턴 */
async function deleteE2eMarkedEntities() {
  for (const table of ENTITY_TABLES) {
    const { data, error } = await supabase
      .from(table)
      .delete()
      .eq("created_by_name", "e2e")
      .select("id");
    if (error) {
      console.error(`${table} created_by_name=e2e`, error.message);
    } else {
      console.log(
        `✓ ${table}(created_by_name=e2e)=${data?.length ?? 0} 삭제`
      );
    }
  }

  const { data: rows, error } = await supabase
    .from("customers")
    .select("id, payload");
  if (error) {
    console.error("customers scan", error.message);
    return;
  }
  const ids = (rows ?? [])
    .filter((r) => {
      const name = String(r.payload?.name ?? "");
      const notes = String(r.payload?.notes ?? "");
      if (notes.includes("e2e preferred location")) return true;
      if (/^(원룸선호|등록선호)(pref|prefu)/i.test(name)) return true;
      return false;
    })
    .map((r) => r.id);
  if (!ids.length) {
    console.log("✓ customers(e2e name/notes)=0");
    return;
  }
  let n = 0;
  for (const part of chunk(ids, 100)) {
    const { data, error: delErr } = await supabase
      .from("customers")
      .delete()
      .in("id", part)
      .select("id");
    if (delErr) console.error("customers e2e name delete", delErr.message);
    else n += data?.length ?? 0;
  }
  console.log(`✓ customers(e2e name/notes)=${n} 삭제`);
}

async function wipeTable(table) {
  const { error, count } = await supabase
    .from(table)
    .delete({ count: "exact" })
    .gte("created_at", "1970-01-01T00:00:00Z");
  if (error) throw new Error(`${table}: ${error.message}`);
  console.log(`✓ ${table}: ${count ?? "?"}행 삭제`);
}

async function clearParserSamples(table) {
  const { count: before } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true });
  const { error } = await supabase
    .from(table)
    .delete()
    .gt("created_at", "1970-01-01T00:00:00Z");
  if (error) {
    console.warn(`! ${table}: ${error.message}`);
    return;
  }
  console.log(`✓ ${table}: ${before ?? 0}행 삭제`);
}

console.log("=== e2e·임시 테스트 데이터 정리 (개인 계정 데이터 유지) ===\n");

const users = await listAllUsers();
const e2eUsers = users.filter((u) => {
  const username = String(u.user_metadata?.username ?? "");
  const emailLocal = String(u.email ?? "").split("@")[0];
  return (
    isE2eUsername(username) ||
    isE2eUsername(emailLocal) ||
    isE2eProfileMeta(u)
  );
});
const e2eIds = e2eUsers.map((u) => u.id);
console.log(`e2e-like users=${e2eUsers.length} (개인 계정=${users.length - e2eUsers.length})\n`);

await deleteE2eMarkedEntities();

for (const table of ENTITY_TABLES) {
  try {
    const n = await deleteByUserIds(table, "user_id", e2eIds);
    console.log(`✓ ${table} by e2e user_id=${n} 삭제`);
  } catch (e) {
    console.error(table, e instanceof Error ? e.message : e);
  }
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

for (const table of ["intake_parse_samples", "navi_meeting_parse_samples"]) {
  await clearParserSamples(table);
}

const testUser = users.find((u) => u.email === "test@users.direction.app");
if (testUser) {
  const { error } = await supabase.auth.admin.deleteUser(testUser.id);
  if (error) {
    console.warn(`! test 계정 삭제 실패: ${error.message}`);
  } else {
    console.log("✓ test@users.direction.app 계정 삭제");
  }
} else {
  console.log("· test@users.direction.app 계정 없음");
}

console.log("\n=== 잔여 확인 ===");
for (const table of ENTITY_TABLES) {
  const { count } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true });
  console.log(`${table}: ${count ?? 0}`);
}
console.log(`auth.users: ${users.length - (testUser ? 1 : 0)}`);
console.log("\n=== 완료 ===");
console.log(
  "※ e2e Auth 계정까지 삭제하려면: npm run cleanup:e2e-users"
);
