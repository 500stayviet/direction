import type { createAdminClient } from "@/lib/supabase/admin";
import type { AdminSession } from "@/lib/adminAuth";
import { writeAuditLog } from "@/lib/workspaceServer";

type Admin = ReturnType<typeof createAdminClient>;

export function adminActorName(session: AdminSession): string {
  return `${session.title}:${session.displayName}`;
}

export async function writeAdminAudit(
  admin: Admin,
  session: AdminSession,
  input: {
    action: string;
    entityType?: string;
    entityId?: string;
    detail?: Record<string, unknown>;
  }
) {
  await writeAuditLog(admin, {
    actorUserId: session.id === "env-super" ? null : session.id,
    actorName: adminActorName(session),
    action: input.action,
    entityType: input.entityType ?? "admin",
    entityId: input.entityId ?? session.id,
    detail: {
      adminUsername: session.username,
      adminRole: session.role,
      ...input.detail,
    },
  });
}
