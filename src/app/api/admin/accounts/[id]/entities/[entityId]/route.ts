import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/adminAuth";
import {
  buildAdminCustomerDetail,
  buildAdminPropertyDetail,
  buildAdminScheduleDetail,
} from "@/lib/adminEntityDetail";

type Params = { params: Promise<{ id: string; entityId: string }> };

const TABLES = {
  customers: "customers",
  properties: "listed_properties",
  schedules: "schedules",
} as const;

/** 계정 자료 한 건 상세 — 리스트는 마스킹, 원문은 슈퍼만 */
export async function GET(request: Request, { params }: Params) {
  const auth = await requireAdminSession(request);
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, message: auth.message },
      { status: auth.status }
    );
  }

  const { id, entityId } = await params;
  const userId = (id ?? "").trim();
  const rowId = (entityId ?? "").trim();
  const url = new URL(request.url);
  const type = (url.searchParams.get("type") ??
    "customers") as keyof typeof TABLES;
  const table = TABLES[type];

  if (!userId || !rowId || !table) {
    return NextResponse.json(
      { ok: false, message: "type·계정·항목 id가 필요합니다." },
      { status: 400 }
    );
  }

  try {
    const { data: row, error } = await auth.admin
      .from(table)
      .select(
        "id, user_id, payload, deleted_at, workspace_shared, created_at, updated_at, created_by_name"
      )
      .eq("user_id", userId)
      .eq("id", rowId)
      .maybeSingle();

    if (error || !row) {
      return NextResponse.json(
        { ok: false, message: error?.message ?? "항목을 찾을 수 없습니다." },
        { status: error ? 500 : 404 }
      );
    }

    const canReveal = auth.session.role === "super";
    const p = (row.payload ?? {}) as Record<string, unknown>;
    const meta = {
      id: row.id,
      payload: p,
      canReveal,
      shared: Boolean(row.workspace_shared),
      deleted: Boolean(row.deleted_at),
      createdByName: String(row.created_by_name ?? ""),
      createdAt: row.created_at ? String(row.created_at) : undefined,
      updatedAt: row.updated_at ? String(row.updated_at) : undefined,
    };

    const item =
      type === "customers"
        ? buildAdminCustomerDetail(meta)
        : type === "properties"
          ? buildAdminPropertyDetail(meta)
          : buildAdminScheduleDetail(meta);

    const { data: profile } = await auth.admin
      .from("profiles")
      .select("id, username, shop_name, display_name, phone, created_at")
      .eq("id", userId)
      .maybeSingle();

    const owner = profile
      ? {
          id: String(profile.id),
          username: String(profile.username ?? ""),
          shopName: String(profile.shop_name ?? ""),
          name: String(profile.display_name ?? ""),
          phone: String(profile.phone ?? ""),
          createdAt: String(profile.created_at ?? ""),
        }
      : null;

    return NextResponse.json({
      ok: true,
      type,
      canReveal,
      item: { ...item, owner },
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        message: e instanceof Error ? e.message : "상세 조회 실패",
      },
      { status: 500 }
    );
  }
}
