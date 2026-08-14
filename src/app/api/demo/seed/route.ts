import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatPhoneInput } from "@/lib/format";
import { withApiErrorLog } from "@/lib/appErrorLog";
import {
  DEMO_CORE_IDS,
  DEMO_CREATOR_NAME,
  DEMO_SEED_VERSION,
  buildDemoSeedData,
  demoSeedBaseDate,
  isDemoSeedExpired,
  type DemoSeedActor,
} from "@/lib/demoSeedPayload";

async function relabelExistingDemoCreators(
  admin: ReturnType<typeof createAdminClient>,
  userId: string
) {
  const tables: Array<["customers" | "listed_properties" | "schedules", string]> =
    [
      ["customers", DEMO_CORE_IDS[0]],
      ["listed_properties", DEMO_CORE_IDS[1]],
      ["schedules", DEMO_CORE_IDS[2]],
    ];
  for (const [table, id] of tables) {
    await admin
      .from(table)
      .update({ created_by_name: DEMO_CREATOR_NAME })
      .eq("id", id);

    const { data: row } = await admin
      .from(table)
      .select("payload")
      .eq("user_id", userId)
      .eq("id", id)
      .maybeSingle();
    if (!row?.payload || typeof row.payload !== "object") continue;
    const payload = {
      ...(row.payload as Record<string, unknown>),
      createdByName: DEMO_CREATOR_NAME,
    };
    await admin
      .from(table)
      .update({
        created_by_name: DEMO_CREATOR_NAME,
        payload,
      })
      .eq("user_id", userId)
      .eq("id", id);
  }
}

async function expireDemoRows(
  admin: ReturnType<typeof createAdminClient>,
  userId: string
) {
  const now = new Date().toISOString();
  const tables: Array<["customers" | "listed_properties" | "schedules", string]> =
    [
      ["customers", DEMO_CORE_IDS[0]],
      ["listed_properties", DEMO_CORE_IDS[1]],
      ["schedules", DEMO_CORE_IDS[2]],
    ];
  for (const [table, id] of tables) {
    await admin
      .from(table)
      .update({
        deleted_at: now,
        deleted_by: userId,
        updated_at: now,
      })
      .eq("user_id", userId)
      .eq("id", id)
      .is("deleted_at", null);
  }
}

/**
 * 로그인 사용자에게 체험용 고객·매물·네비를 service_role로 심음.
 * 클라이언트 RLS/anon 토큰 문제를 우회한다.
 */
