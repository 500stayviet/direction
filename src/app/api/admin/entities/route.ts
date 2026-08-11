import { NextResponse } from "next/server";
import { requireAdminKey } from "@/lib/serverAuth";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/workspaceServer";

const TABLES = {
  customers: "customers",
  properties: "listed_properties",
  schedules: "schedules",
} as const;

export async function GET(request: Request) {
  if (!requireAdminKey(request)) {
    return NextResponse.json(
      { ok: false, message: "관리자 키가 올바르지 않습니다." },
      { status: 401 }
    );
  }

  const url = new URL(request.url);
  const type = (url.searchParams.get("type") ?? "customers") as keyof typeof TABLES;
  const deletedOnly = url.searchParams.get("deleted") === "1";
  const table = TABLES[type] ?? TABLES.customers;

  try {
    const admin = createAdminClient();
    let query = admin
      .from(table)
      .select(
        "id, user_id, workspace_id, created_by_name, deleted_at, deleted_by, created_at, updated_at, payload" +
          (table === "schedules" ? ", workspace_shared" : "")
      )
      .order("updated_at", { ascending: false })
      .limit(100);

    query = deletedOnly
      ? query.not("deleted_at", "is", null)
      : query.is("deleted_at", null);

    const { data, error } = await query;
    if (error) {
      return NextResponse.json(
        { ok: false, message: error.message },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: true, rows: data ?? [] });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        message: e instanceof Error ? e.message : "목록 조회 실패",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  if (!requireAdminKey(request)) {
    return NextResponse.json(
      { ok: false, message: "관리자 키가 올바르지 않습니다." },
      { status: 401 }
    );
  }

  try {
    const body = (await request.json()) as {
      type?: keyof typeof TABLES;
      id?: string;
      userId?: string;
    };
    const type = body.type ?? "customers";
    const table = TABLES[type];
    const id = (body.id ?? "").trim();
    const userId = (body.userId ?? "").trim();
    if (!table || !id || !userId) {
      return NextResponse.json(
        { ok: false, message: "type, id, userId 가 필요합니다." },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const { data: row } = await admin
      .from(table)
      .select("id, workspace_id, deleted_at")
      .eq("user_id", userId)
      .eq("id", id)
      .maybeSingle();

    if (!row) {
      return NextResponse.json(
        { ok: false, message: "대상을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const { error } = await admin
      .from(table)
      .update({
        deleted_at: null,
        deleted_by: null,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("id", id);

    if (error) {
      return NextResponse.json(
        { ok: false, message: error.message },
        { status: 500 }
      );
    }

    await writeAuditLog(admin, {
      workspaceId: (row.workspace_id as string | null) ?? null,
      actorName: "admin",
      action: "restore",
      entityType: type,
      entityId: id,
      detail: { userId },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        message: e instanceof Error ? e.message : "복원 실패",
      },
      { status: 500 }
    );
  }
}
