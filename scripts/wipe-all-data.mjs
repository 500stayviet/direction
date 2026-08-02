/**
 * Supabase 전체 초기화: 일정·매물·고객·프로필·Auth 계정 전부 삭제
 * 사용: node scripts/wipe-all-data.mjs
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

async function deleteAllRows(table) {
  // service role: RLS 우회. 전체 삭제용 더미 조건
  const { error, count } = await supabase
    .from(table)
    .delete({ count: "exact" })
    .neq("user_id", "00000000-0000-0000-0000-000000000000");
  if (error) {
    // profiles 는 id 기준
    if (table === "profiles") {
      const { error: e2, count: c2 } = await supabase
        .from("profiles")
        .delete({ count: "exact" })
        .neq("id", "00000000-0000-0000-0000-000000000000");
      if (e2) throw new Error(`${table}: ${e2.message}`);
      console.log(`✓ ${table}: ${c2 ?? "?"}행 삭제`);
      return;
    }
    throw new Error(`${table}: ${error.message}`);
  }
  console.log(`✓ ${table}: ${count ?? "?"}행 삭제`);
}

async function deleteAllAuthUsers() {
  let deleted = 0;
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 100,
    });
    if (error) throw new Error(`listUsers: ${error.message}`);
    const users = data?.users ?? [];
    if (users.length === 0) break;

    for (const u of users) {
      const { error: delErr } = await supabase.auth.admin.deleteUser(u.id);
      if (delErr) {
        console.warn(`  ! 유저 삭제 실패 ${u.email || u.id}: ${delErr.message}`);
      } else {
        deleted += 1;
        console.log(`  - auth 삭제: ${u.email || u.id}`);
      }
    }
  }
  console.log(`✓ auth.users: ${deleted}명 삭제`);
}

console.log("=== Supabase 전체 초기화 시작 ===\n");

// FK: schedules/customers/listed_properties → auth.users, profiles → auth.users
await deleteAllRows("schedules");
await deleteAllRows("listed_properties");
await deleteAllRows("customers");
await deleteAllRows("profiles");
await deleteAllAuthUsers();

// 잔여 확인
const tables = ["schedules", "listed_properties", "customers", "profiles"];
for (const table of tables) {
  const { count, error } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true });
  if (error) {
    console.warn(`잔여 확인 ${table}: ${error.message}`);
  } else {
    console.log(`잔여 ${table}: ${count ?? 0}`);
  }
}
const { data: left } = await supabase.auth.admin.listUsers({
  page: 1,
  perPage: 10,
});
console.log(`잔여 auth.users: ${left?.users?.length ?? 0}`);

console.log("\n=== Supabase 초기화 완료 ===");
console.log(
  "브라우저: 사이트 데이터 삭제 또는 시크릿 창으로 새로 가입하세요."
);
console.log(
  "(localStorage / sessionStorage / cookies — 앱이 직접 지우지 않음)"
);
