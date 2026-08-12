import { NextResponse } from "next/server";
import {
  requireAdminSession,
  requireSuper,
} from "@/lib/adminAuth";
import { writeAdminAudit } from "@/lib/adminAudit";
import { withApiErrorLog } from "@/lib/appErrorLog";

type Params = { params: Promise<{ id: string }> };

/** 슈퍼: 관리자 계정 비활성/재활성 */
async function __PATCH_handler(request: Request, { params }: Params) {
  const auth = await requireAdminSession(request);
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, message: auth.message },
      { status: auth.status }
    );
  }
  const superOk = requireSuper(auth.session);
  if (!superOk.ok) {
    return NextResponse.json(
      { ok: false, message: superOk.message },
      { status: superOk.status }
    );
  }

  const { id } = await params;
  const adminId = (id ?? "").trim();
  if (!adminId) {
    return NextResponse.json(
      { ok: false, message: "관리자 id가 필요합니다." },
      { status: 400 }
    );
  }

  if (adminId === auth.session.id) {
    return NextResponse.json(
      { ok: false, message: "본인 계정은 비활성화할 수 없습니다." },
      { status: 400 }
    );
  }

  try {
    const body = (await request.json()) as { active?: boolean };
    const active = body.active === true;

    const { data: target, error: getErr } = await auth.admin
      .from("admin_users")
      .select("id, username, role, active")
      .eq("id", adminId)
      .maybeSingle();

    if (getErr || !target) {
      return NextResponse.json(
        { ok: false, message: getErr?.message ?? "계정을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    if (!active && target.role === "super") {
      const { count } = await auth.admin
        .from("admin_users")
        .select("*", { count: "exact", head: true })
        .eq("role", "super")
        .eq("active", true);
      if ((count ?? 0) <= 1) {
        return NextResponse.json(
          { ok: false, message: "마지막 활성 슈퍼관리자는 비활성화할 수 없습니다." },
          { status: 400 }
        );
      }
    }

    const { data, error } = await auth.admin
      .from("admin_users")
      .update({ active, updated_at: new Date().toISOString() })
      .eq("id", adminId)
      .select("id, username, display_name, title, role, active, created_at")
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json(
        { ok: false, message: error?.message ?? "변경 실패" },
        { status: 500 }
      );
    }

    await writeAdminAudit(auth.admin, auth.session, {
      action: active ? "admin_staff_activate" : "admin_staff_deactivate",
      entityType: "admin_user",
      entityId: adminId,
      detail: { username: target.username, role: target.role },
    });

    return NextResponse.json({ ok: true, staff: data });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        message: e instanceof Error ? e.message : "변경 실패",
      },
      { status: 500 }
    );
  }
}

export const PATCH = withApiErrorLog(__PATCH_handler);
