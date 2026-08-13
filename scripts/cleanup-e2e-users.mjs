/**
 * e2e 테스트로 만든 Auth 유저·프로필·매물·고객·일정·팀·삭제보관 정리.
 *
 * 사용:
 *   node --env-file=.env.local scripts/cleanup-e2e-users.mjs
 *   npm run cleanup:e2e-users
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

const ENTITY_TABLES = ["customers", "listed_properties", "schedules"];

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

function isE2eUsername(value) {
  return PREFIX.test(String(value ?? "").toLowerCase());
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function deleteByUserIds(table, column, ids) {
  if (!ids.length) return 0;
  let total = 0;
  for (const part of chunk(ids, 100)) {
    const { data, error } = await admin
      .from(table)
      .delete()
      .in(column, part)
      .select("*");
    if (error) throw new Error(`${table}.${column}: ${error.message}`);
    total += data?.length ?? 0;
  }
  return total;
}

const users = await listAllUsers();
const targets = users.filter((u) => {
  const username = String(u.user_metadata?.username ?? "");
  const emailLocal = String(u.email ?? "").split("@")[0];
  return isE2eUsername(username) || isE2eUsername(emailLocal);
});

const targetIds = targets.map((u) => u.id);
const targetUsernames = [
  ...new Set(
    targets
      .map((u) => String(u.user_metadata?.username ?? "").trim())
      .filter(Boolean)
  ),
];

console.log(`found ${targets.length} e2e-like users`);

// 1) e2e 마커 매물/자료 (유저가 남아 있지 않아도)
{
  const { data, error } = await admin
    .from("listed_properties")
    .delete()
    .eq("created_by_name", "e2e")
    .select("id");
  if (error) console.error("listed_properties created_by_name=e2e", error.message);
  else console.log(`deleted listed_properties(created_by_name=e2e)=${data?.length ?? 0}`);
}

// 2) 대상 유저 소유 엔티티 hard delete
for (const table of ENTITY_TABLES) {
  try {
    const n = await deleteByUserIds(table, "user_id", targetIds);
    console.log(`deleted ${table} by user_id=${n}`);
  } catch (e) {
    console.error(table, e instanceof Error ? e.message : e);
  }
}

// 3) 대상 유저가 만든 워크스페이스 전부 해체
{
  const { data: ownedWs, error } = await admin
    .from("workspaces")
    .select("id")
    .in("created_by", targetIds.length ? targetIds : ["00000000-0000-0000-0000-000000000000"]);
  if (error) {
    console.error("workspaces select", error.message);
  } else {
    const wsIds = (ownedWs ?? []).map((w) => w.id);
    console.log(`owned workspaces=${wsIds.length}`);
    for (const part of chunk(wsIds, 50)) {
      // members cascade on workspace delete; entities set null
      await admin.from("audit_logs").delete().in("workspace_id", part);
      await admin.from("workspace_members").delete().in("workspace_id", part);
      // clear FK on entities before workspace delete (on delete set null, but be explicit)
      for (const table of ENTITY_TABLES) {
        await admin
          .from(table)
          .update({ workspace_id: null, workspace_shared: false })
          .in("workspace_id", part);
      }
      const { error: delWs } = await admin.from("workspaces").delete().in("id", part);
      if (delWs) console.error("workspaces delete", delWs.message);
    }
  }
}

// 4) 멤버십만 남은 경우 (다른 사람이 만든 팀에 참여) — e2e 멤버 제거
{
  const { error } = await admin
    .from("workspace_members")
    .delete()
    .in("user_id", targetIds.length ? targetIds : ["00000000-0000-0000-0000-000000000000"]);
  if (error) console.error("workspace_members", error.message);
  else console.log("cleared workspace_members for e2e users");
}

// 5) deleted_accounts 보관본 (계정삭제 e2e)
{
  // username 패턴 + 표시명이 테스터*
  const { data: rows, error } = await admin
    .from("deleted_accounts")
    .select("username, display_name, shop_name");
  if (error) {
    console.error("deleted_accounts list", error.message);
  } else {
    const delNames = (rows ?? [])
      .filter((r) => {
        if (isE2eUsername(r.username)) return true;
        if (targetUsernames.includes(String(r.username))) return true;
        const dn = String(r.display_name ?? "");
        const sn = String(r.shop_name ?? "");
        return /^테스터[a-f0-9]{6}$/i.test(dn) || /^이투이[a-f0-9]{6}$/i.test(sn);
      })
      .map((r) => r.username);
    for (const part of chunk(delNames, 50)) {
      const { error: delErr } = await admin
        .from("deleted_accounts")
        .delete()
        .in("username", part);
      if (delErr) console.error("deleted_accounts delete", delErr.message);
    }
    console.log(`deleted deleted_accounts=${delNames.length}`);
  }
}

// 6) profiles 선삭제 후 auth 유저 삭제
let ok = 0;
let fail = 0;
for (const u of targets) {
  const username = u.user_metadata?.username ?? u.email;
  await admin.from("profiles").delete().eq("id", u.id);
  // promo / referral leftovers if any
  await admin.from("promo_redemptions").delete().eq("user_id", u.id);
  await admin.from("referrals").delete().eq("referred_user_id", u.id);

  const { error } = await admin.auth.admin.deleteUser(u.id);
  if (error) {
    fail += 1;
    console.error("fail", username, error.message);
    continue;
  }
  ok += 1;
  console.log("deleted user", username);
}

// 7) 빈 워크스페이스·고아 e2e 매물 한 번 더
{
  const { data: props } = await admin
    .from("listed_properties")
    .delete()
    .eq("created_by_name", "e2e")
    .select("id");
  console.log(`final listed_properties(created_by_name=e2e)=${props?.length ?? 0}`);
}

console.log(`done ok=${ok} fail=${fail}`);
