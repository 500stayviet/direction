import { NextResponse } from "next/server";
import {
  requireAdminSession,
  requireSuper,
} from "@/lib/adminAuth";
import { writeAdminAudit } from "@/lib/adminAudit";
import { withApiErrorLog } from "@/lib/appErrorLog";

async function __POST_handler(request: Request) {
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
    const body = (await request.json()) as { ids?: string[] };
    const ids = (body.ids ?? []).filter((id) => typeof id === "string" && id);
    if (ids.length === 0) {
      return NextResponse.json(
        { ok: false, message: "ids가 필요합니다." },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const { error } = await auth.admin
      .from("intake_parse_samples")
      .update({ status: "reviewed", reviewed_at: now })
      .in("id", ids);

    if (error) {
      return NextResponse.json(
        { ok: false, message: error.message },
        { status: 500 }
      );
    }

    await writeAdminAudit(auth.admin, auth.session, {
      action: "admin_intake_samples_reviewed",
      entityType: "intake_parse_samples",
      detail: { count: ids.length },
    });

    return NextResponse.json({ ok: true, count: ids.length });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        message: e instanceof Error ? e.message : "상태 변경 실패",
      },
      { status: 500 }
    );
  }
}

export const POST = withApiErrorLog(__POST_handler);
