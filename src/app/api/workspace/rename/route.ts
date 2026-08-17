import { NextResponse } from "next/server";
import { getAuthUserFromToken, getBearerToken } from "@/lib/serverAuth";
import { withApiErrorLog } from "@/lib/appErrorLog";
import {
  buildWorkspaceInfo,
  getMembership,
  writeAuditLog,
} from "@/lib/workspaceServer";
import { normalizeWorkspaceName } from "@/lib/workspaceName";

async function __POST_handler(request: Request) {
  try {
    const body = (await request.json()) as {
      name?: string;
      accessToken?: string;
    };
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

    const name = normalizeWorkspaceName(body.name ?? "");
    if (!name) {
      return NextResponse.json(
        { ok: false, message: "팀이름을 입력해 주세요." },
        { status: 400 }
      );
    }

    const { error } = await auth.admin
      .from("workspaces")
      .update({
        name,
        updated_at: new Date().toISOString(),
      })
      .eq("id", membership.workspaceId);

    if (error) {
      return NextResponse.json(
        { ok: false, message: `팀이름 변경에 실패했습니다. ${error.message}` },
        { status: 500 }
      );
    }

    await writeAuditLog(auth.admin, {
      workspaceId: membership.workspaceId,
      actorUserId: auth.user.id,
      actorName: membership.displayName,
      action: "workspace_rename",
      entityType: "workspace",
      entityId: membership.workspaceId,
      detail: { name },
    });

    const workspace = await buildWorkspaceInfo(auth.admin, auth.user.id);
    return NextResponse.json({ ok: true, workspace });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        message: e instanceof Error ? e.message : "팀이름 변경에 실패했습니다.",
      },
      { status: 500 }
    );
  }
}

export const POST = withApiErrorLog(__POST_handler);
