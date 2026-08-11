"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

const AUTH_STORAGE = "realty_admin_auth_v1";

type Summary = {
  profiles: number;
  workspaces: number;
  customersActive: number;
  customersDeleted: number;
  propertiesActive: number;
  propertiesDeleted: number;
  schedulesActive: number;
  schedulesDeleted: number;
};

type EntityRow = {
  id: string;
  user_id: string;
  workspace_id: string | null;
  created_by_name: string;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  payload: Record<string, unknown>;
  workspace_shared?: boolean;
};

type AdminCreds = { id: string; password: string };

function adminHeaders(creds: AdminCreds): HeadersInit {
  return {
    "x-admin-id": creds.id,
    "x-admin-password": creds.password,
  };
}

export default function AdminPage() {
  const [adminId, setAdminId] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [creds, setCreds] = useState<AdminCreds | null>(null);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [profiles, setProfiles] = useState<Record<string, unknown>[]>([]);
  const [deletedAccounts, setDeletedAccounts] = useState<
    Record<string, unknown>[]
  >([]);
  const [workspaces, setWorkspaces] = useState<Record<string, unknown>[]>([]);
  const [auditLogs, setAuditLogs] = useState<Record<string, unknown>[]>([]);
  const [tab, setTab] = useState<"customers" | "properties" | "schedules">(
    "customers"
  );
  const [deletedOnly, setDeletedOnly] = useState(true);
  const [rows, setRows] = useState<EntityRow[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(AUTH_STORAGE);
      if (!raw) return;
      const saved = JSON.parse(raw) as AdminCreds;
      if (saved?.id && saved?.password) {
        setAdminId(saved.id);
        setAdminPassword(saved.password);
        void unlock(saved);
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function unlock(next: AdminCreds) {
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/admin/summary", {
        headers: adminHeaders(next),
      });
      const body = (await res.json()) as {
        ok?: boolean;
        message?: string;
        summary?: Summary;
        profiles?: Record<string, unknown>[];
        deletedAccounts?: Record<string, unknown>[];
        workspaces?: Record<string, unknown>[];
        auditLogs?: Record<string, unknown>[];
      };
      if (!res.ok || !body.ok) {
        setCreds(null);
        setError(body.message ?? "아이디 또는 비밀번호가 올바르지 않습니다.");
        return;
      }
      sessionStorage.setItem(AUTH_STORAGE, JSON.stringify(next));
      setCreds(next);
      setSummary(body.summary ?? null);
      setProfiles(body.profiles ?? []);
      setDeletedAccounts(body.deletedAccounts ?? []);
      setWorkspaces(body.workspaces ?? []);
      setAuditLogs(body.auditLogs ?? []);
    } catch {
      setError("서버에 연결할 수 없습니다.");
      setCreds(null);
    } finally {
      setBusy(false);
    }
  }

  async function loadEntities(
    nextTab = tab,
    nextDeleted = deletedOnly,
    nextCreds = creds
  ) {
    if (!nextCreds) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/admin/entities?type=${nextTab}&deleted=${nextDeleted ? "1" : "0"}`,
        { headers: adminHeaders(nextCreds) }
      );
      const body = (await res.json()) as {
        ok?: boolean;
        message?: string;
        rows?: EntityRow[];
      };
      if (!res.ok || !body.ok) {
        setError(body.message ?? "목록 조회 실패");
        return;
      }
      setRows(body.rows ?? []);
    } finally {
      setBusy(false);
    }
  }

  async function restore(row: EntityRow) {
    if (!creds) return;
    if (!window.confirm("이 항목을 복원할까요?")) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/entities", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...adminHeaders(creds),
        },
        body: JSON.stringify({
          type: tab,
          id: row.id,
          userId: row.user_id,
        }),
      });
      const body = (await res.json()) as { ok?: boolean; message?: string };
      if (!res.ok || !body.ok) {
        alert(body.message ?? "복원 실패");
        return;
      }
      await loadEntities();
      await unlock(creds);
    } finally {
      setBusy(false);
    }
  }

  if (!creds) {
    return (
      <main>
        <PageHeader title="관리자" backHref="/" />
        <Card className="space-y-3">
          <p className="text-[13px] text-gray-500">
            관리자 아이디와 비밀번호를 입력하세요.
          </p>
          <Input
            label="아이디"
            value={adminId}
            onChange={(e) => setAdminId(e.target.value)}
            autoComplete="username"
          />
          <Input
            label="비밀번호"
            type="password"
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
            autoComplete="current-password"
          />
          {error ? (
            <p className="text-[13px] font-semibold text-red-500">{error}</p>
          ) : null}
          <Button
            fullWidth
            disabled={busy || !adminId.trim() || !adminPassword.trim()}
            onClick={() =>
              void unlock({
                id: adminId.trim(),
                password: adminPassword.trim(),
              })
            }
          >
            {busy ? "확인 중…" : "입장"}
          </Button>
        </Card>
      </main>
    );
  }

  return (
    <main>
      <PageHeader title="관리자" backHref="/" />
      <div className="space-y-3 pb-10">
        {summary ? (
          <Card className="grid grid-cols-2 gap-2 !p-3 text-[12px]">
            <p>회원 {summary.profiles}</p>
            <p>업장 {summary.workspaces}</p>
            <p>
              고객 {summary.customersActive} / 삭제{" "}
              {summary.customersDeleted}
            </p>
            <p>
              매물 {summary.propertiesActive} / 삭제{" "}
              {summary.propertiesDeleted}
            </p>
            <p>
              네비 {summary.schedulesActive} / 삭제{" "}
              {summary.schedulesDeleted}
            </p>
          </Card>
        ) : null}

        <Card className="space-y-2 !p-3">
          <p className="text-[14px] font-bold">회원가입 기록</p>
          <div className="max-h-48 space-y-1 overflow-y-auto text-[12px]">
            {profiles.map((p) => (
              <div key={String(p.id)} className="border-b border-gray-50 py-1">
                <span className="font-semibold">{String(p.username)}</span> ·{" "}
                {String(p.display_name || "-")} · {String(p.shop_name || "-")}
                <div className="text-gray-400">{String(p.created_at || "")}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="space-y-2 !p-3">
          <p className="text-[14px] font-bold">업장(공유 코드)</p>
          <div className="max-h-40 space-y-1 overflow-y-auto text-[12px]">
            {workspaces.map((w) => (
              <div key={String(w.id)} className="border-b border-gray-50 py-1">
                {String(w.name)} ·{" "}
                <span className="font-mono">{String(w.share_code)}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="space-y-2 !p-3">
          <p className="text-[14px] font-bold">탈퇴 계정</p>
          <div className="max-h-48 space-y-1 overflow-y-auto text-[12px]">
            {deletedAccounts.map((d) => (
              <div
                key={String(d.username)}
                className="border-b border-gray-50 py-1"
              >
                <span className="font-semibold">{String(d.username)}</span> ·{" "}
                {String(d.display_name || "-")}
                <div className="text-gray-400">{String(d.deleted_at || "")}</div>
                <div className="text-gray-500">
                  snapshot counts:{" "}
                  {JSON.stringify(
                    (d.data_snapshot as { counts?: unknown } | undefined)
                      ?.counts ?? {}
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="space-y-2 !p-3">
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["customers", "고객"],
                ["properties", "매물"],
                ["schedules", "네비"],
              ] as const
            ).map(([id, label]) => (
              <Button
                key={id}
                variant={tab === id ? "primary" : "secondary"}
                className="!min-h-[36px] !px-3 !text-[13px]"
                onClick={() => {
                  setTab(id);
                  void loadEntities(id, deletedOnly);
                }}
              >
                {label}
              </Button>
            ))}
            <Button
              variant={deletedOnly ? "danger" : "outline"}
              className="!min-h-[36px] !px-3 !text-[13px]"
              onClick={() => {
                const next = !deletedOnly;
                setDeletedOnly(next);
                void loadEntities(tab, next);
              }}
            >
              {deletedOnly ? "삭제됨만" : "활성만"}
            </Button>
            <Button
              variant="outline"
              className="!min-h-[36px] !px-3 !text-[13px]"
              disabled={busy}
              onClick={() => void loadEntities()}
            >
              불러오기
            </Button>
          </div>
          <div className="max-h-72 space-y-1 overflow-y-auto text-[12px]">
            {rows.map((row) => {
              const payload = row.payload ?? {};
              const title =
                tab === "customers"
                  ? String(payload.name ?? row.id)
                  : tab === "properties"
                    ? String(payload.address ?? row.id)
                    : String(payload.guestName || payload.customerId || row.id);
              return (
                <div
                  key={`${row.user_id}:${row.id}`}
                  className="flex items-start justify-between gap-2 border-b border-gray-50 py-1.5"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{title}</p>
                    <p className="text-gray-400">
                      {row.created_by_name || "-"} · {row.updated_at}
                      {row.deleted_at ? ` · 삭제 ${row.deleted_at}` : ""}
                    </p>
                  </div>
                  {row.deleted_at ? (
                    <Button
                      className="!min-h-[32px] !px-2.5 !text-[12px]"
                      disabled={busy}
                      onClick={() => void restore(row)}
                    >
                      복원
                    </Button>
                  ) : null}
                </div>
              );
            })}
            {rows.length === 0 ? (
              <p className="text-gray-400">불러오기를 눌러 목록을 보세요.</p>
            ) : null}
          </div>
        </Card>

        <Card className="space-y-2 !p-3">
          <p className="text-[14px] font-bold">감사 로그</p>
          <div className="max-h-40 space-y-1 overflow-y-auto text-[11px] text-gray-600">
            {auditLogs.map((a) => (
              <div key={String(a.id)}>
                {String(a.created_at)} · {String(a.actor_name)} ·{" "}
                {String(a.action)} · {String(a.entity_type)}/
                {String(a.entity_id)}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </main>
  );
}
