/**
 * e2e 테스트로 만든 Auth 유저·profiles 정리.
 * username 이 e2e 접두사(auth/fail/cache/own/mem/sus/del/e2e 등)인 계정 삭제.
 *
 * 사용:
 *   node --env-file=.env.local scripts/cleanup-e2e-users.mjs
 */
import { createClient } from "@supabase/supabase-js";

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();

if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 필요");
  process.exit(1);
}

const PREFIX =
  /^(e2e|auth|fail|cachea|cacheb|own|mem|sus|del|tgl|join|bad)[a-f0-9]{6}$/i;

const admin = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function listAllUsers() {
  const users = [];
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
  return users;
}

const users = await listAllUsers();
const targets = users.filter((u) => {
  const username = String(u.user_metadata?.username ?? "").toLowerCase();
  const emailLocal = String(u.email ?? "")
    .split("@")[0]
    .toLowerCase();
  return PREFIX.test(username) || PREFIX.test(emailLocal);
});

console.log(`found ${targets.length} e2e-like users`);

let ok = 0;
let fail = 0;
for (const u of targets) {
  const username = u.user_metadata?.username ?? u.email;
  const { error } = await admin.auth.admin.deleteUser(u.id);
  if (error) {
    fail += 1;
    console.error("fail", username, error.message);
    continue;
  }
  await admin.from("profiles").delete().eq("id", u.id);
  await admin.from("deleted_accounts").delete().eq("username", username);
  ok += 1;
  console.log("deleted", username);
}

console.log(`done ok=${ok} fail=${fail}`);