async function __POST_handler(request: Request) {
  try {
    const auth = request.headers.get("authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    if (!token) {
      return NextResponse.json(
        { ok: false, message: "로그인이 필요합니다." },
        { status: 401 }
      );
    }

    let admin;
    try {
      admin = createAdminClient();
    } catch {
      return NextResponse.json(
        { ok: false, message: "서버 설정이 없습니다." },
        { status: 503 }
      );
    }

    const { data: userData, error: userErr } =
      await admin.auth.getUser(token);
    if (userErr || !userData.user) {
      return NextResponse.json(
        { ok: false, message: "세션이 만료되었습니다. 다시 로그인해 주세요." },
        { status: 401 }
      );
    }

    const userId = userData.user.id;
    const body = (await request.json().catch(() => ({}))) as {
      forceMissing?: boolean;
      createdAt?: string | null;
    };

    const signupAt = userData.user.created_at ?? body.createdAt ?? null;
    if (isDemoSeedExpired(signupAt)) {
      await expireDemoRows(admin, userId);
      return NextResponse.json({
        ok: true,
        expired: true,
        skipped: true,
        reason: "expired",
      });
    }

    await relabelExistingDemoCreators(admin, userId);

    const { data: profile } = await admin
      .from("profiles")
      .select(
        "demo_seed_version, display_name, shop_name, phone, username"
      )
      .eq("id", userId)
      .maybeSingle();

    const currentVersion =
      (profile?.demo_seed_version as string | null | undefined) ?? null;

    if (
      currentVersion &&
      currentVersion.localeCompare(DEMO_SEED_VERSION) > 0
    ) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        relabeled: true,
        reason: "newer",
      });
    }

    let needSeed = currentVersion !== DEMO_SEED_VERSION;

    if (!needSeed && body.forceMissing !== false) {
      const [c, p, s] = await Promise.all([
        admin
          .from("customers")
          .select("id")
          .eq("user_id", userId)
          .eq("id", DEMO_CORE_IDS[0])
          .is("deleted_at", null)
          .maybeSingle(),
        admin
          .from("listed_properties")
          .select("id")
          .eq("user_id", userId)
          .eq("id", DEMO_CORE_IDS[1])
          .is("deleted_at", null)
          .maybeSingle(),
        admin
          .from("schedules")
          .select("id")
          .eq("user_id", userId)
          .eq("id", DEMO_CORE_IDS[2])
          .is("deleted_at", null)
          .maybeSingle(),
      ]);
      needSeed = !c.data || !p.data || !s.data;
    }

    if (!needSeed) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        relabeled: true,
        reason: "ok",
      });
    }

    const meta = (userData.user.user_metadata ?? {}) as Record<
      string,
      unknown
    >;
    const displayName =
      String(profile?.display_name ?? "").trim() ||
      String(meta.display_name ?? "").trim() ||
      String(profile?.username ?? "").trim() ||
      String(meta.username ?? "").trim() ||
      "회원";
    const shopName =
      String(profile?.shop_name ?? "").trim() ||
      String(meta.shop_name ?? "").trim() ||
      "현장동선";
    const phone =
      formatPhoneInput(String(profile?.phone ?? meta.phone ?? "")) || "";

    const actor: DemoSeedActor = {
      displayName,
      shopName,
      phone,
    };

    // 체험 일정은 오늘 기준으로 바로 보이게
    const { customers, properties, schedules } = buildDemoSeedData(
      demoSeedBaseDate(new Date()),
      actor
    );

    for (const c of customers) {
      const payload = {
        ...c,
        createdBy: userId,
        createdByName: DEMO_CREATOR_NAME,
        workspaceShared: false,
      };
      const rowBody: Record<string, unknown> = {
        id: c.id,
        user_id: userId,
        workspace_id: null,
        created_by: userId,
        created_by_name: DEMO_CREATOR_NAME,
        payload,
        created_at: c.createdAt,
        updated_at: new Date().toISOString(),
        deleted_at: null,
        deleted_by: null,
      };
      let { error } = await admin
        .from("customers")
        .upsert(
          { ...rowBody, workspace_shared: false },
          { onConflict: "user_id,id" }
        );
      if (
        error &&
        /workspace_shared|does not exist|schema cache/i.test(error.message)
      ) {
        ({ error } = await admin
          .from("customers")
          .upsert(rowBody, { onConflict: "user_id,id" }));
      }
      if (error) {
        return NextResponse.json(
          { ok: false, message: `고객 시드 실패: ${error.message}` },
          { status: 500 }
        );
      }
    }

    for (const p of properties) {
      const payload = {
        ...p,
        createdBy: userId,
        createdByName: DEMO_CREATOR_NAME,
        workspaceShared: false,
      };
      const rowBody: Record<string, unknown> = {
        id: p.id,
        user_id: userId,
        workspace_id: null,
        created_by: userId,
        created_by_name: DEMO_CREATOR_NAME,
        payload,
        created_at: p.createdAt,
        updated_at: new Date().toISOString(),
        deleted_at: null,
        deleted_by: null,
      };
      let { error } = await admin
        .from("listed_properties")
        .upsert(
          { ...rowBody, workspace_shared: false },
          { onConflict: "user_id,id" }
        );
      if (
        error &&
        /workspace_shared|does not exist|schema cache/i.test(error.message)
      ) {
        ({ error } = await admin
          .from("listed_properties")
          .upsert(rowBody, { onConflict: "user_id,id" }));
      }
      if (error) {
        return NextResponse.json(
          { ok: false, message: `매물 시드 실패: ${error.message}` },
          { status: 500 }
        );
      }
    }

    for (const s of schedules) {
      const payload = {
        ...s,
        createdBy: userId,
        createdByName: DEMO_CREATOR_NAME,
        workspaceShared: false,
      };
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
          updated_at: new Date().toISOString(),
          deleted_at: null,
          deleted_by: null,
        },
        { onConflict: "user_id,id" }
      );
      if (error) {
        return NextResponse.json(
          { ok: false, message: `일정 시드 실패: ${error.message}` },
          { status: 500 }
        );
      }
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
    ).filter((id) => id !== "demo_cust_1");
    ids.unshift("demo_cust_1");
    await admin
      .from("profiles")
      .update({ recent_customer_ids: ids.slice(0, 20) })
      .eq("id", userId);

    return NextResponse.json({
      ok: true,
      seeded: true,
      relabeled: true,
      version: DEMO_SEED_VERSION,
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "시드 중 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

export const POST = withApiErrorLog(__POST_handler);
