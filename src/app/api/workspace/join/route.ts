import { NextResponse } from "next/server";
import { getAuthUserFromToken, getBearerToken } from "@/lib/serverAuth";
import { withApiErrorLog } from "@/lib/appErrorLog";
import {
  buildWorkspaceInfo,
  dissolveSoloPendingWorkspace,
  getMembership,
  migrateUserDataToWorkspace,
  writeAuditLog,
} from "@/lib/workspaceServer";

async function __POST_handler(request: Request) {
  try {
    const body = (await request.json()) as {
      shareCode?: string;
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

    const code = (body.shareCode ?? "").trim().toUpperCase();
    if (code.length < 4) {
      return NextResponse.json(
        { ok: false, message: "공유 코드를 입력해 주세요." },
        { status: 400 }
      );
    }

    const existing = await getMembership(auth.admin, auth.user.id);
    if (existing) {
      if (existing.shareCode && existing.shareCode.toUpperCase() === code) {
        return NextResponse.json(
          {
            ok: false,
            message: "본인이 만든 공유 코드로는 참여할 수 없습니다.",
          },
          { status: 400 }
        );
      }
      // 동료 없는 초대용 공간만 해제 후 참여 (2명 이상이면 이미 팀)
      const dissolved = await dissolveSoloPendingWorkspace(
        auth.admin,
        auth.user.id
      );
      if (!dissolved.ok) {
        return NextResponse.json(
          { ok: false, message: dissolved.message },
          { status: 400 }
        );
      }
    }

    const { data: ws } = await auth.admin
      .from("workspaces")
      .select("id, name, share_code, share_code_expires_at")
      .eq("share_code", code)
      .maybeSingle();

    if (!ws) {
      return NextResponse.json(
        { ok: false, message: "유효하지 않은 공유 코드입니다." },
        { status: 404 }
      );
    }

    const expiresAt = ws.share_code_expires_at
      ? Date.parse(String(ws.share_code_expires_at))
      : 0;
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      return NextResponse.json(
        {
          ok: false,
          message: "만료된 공유 코드입니다. 새 코드를 받아 다시 시도해 주세요.",
        },
        { status: 400 }
      );
    }

    const { data: profile } = await auth.admin
      .from("profiles")
      .select("display_name, username")
      .eq("id", auth.user.id)
      .maybeSingle();

    const displayName = String(
      profile?.display_name ||
        profile?.username ||
        auth.user.user_metadata?.display_name ||
        "회원"
    );

    const { error: memberError } = await auth.admin
      .from("workspace_members")
      .insert({
        workspace_id: ws.id,
        user_id: auth.user.id,
        role: "member",
        display_name: displayName,
      });

    if (memberError) {
      return NextResponse.json(
        { ok: false, message: `팀 참여에 실패했습니다. ${memberError.message}` },
        { status: 500 }
      );
    }

    await migrateUserDataToWorkspace(auth.admin, auth.user.id, ws.id as string);
    await writeAuditLog(auth.admin, {
      workspaceId: ws.id as string,
      actorUserId: auth.user.id,
      actorName: displayName,
      action: "workspace_join",
      entityType: "workspace",
      entityId: ws.id as string,
      detail: { shareCode: code },
    });

    const workspace = await buildWorkspaceInfo(auth.admin, auth.user.id);
    return NextResponse.json({ ok: true, workspace });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        message: e instanceof Error ? e.message : "팀 참여에 실패했습니다.",
      },
      { status: 500 }
    );
  }
}

export const POST = withApiErrorLog(__POST_handler);
