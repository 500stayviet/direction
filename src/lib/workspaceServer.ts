import type { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

export async function writeAuditLog(
  admin: Admin,
  input: {
    workspaceId?: string | null;
    actorUserId?: string | null;
    actorName?: string;
    action: string;
    entityType: string;
    entityId?: string;
    detail?: Record<string, unknown>;
  }
) {
  try {
    await admin.from("audit_logs").insert({
      workspace_id: input.workspaceId ?? null,
      actor_user_id: input.actorUserId ?? null,
      actor_name: input.actorName ?? "",
      action: input.action,
      entity_type: input.entityType,
      entity_id: input.entityId ?? "",
      detail: input.detail ?? {},
    });
  } catch {
    /* audit failure must not block main flow */
  }
}

export async function getMembership(
  admin: Admin,
  userId: string
): Promise<{
  workspaceId: string;
  role: "owner" | "member";
  displayName: string;
  shareCode: string;
  shareCodeExpiresAt: string | null;
  shareCodeValid: boolean;
  workspaceName: string;
} | null> {
  const { data: member } = await admin
    .from("workspace_members")
    .select("workspace_id, role, display_name")
    .eq("user_id", userId)
    .maybeSingle();

  if (!member?.workspace_id) return null;

  const { data: ws } = await admin
    .from("workspaces")
    .select("id, name, share_code, share_code_expires_at")
    .eq("id", member.workspace_id)
    .maybeSingle();

  if (!ws) return null;

  const expiresAt = (ws.share_code_expires_at as string | null) ?? null;
  const shareCodeValid = Boolean(
    expiresAt && Date.parse(expiresAt) > Date.now()
  );

  return {
    workspaceId: ws.id as string,
    role: member.role === "owner" ? "owner" : "member",
    displayName: String(member.display_name ?? ""),
    shareCode: String(ws.share_code ?? ""),
    shareCodeExpiresAt: expiresAt,
    shareCodeValid,
    workspaceName: String(ws.name ?? ""),
  };
}

export const SHARE_CODE_TTL_MS = 5 * 60 * 1000;

export function shareCodeExpiryIso(from = Date.now()): string {
  return new Date(from + SHARE_CODE_TTL_MS).toISOString();
}

export async function unlinkDemoFromWorkspace(admin: Admin, userId: string) {
  const tables = ["customers", "listed_properties", "schedules"] as const;
  for (const table of tables) {
    await admin
      .from(table)
      .update({ workspace_id: null, workspace_shared: false })
      .eq("user_id", userId)
      .like("id", "demo_%");
  }
}

export async function migrateUserDataToWorkspace(
  admin: Admin,
  userId: string,
  workspaceId: string
) {
  await unlinkDemoFromWorkspace(admin, userId);

  const tables = ["customers", "listed_properties", "schedules"] as const;
  for (const table of tables) {
    // 실데이터만 팀 공간에 workspace_id 연결 (공유 플래그는 끄고 시작 — 항목별 공유)
    const { data: rows } = await admin
      .from(table)
      .select("id")
      .eq("user_id", userId)
      .is("workspace_id", null)
      .is("deleted_at", null);

    const ids = (rows ?? [])
      .map((r) => String(r.id))
      .filter((id) => !id.startsWith("demo_"));

    if (ids.length === 0) continue;

    await admin
      .from(table)
      .update({ workspace_id: workspaceId, workspace_shared: false })
      .eq("user_id", userId)
      .in("id", ids);
  }
}

export type WorkspaceMemberInfo = {
  userId: string;
  role: "owner" | "member";
  shopName: string;
  name: string;
  username: string;
  phone: string;
};

export async function listWorkspaceMembers(
  admin: Admin,
  workspaceId: string
): Promise<WorkspaceMemberInfo[]> {
  const { data: members } = await admin
    .from("workspace_members")
    .select("user_id, role, display_name, joined_at")
    .eq("workspace_id", workspaceId)
    .order("joined_at", { ascending: true });

  if (!members?.length) return [];

  const userIds = members.map((m) => String(m.user_id));
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, username, shop_name, display_name, phone")
    .in("id", userIds);

  const profileMap = new Map(
    (profiles ?? []).map((p) => [String(p.id), p] as const)
  );

  return members.map((m) => {
    const profile = profileMap.get(String(m.user_id));
    const username = String(profile?.username ?? "");
    const name = String(
      profile?.display_name || m.display_name || username || "회원"
    ).trim();
    const shopName = String(profile?.shop_name || "").trim() || "-";
    return {
      userId: String(m.user_id),
      role: m.role === "owner" ? "owner" : "member",
      shopName,
      name: name || "-",
      username: username || "-",
      phone: String(profile?.phone ?? "").trim(),
    };
  });
}

/**
 * 동료가 없는 초대용 공간(1명)은 아직 팀이 아님.
 * 다른 팀 코드로 참여할 때 이 공간을 해제한 뒤 진행한다.
 */
export async function dissolveSoloPendingWorkspace(
  admin: Admin,
  userId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const membership = await getMembership(admin, userId);
  if (!membership) return { ok: true };

  const members = await listWorkspaceMembers(admin, membership.workspaceId);
  if (members.length >= 2) {
    return { ok: false, message: "이미 다른 팀에 속한 계정입니다." };
  }

  const tables = ["customers", "listed_properties", "schedules"] as const;
  for (const table of tables) {
    await admin
      .from(table)
      .update({ workspace_id: null, workspace_shared: false })
      .eq("user_id", userId)
      .eq("workspace_id", membership.workspaceId);
  }

  await admin
    .from("workspace_members")
    .delete()
    .eq("workspace_id", membership.workspaceId)
    .eq("user_id", userId);

  const remaining = await listWorkspaceMembers(admin, membership.workspaceId);
  if (remaining.length === 0) {
    await admin.from("workspaces").delete().eq("id", membership.workspaceId);
  }

  await writeAuditLog(admin, {
    workspaceId: membership.workspaceId,
    actorUserId: userId,
    action: "workspace_dissolve_solo",
    entityType: "workspace",
    entityId: membership.workspaceId,
  });

  return { ok: true };
}

/**
 * 계정삭제: 팀은 유지하고 멤버십만 제거.
 * 공유 자료는 그대로 두고, 주인이 나가면 남은 팀원 중 가장 먼저 합류한 사람에게 역할만 넘긴다.
 */
export async function removeMemberKeepSharedData(
  admin: Admin,
  userId: string
): Promise<void> {
  const membership = await getMembership(admin, userId);
  if (!membership) return;

  if (membership.role === "owner") {
    const members = await listWorkspaceMembers(admin, membership.workspaceId);
    const next = members.find((m) => m.userId !== userId);
    if (next) {
      await admin
        .from("workspace_members")
        .update({ role: "owner" })
        .eq("workspace_id", membership.workspaceId)
        .eq("user_id", next.userId);
    }
  }

  await admin.from("workspace_members").delete().eq("user_id", userId);

  await writeAuditLog(admin, {
    workspaceId: membership.workspaceId,
    actorUserId: userId,
    action: "workspace_leave_on_account_delete",
    entityType: "workspace",
    entityId: membership.workspaceId,
  });
}

/**
 * 관리자: 팀원 한 명만 나가게.
 * 공유는 팀에서 끄고(본인 자료는 유지), 1명만 남으면 팀 해체.
 */
export async function adminRemoveWorkspaceMember(
  admin: Admin,
  workspaceId: string,
  targetUserId: string,
  actorName: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data: member } = await admin
    .from("workspace_members")
    .select("user_id, role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", targetUserId)
    .maybeSingle();
  if (!member) {
    return { ok: false, message: "해당 팀원을 찾을 수 없습니다." };
  }

  const members = await listWorkspaceMembers(admin, workspaceId);
  const tables = ["customers", "listed_properties", "schedules"] as const;
  for (const table of tables) {
    await admin
      .from(table)
      .update({ workspace_id: null, workspace_shared: false })
      .eq("user_id", targetUserId)
      .eq("workspace_id", workspaceId);
  }

  if (member.role === "owner") {
    const next = members.find((m) => m.userId !== targetUserId);
    if (next) {
      await admin
        .from("workspace_members")
        .update({ role: "owner" })
        .eq("workspace_id", workspaceId)
        .eq("user_id", next.userId);
    }
  }

  await admin
    .from("workspace_members")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("user_id", targetUserId);

  const remaining = await listWorkspaceMembers(admin, workspaceId);
  if (remaining.length <= 1) {
    if (remaining.length === 1) {
      const last = remaining[0];
      for (const table of tables) {
        await admin
          .from(table)
          .update({ workspace_id: null, workspace_shared: false })
          .eq("user_id", last.userId)
          .eq("workspace_id", workspaceId);
      }
      await admin
        .from("workspace_members")
        .delete()
        .eq("workspace_id", workspaceId);
    }
    await admin.from("workspaces").delete().eq("id", workspaceId);
  }

  await writeAuditLog(admin, {
    workspaceId,
    actorName,
    action: "admin_workspace_remove_member",
    entityType: "workspace",
    entityId: workspaceId,
    detail: { targetUserId, dissolved: remaining.length <= 1 },
  });

  return { ok: true };
}

export async function buildWorkspaceInfo(admin: Admin, userId: string) {
  await unlinkDemoFromWorkspace(admin, userId);
  const membership = await getMembership(admin, userId);
  if (!membership) return null;
  const members = await listWorkspaceMembers(admin, membership.workspaceId);

  // 초대만 하고 팀원 없이 코드가 만료되면 공간·팀이름까지 초기화
  if (members.length < 2 && !membership.shareCodeValid) {
    await dissolveSoloPendingWorkspace(admin, userId);
    return null;
  }

  return {
    ...membership,
    memberCount: members.length || 1,
    members,
  };
}
