import { NextResponse } from "next/server";
import { requireAdminKey } from "@/lib/serverAuth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  if (!requireAdminKey(request)) {
    return NextResponse.json(
      { ok: false, message: "관리자 키가 올바르지 않습니다." },
      { status: 401 }
    );
  }

  try {
    const admin = createAdminClient();
    const [
      { count: profileCount },
      { count: workspaceCount },
      { data: profiles },
      { data: deletedAccounts },
      { data: workspaces },
      { count: customersActive },
      { count: customersDeleted },
      { count: propertiesActive },
      { count: propertiesDeleted },
      { count: schedulesActive },
      { count: schedulesDeleted },
      { data: auditLogs },
    ] = await Promise.all([
      admin.from("profiles").select("*", { count: "exact", head: true }),
      admin.from("workspaces").select("*", { count: "exact", head: true }),
      admin
        .from("profiles")
        .select("id, username, shop_name, display_name, phone, created_at")
        .order("created_at", { ascending: false })
        .limit(50),
      admin
        .from("deleted_accounts")
        .select(
          "username, former_user_id, shop_name, display_name, phone, deleted_at, data_snapshot"
        )
        .order("deleted_at", { ascending: false })
        .limit(50),
      admin
        .from("workspaces")
        .select("id, name, share_code, created_by, created_at")
        .order("created_at", { ascending: false })
        .limit(50),
      admin
        .from("customers")
        .select("*", { count: "exact", head: true })
        .is("deleted_at", null),
      admin
        .from("customers")
        .select("*", { count: "exact", head: true })
        .not("deleted_at", "is", null),
      admin
        .from("listed_properties")
        .select("*", { count: "exact", head: true })
        .is("deleted_at", null),
      admin
        .from("listed_properties")
        .select("*", { count: "exact", head: true })
        .not("deleted_at", "is", null),
      admin
        .from("schedules")
        .select("*", { count: "exact", head: true })
        .is("deleted_at", null),
      admin
        .from("schedules")
        .select("*", { count: "exact", head: true })
        .not("deleted_at", "is", null),
      admin
        .from("audit_logs")
        .select("id, action, entity_type, entity_id, actor_name, created_at, detail")
        .order("created_at", { ascending: false })
        .limit(40),
    ]);

    return NextResponse.json({
      ok: true,
      summary: {
        profiles: profileCount ?? 0,
        workspaces: workspaceCount ?? 0,
        customersActive: customersActive ?? 0,
        customersDeleted: customersDeleted ?? 0,
        propertiesActive: propertiesActive ?? 0,
        propertiesDeleted: propertiesDeleted ?? 0,
        schedulesActive: schedulesActive ?? 0,
        schedulesDeleted: schedulesDeleted ?? 0,
      },
      profiles: profiles ?? [],
      deletedAccounts: deletedAccounts ?? [],
      workspaces: workspaces ?? [],
      auditLogs: auditLogs ?? [],
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        message: e instanceof Error ? e.message : "관리자 조회 실패",
      },
      { status: 500 }
    );
  }
}
