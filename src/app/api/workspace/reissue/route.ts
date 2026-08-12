import { NextResponse } from "next/server";
import {
  generateShareCode,
  getAuthUserFromToken,
  getBearerToken,
} from "@/lib/serverAuth";
import {
import { withApiErrorLog } from "@/lib/appErrorLog";
  buildWorkspaceInfo,
  getMembership,
  shareCodeExpiryIso,
  writeAuditLog,
} from "@/lib/workspaceServer";

async function __POST_handler(request: Request) {
  try {
    const body = (await request.json()) as { accessToken?: string };
    const token = getBearerToken(request) || (body.accessToken ?? "");
    const auth = await getAuthUserFromToken(token);
    if (!auth) {
      return NextResponse.json(
        { ok: false, message: "로그인이 필요합니다." },
        { status: 401 }
      );
    }

    const membership = await getMembership(auth.admin, auth.user.id);
    if (!membership) {
      return NextResponse.json(
        { ok: false, message: "참여 중인 팀이 없습니다." },
        { status: 400 }
      );
    }
    if (membership.role !== "owner") {
      return NextResponse.json(
        { ok: false, message: "코드 재발급은 생성한 사람만 할 수 있습니다." },
        { status: 403 }
      );
    }

    let shareCode = generateShareCode();
    for (let i = 0; i < 5; i++) {
      const { data: clash } = await auth.admin
        .from("workspaces")
        .select("id")
        .eq("share_code", shareCode)
        .maybeSingle();
      if (!clash) break;
      shareCode = generateShareCode();
    }

    const expiresAt = shareCodeExpiryIso();
    const { error } = await auth.admin
      .from("workspaces")
      .update({
        share_code: shareCode,
        share_code_expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", membership.workspaceId);

    if (error) {
      return NextResponse.json(
        { ok: false, message: `코드 재발급에 실패했습니다. ${error.message}` },
        { status: 500 }
      );
    }

    await writeAuditLog(auth.admin, {
      workspaceId: membership.workspaceId,
      actorUserId: auth.user.id,
      actorName: membership.displayName,
      action: "share_code_reissue",
      entityType: "workspace",
      entityId: membership.workspaceId,
      detail: { shareCode, expiresAt },
    });

    const workspace = await buildWorkspaceInfo(auth.admin, auth.user.id);
    return NextResponse.json({ ok: true, workspace });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        message: e instanceof Error ? e.message : "코드 재발급에 실패했습니다.",
      },
      { status: 500 }
    );
  }
}

export const POST = withApiErrorLog(__POST_handler);
