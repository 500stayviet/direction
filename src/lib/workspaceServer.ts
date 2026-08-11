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
    if (table === "schedules") {
      await admin
        .from(table)
        .update({ workspace_id: null, workspace_shared: false })
        .eq("user_id", userId)
        .like("id", "demo_%");
    } else {
      await admin
        .from(table)
        .update({ workspace_id: null })
        .eq("user_id", userId)
        .like("id", "demo_%");
    }
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
    // 실데이터만 팀 공간으로 이동 (체험 demo_* 제외)
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
      .update({ workspace_id: workspaceId })
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
    .select("id, username, shop_name, display_name")
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
    };
  });
}

export async function buildWorkspaceInfo(admin: Admin, userId: string) {
  await unlinkDemoFromWorkspace(admin, userId);
  const membership = await getMembership(admin, userId);
  if (!membership) return null;
  const members = await listWorkspaceMembers(admin, membership.workspaceId);
  return {
    ...membership,
    memberCount: members.length || 1,
    members,
  };
}
