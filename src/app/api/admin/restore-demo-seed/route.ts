import { NextResponse } from "next/server";
import { requireAdminSession, requireSuper } from "@/lib/adminAuth";
import { restoreDemoSeedForPersonalAccounts } from "@/lib/adminDemoRestore";
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
    const result = await restoreDemoSeedForPersonalAccounts(auth.admin);

    await writeAdminAudit(auth.admin, auth.session, {
      action: "admin_restore_demo_seed",
      entityType: "demo_seed",
      detail: {
        ok: result.ok,
        fail: result.fail,
        restored: result.restored,
      },
    });

    return NextResponse.json({
      ok: true,
      restoredCount: result.ok,
      fail: result.fail,
      restored: result.restored,
      failed: result.failed,
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        message: e instanceof Error ? e.message : "복구 실패",
      },
      { status: 500 }
    );
  }
}

export const POST = withApiErrorLog(__POST_handler);
