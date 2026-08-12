import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/adminAuth";
import { DEMO_ENTITY_ID_LIKE } from "@/lib/demoSeedPayload";
import { withApiErrorLog } from "@/lib/appErrorLog";

/** Asia/Seoul 기준 오늘 0시 (UTC ISO) */
function startOfTodayKstIso(): string {
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return new Date(`${day}T00:00:00+09:00`).toISOString();
}

async function __GET_handler(request: Request) {
  const auth = await requireAdminSession(request);
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, message: auth.message },
      { status: auth.status }
    );
  }

  try {
    const sinceIso = startOfTodayKstIso();

    const [
      { count: profileCount },
      { count: workspaceCount },
      { count: customersActive },
      { count: customersDeleted },
      { count: propertiesActive },
      { count: propertiesDeleted },
      { count: schedulesActive },
      { count: schedulesDeleted },
      { count: deletedAccountCount },
      { count: todaySignups },
      { count: todayVisitors },
    ] = await Promise.all([
      auth.admin.from("profiles").select("*", { count: "exact", head: true }),
      auth.admin.from("workspaces").select("*", { count: "exact", head: true }),
      auth.admin
        .from("customers")
        .select("*", { count: "exact", head: true })
        .is("deleted_at", null)
        .not("id", "like", DEMO_ENTITY_ID_LIKE),
      auth.admin
        .from("customers")
        .select("*", { count: "exact", head: true })
        .not("deleted_at", "is", null)
        .not("id", "like", DEMO_ENTITY_ID_LIKE),
      auth.admin
        .from("listed_properties")
        .select("*", { count: "exact", head: true })
        .is("deleted_at", null)
        .not("id", "like", DEMO_ENTITY_ID_LIKE),
      auth.admin
        .from("listed_properties")
        .select("*", { count: "exact", head: true })
        .not("deleted_at", "is", null)
        .not("id", "like", DEMO_ENTITY_ID_LIKE),
      auth.admin
        .from("schedules")
        .select("*", { count: "exact", head: true })
        .is("deleted_at", null)
        .not("id", "like", DEMO_ENTITY_ID_LIKE),
      auth.admin
        .from("schedules")
        .select("*", { count: "exact", head: true })
        .not("deleted_at", "is", null)
        .not("id", "like", DEMO_ENTITY_ID_LIKE),
      auth.admin
        .from("deleted_accounts")
        .select("*", { count: "exact", head: true }),
      auth.admin
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .gte("created_at", sinceIso),
      auth.admin
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .gte("last_seen_at", sinceIso),
    ]);

    return NextResponse.json({
      ok: true,
      session: auth.session,
      summary: {
        profiles: profileCount ?? 0,
        workspaces: workspaceCount ?? 0,
        customersActive: customersActive ?? 0,
        customersDeleted: customersDeleted ?? 0,
        propertiesActive: propertiesActive ?? 0,
        propertiesDeleted: propertiesDeleted ?? 0,
        schedulesActive: schedulesActive ?? 0,
        schedulesDeleted: schedulesDeleted ?? 0,
        deletedAccounts: deletedAccountCount ?? 0,
        todayVisitors: todayVisitors ?? 0,
        todaySignups: todaySignups ?? 0,
      },
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

export const GET = withApiErrorLog(__GET_handler);
