import { NextResponse } from "next/server";
import { requireAdminSession, requireSuper } from "@/lib/adminAuth";
import { withApiErrorLog } from "@/lib/appErrorLog";
import { writeAdminAudit } from "@/lib/adminAudit";

async function __DELETE_handler(request: Request) {
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

  try {
    const { count } = await auth.admin
      .from("intake_parse_samples")
      .select("*", { count: "exact", head: true });

    const { error } = await auth.admin
      .from("intake_parse_samples")
      .delete()
      .gte("created_at", "1970-01-01T00:00:00Z");

    if (error) {
      return NextResponse.json(
        { ok: false, message: error.message },
        { status: 500 }
      );
    }

    await writeAdminAudit(auth.admin, auth.session, {
      action: "admin_intake_samples_clear",
      entityType: "intake_parse_samples",
      detail: { count: count ?? 0 },
    });

    return NextResponse.json({ ok: true, count: count ?? 0 });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        message: e instanceof Error ? e.message : "삭제 실패",
      },
      { status: 500 }
    );
  }
}

export const DELETE = withApiErrorLog(__DELETE_handler);

