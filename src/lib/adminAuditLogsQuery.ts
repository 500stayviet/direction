import type { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function parseAuditLogDateRange(
  from: string,
  to: string
): { startIso: string; endIso: string } | null {
  const f = from.trim();
  const t = to.trim();
  if (!ISO_DATE.test(f) || !ISO_DATE.test(t)) return null;
  const startIso = new Date(`${f}T00:00:00+09:00`).toISOString();
  const endIso = new Date(`${t}T23:59:59.999+09:00`).toISOString();
  if (startIso > endIso) return null;
  return { startIso, endIso };
}

export type AuditLogRow = {
  id: string;
  actorName: string;
  action: string;
  entityType: string;
  entityId: string;
  detail: Record<string, unknown>;
  createdAt: string;
};

export async function fetchAdminAuditLogs(
  admin: Admin,
  input: {
    q?: string;
    from?: string;
    to?: string;
    limit: number;
  }
): Promise<{ rows: AuditLogRow[]; error?: string }> {
  const rawQ = (input.q ?? "").trim();
  const safeQ = rawQ.replace(/[%_,]/g, "").trim();
  const range =
    input.from && input.to
      ? parseAuditLogDateRange(input.from, input.to)
      : null;

  let query = admin
    .from("audit_logs")
    .select(
      "id, actor_name, action, entity_type, entity_id, detail, created_at"
    )
    .like("action", "admin_%")
    .order("created_at", { ascending: false })
    .limit(input.limit);

  if (range) {
    query = query.gte("created_at", range.startIso).lte("created_at", range.endIso);
  }

  if (safeQ) {
    query = query.or(
      [
        `actor_name.ilike.%${safeQ}%`,
        `action.ilike.%${safeQ}%`,
        `entity_id.ilike.%${safeQ}%`,
      ].join(",")
    );
  }

  const { data, error } = await query;
  if (error) {
    return { rows: [], error: error.message };
  }

  return {
    rows: (data ?? []).map((row) => ({
      id: row.id,
      actorName: row.actor_name,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      detail: (row.detail as Record<string, unknown>) ?? {},
      createdAt: row.created_at,
    })),
  };
}

export function auditLogsToCsv(rows: AuditLogRow[]): string {
  const header = ["시각", "관리자", "행동", "대상유형", "대상ID", "상세"];
  const lines = [
    header.join(","),
    ...rows.map((row) =>
      [
        csvCell(row.createdAt),
        csvCell(row.actorName),
        csvCell(row.action),
        csvCell(row.entityType),
        csvCell(row.entityId),
        csvCell(JSON.stringify(row.detail)),
      ].join(",")
    ),
  ];
  return `\uFEFF${lines.join("\r\n")}`;
}

function csvCell(value: string): string {
  const v = value ?? "";
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}
