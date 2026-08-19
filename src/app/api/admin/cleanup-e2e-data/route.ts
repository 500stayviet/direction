import { NextResponse } from "next/server";
import { requireAdminSession, requireSuper } from "@/lib/adminAuth";
import { cleanupE2eTestData } from "@/lib/adminE2eCleanup";
import { withApiErrorLog } from "@/lib/appErrorLog";
import { writeAdminAudit } from "@/lib/adminAudit";

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
    const result = await cleanupE2eTestData(auth.admin);

    await writeAdminAudit(auth.admin, auth.session, {
      action: "admin_cleanup_e2e_data",
      entityType: "e2e_test_data",
      detail: result,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        message: e instanceof Error ? e.message : "정리 실패",
      },
      { status: 500 }
    );
  }
}

export const POST = withApiErrorLog(__POST_handler);
