import { NextResponse } from "next/server";
import {
  generateShareCode,
  getAuthUserFromToken,
  getBearerToken,
} from "@/lib/serverAuth";
import { withApiErrorLog } from "@/lib/appErrorLog";
import {
  buildWorkspaceInfo,
  dissolveSoloPendingWorkspace,
  getMembership,
  listWorkspaceMembers,
  migrateUserDataToWorkspace,
  shareCodeExpiryIso,
  writeAuditLog,
} from "@/lib/workspaceServer";

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

    const existing = await getMembership(auth.admin, auth.user.id);
    if (existing) {
      const members = await listWorkspaceMembers(
        auth.admin,
        existing.workspaceId
      );
      // 만료된 혼자 초대 공간은 지우고 새로 생성
      if (members.length < 2 && !existing.shareCodeValid) {
        await dissolveSoloPendingWorkspace(auth.admin, auth.user.id);
      } else {
        return NextResponse.json(
          { ok: false, message: "이미 팀 공유에 참여 중입니다." },
          { status: 400 }
        );
      }
    }

    const { data: profile } = await auth.admin
      .from("profiles")
      .select("shop_name, display_name")
      .eq("id", auth.user.id)
      .maybeSingle();

    const displayName = String(
      profile?.display_name ||
        auth.user.user_metadata?.display_name ||
        auth.user.user_metadata?.username ||
        "회원"
    );
    const workspaceName =
      (body.name ?? "").trim() ||
      String(profile?.shop_name || "").trim() ||
      `${displayName} 팀`;

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
    const { data: ws, error: wsError } = await auth.admin
      .from("workspaces")
      .insert({
        name: workspaceName,
        share_code: shareCode,
        share_code_expires_at: expiresAt,
        created_by: auth.user.id,
      })
      .select("id")
      .single();

    if (wsError || !ws) {
      const raw = wsError?.message ?? "";
      const needsMigration =
        /workspaces|schema cache|does not exist|PGRST205/i.test(raw);
      return NextResponse.json(
        {
          ok: false,
          message: needsMigration
            ? "팀 공유용 DB가 아직 없습니다. Supabase SQL Editor에서 005_workspaces.sql 과 006_share_code_expiry.sql 을 실행해 주세요."
            : `팀 공유 생성에 실패했습니다. ${raw}`.trim(),
        },
        { status: 500 }
      );
    }

    const { error: memberError } = await auth.admin
      .from("workspace_members")
      .insert({
        workspace_id: ws.id,
        user_id: auth.user.id,
        role: "owner",
        display_name: displayName,
      });

    if (memberError) {
      await auth.admin.from("workspaces").delete().eq("id", ws.id);
      return NextResponse.json(
        { ok: false, message: `멤버 등록에 실패했습니다. ${memberError.message}` },
        { status: 500 }
      );
    }

    await migrateUserDataToWorkspace(auth.admin, auth.user.id, ws.id);
    await writeAuditLog(auth.admin, {
      workspaceId: ws.id,
      actorUserId: auth.user.id,
      actorName: displayName,
      action: "workspace_create",
      entityType: "workspace",
      entityId: ws.id,
      detail: { shareCode },
    });

    const workspace = await buildWorkspaceInfo(auth.admin, auth.user.id);
    return NextResponse.json({ ok: true, workspace });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        message: e instanceof Error ? e.message : "팀 공유 생성에 실패했습니다.",
      },
      { status: 500 }
    );
  }
}

export const POST = withApiErrorLog(__POST_handler);
