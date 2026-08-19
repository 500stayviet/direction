import type { SupabaseClient } from "@supabase/supabase-js";
import { formatPhoneInput } from "@/lib/format";
import {
  DEMO_CORE_IDS,
  DEMO_CREATOR_NAME,
  DEMO_CUSTOMER_NAME,
  DEMO_SCHEDULE_TITLE,
  DEMO_SEED_VERSION,
  buildDemoSeedData,
  demoSeedBaseDate,
  type DemoSeedActor,
} from "@/lib/demoSeedPayload";
import { isE2eAuthUser } from "@/lib/e2eUserDetect";

function withDemoDisplayNames(
  table: "customers" | "listed_properties" | "schedules",
  payload: Record<string, unknown>
): Record<string, unknown> {
  const next: Record<string, unknown> = {
    ...payload,
    createdByName: DEMO_CREATOR_NAME,
  };
  if (table === "customers") {
    const name = String(next.name ?? "").trim();
    if (!name || name === "테스트") next.name = DEMO_CUSTOMER_NAME;
  }
  if (table === "schedules") {
    const title = String(next.title ?? "").trim();
    if (!title || title === "테스트 고객 방문") {
      next.title = DEMO_SCHEDULE_TITLE;
    }
  }
  return next;
}

async function upsertDemoForUser(
  admin: SupabaseClient,
  userId: string,
  actor: DemoSeedActor
): Promise<void> {
  const restoredAt = new Date().toISOString();
  const { customers, properties, schedules } = buildDemoSeedData(
    demoSeedBaseDate(new Date()),
    actor
  );

  for (const c of customers) {
    const payload = withDemoDisplayNames("customers", {
      ...c,
      createdBy: userId,
      workspaceShared: false,
    });
    const rowBody = {
      id: c.id,
      user_id: userId,
      workspace_id: null,
      created_by: userId,
      created_by_name: DEMO_CREATOR_NAME,
      payload,
      created_at: c.createdAt,
      updated_at: restoredAt,
      deleted_at: null,
      deleted_by: null,
      workspace_shared: false,
    };
    let { error } = await admin
      .from("customers")
      .upsert(rowBody, { onConflict: "user_id,id" });
    if (
      error &&
      /workspace_shared|does not exist|schema cache/i.test(error.message)
    ) {
      const { workspace_shared: _ws, ...withoutWs } = rowBody;
      ({ error } = await admin
        .from("customers")
        .upsert(withoutWs, { onConflict: "user_id,id" }));
    }
    if (error) throw new Error(`customers: ${error.message}`);
  }

  for (const p of properties) {
    const payload = withDemoDisplayNames("listed_properties", {
      ...p,
      createdBy: userId,
      workspaceShared: false,
    });
    const rowBody = {
      id: p.id,
      user_id: userId,
      workspace_id: null,
      created_by: userId,
      created_by_name: DEMO_CREATOR_NAME,
      payload,
      created_at: p.createdAt,
      updated_at: restoredAt,
      deleted_at: null,
      deleted_by: null,
      workspace_shared: false,
    };
    let { error } = await admin
      .from("listed_properties")
      .upsert(rowBody, { onConflict: "user_id,id" });
    if (
      error &&
      /workspace_shared|does not exist|schema cache/i.test(error.message)
    ) {
      const { workspace_shared: _ws, ...withoutWs } = rowBody;
      ({ error } = await admin
        .from("listed_properties")
        .upsert(withoutWs, { onConflict: "user_id,id" }));
    }
    if (error) throw new Error(`listed_properties: ${error.message}`);
  }

  for (const s of schedules) {
    const payload = withDemoDisplayNames("schedules", {
      ...s,
      createdBy: userId,
      workspaceShared: false,
    });
    const { error } = await admin.from("schedules").upsert(
      {
        id: s.id,
        user_id: userId,
        workspace_id: null,
        created_by: userId,
        created_by_name: DEMO_CREATOR_NAME,
        workspace_shared: false,
        payload,
        created_at: s.createdAt,
        updated_at: restoredAt,
        deleted_at: null,
        deleted_by: null,
      },
      { onConflict: "user_id,id" }
    );
    if (error) throw new Error(`schedules: ${error.message}`);
  }

  await admin
    .from("profiles")
    .update({ demo_seed_version: DEMO_SEED_VERSION })
    .eq("id", userId);

  const { data: recent } = await admin
    .from("profiles")
    .select("recent_customer_ids")
    .eq("id", userId)
    .maybeSingle();
  const ids = (
    (recent?.recent_customer_ids as string[] | null) ?? []
  ).filter((id) => id !== DEMO_CORE_IDS[0]);
  ids.unshift(DEMO_CORE_IDS[0]);
  await admin
    .from("profiles")
    .update({ recent_customer_ids: ids.slice(0, 20) })
    .eq("id", userId);
}

export type AdminDemoRestoreResult = {
  ok: number;
  fail: number;
  restored: string[];
  failed: Array<{ username: string; message: string }>;
};

/** 개인(비 e2e) 계정 체험 demo만 복구 — 기존 개인 고객·매물·네비는 건드리지 않음 */
export async function restoreDemoSeedForPersonalAccounts(
  admin: SupabaseClient
): Promise<AdminDemoRestoreResult> {
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

  const targets = users.filter((u) => !isE2eAuthUser(u));
  const restoredAt = new Date().toISOString();
  const restored: string[] = [];
  const failed: Array<{ username: string; message: string }> = [];

  for (const u of targets) {
    const username =
      String(u.user_metadata?.username ?? "").trim() ||
      String(u.email ?? "").split("@")[0];
    try {
      const { data: profile } = await admin
        .from("profiles")
        .select("display_name, shop_name, phone, username")
        .eq("id", u.id)
        .maybeSingle();
      const meta = u.user_metadata ?? {};
      const actor: DemoSeedActor = {
        displayName:
          String(profile?.display_name ?? "").trim() ||
          String(meta.display_name ?? "").trim() ||
          username ||
          "회원",
        shopName:
          String(profile?.shop_name ?? "").trim() ||
          String(meta.shop_name ?? "").trim() ||
          "현장동선",
        phone:
          formatPhoneInput(String(profile?.phone ?? meta.phone ?? "")) || "",
      };

      await upsertDemoForUser(admin, u.id, actor);

      const { error: metaErr } = await admin.auth.admin.updateUserById(u.id, {
        user_metadata: {
          ...meta,
          demo_restored_at: restoredAt,
        },
      });
      if (metaErr) throw metaErr;

      restored.push(username);
    } catch (e) {
      failed.push({
        username,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return {
    ok: restored.length,
    fail: failed.length,
    restored,
    failed,
  };
}
