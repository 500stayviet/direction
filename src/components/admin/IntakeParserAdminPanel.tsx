"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formatSeoulDateTime, todayISO, toISODate } from "@/lib/date";
import {
  buildIntakeSampleExportBundle,
  downloadTextFile,
  type IntakeSampleRow,
  type IntakeSampleStats,
} from "@/lib/intakeSampleExport";

function daysAgoISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return toISODate(d);
}

export function IntakeParserAdminPanel({
  token,
  onNewCount,
}: {
  token: string;
  onNewCount?: (count: number) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [stats, setStats] = useState<IntakeSampleStats | null>(null);
  const [samples, setSamples] = useState<IntakeSampleRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<
    "all" | "new" | "exported" | "reviewed"
  >("all");
  const [exportFrom, setExportFrom] = useState(daysAgoISO(7));
  const [exportTo, setExportTo] = useState(todayISO());
  const [exportStatus, setExportStatus] = useState<
    "all" | "new" | "exported" | "reviewed"
  >("new");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [cursorPrompt, setCursorPrompt] = useState("");

  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const q =
        statusFilter === "all" ? "" : `?status=${encodeURIComponent(statusFilter)}`;
      const res = await fetch(`/api/admin/intake-samples${q}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await res.json()) as {
        ok?: boolean;
        stats?: IntakeSampleStats;
        samples?: IntakeSampleRow[];
        message?: string;
      };
      if (!res.ok || !body.ok) {
        setError(body.message ?? "불러오기 실패");
        return;
      }
      setStats(body.stats ?? null);
      setSamples(body.samples ?? []);
      onNewCount?.(body.stats?.newCount ?? 0);
    } catch {
      setError("불러오기 실패");
    } finally {
      setBusy(false);
    }
  }, [token, statusFilter, onNewCount]);

  useEffect(() => {
    void load();
  }, [load]);

  const runExport = async (markExported: boolean) => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/intake-samples/export", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fromDate: exportFrom,
          toDate: exportTo,
          status: exportStatus,
          markExported,
        }),
      });
      const body = (await res.json()) as {
        ok?: boolean;
        period?: string;
        count?: number;
        json?: string;
        summary?: string;
        cursorPrompt?: string;
        message?: string;
      };
      if (!res.ok || !body.ok || !body.json || !body.summary || !body.cursorPrompt) {
        setError(body.message ?? "export 실패");
        return;
      }

      const stamp = todayISO();
      downloadTextFile(
        `intake-samples-${stamp}.json`,
        body.json,
        "application/json"
      );
      downloadTextFile(
        `intake-summary-${stamp}.md`,
        body.summary,
        "text/markdown"
      );
      setCursorPrompt(body.cursorPrompt);
      if (markExported) await load();
    } catch {
      setError("export 실패");
    } finally {
      setBusy(false);
    }
  };

  const markReviewed = async (ids: string[]) => {
    if (ids.length === 0) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/intake-samples/mark-reviewed", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ids }),
      });
      const body = (await res.json()) as { ok?: boolean; message?: string };
      if (!res.ok || !body.ok) {
        setError(body.message ?? "상태 변경 실패");
        return;
      }
      await load();
    } catch {
      setError("상태 변경 실패");
    } finally {
      setBusy(false);
    }
  };

  const previewBundle = () => {
    const rows = samples.filter((row) => {
      if (exportStatus !== "all" && row.status !== exportStatus) return false;
      const day = row.createdAt.slice(0, 10);
      return day >= exportFrom && day <= exportTo;
    });
    const bundle = buildIntakeSampleExportBundle(
      rows,
      `${exportFrom} ~ ${exportTo}`
    );
    setCursorPrompt(bundle.cursorPrompt);
  };

  return (
    <Card className="space-y-3 !p-3">
      <div>
        <p className="text-[14px] font-bold">파서 · 인테이크 수집</p>
        <p className="mt-0.5 text-[11px] text-gray-500">
          메시지·사진 입력 시 원문과 파싱 결과를 모읍니다. 원하는 날 export 후
          Cursor에 붙여 파서 개선 작업 리스트를 받으세요.
        </p>
      </div>

      {stats ? (
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          <div className="rounded-lg border border-gray-100 bg-gray-50 px-2.5 py-2">
            <p className="text-[10px] text-gray-500">전체</p>
            <p className="text-[18px] font-extrabold tabular-nums">{stats.total}</p>
          </div>
          <div className="rounded-lg border border-[#D9E6F8] bg-[#F7FAFF] px-2.5 py-2">
            <p className="text-[10px] text-[#6B8AB8]">미처리</p>
            <p className="text-[18px] font-extrabold tabular-nums text-[#3182F6]">
              {stats.newCount}
            </p>
          </div>
          <div className="rounded-lg border border-gray-100 bg-gray-50 px-2.5 py-2">
            <p className="text-[10px] text-gray-500">이번 주</p>
            <p className="text-[18px] font-extrabold tabular-nums">{stats.weekCount}</p>
          </div>
          <div className="rounded-lg border border-gray-100 bg-gray-50 px-2.5 py-2">
            <p className="text-[10px] text-gray-500">메시지 / 사진</p>
            <p className="text-[14px] font-bold tabular-nums">
              {stats.messageCount} / {stats.photoCount}
            </p>
          </div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-gray-100">
        <div className="border-b border-gray-100 bg-gray-50/80 px-2.5 py-2">
          <p className="text-[12px] font-bold text-gray-800">Cursor export</p>
        </div>
        <div className="space-y-2 p-2.5">
          <div className="grid grid-cols-2 gap-1.5">
            <label className="block text-[11px] text-gray-500">
              시작
              <input
                type="date"
                value={exportFrom}
                onChange={(e) => setExportFrom(e.target.value)}
                className="mt-0.5 h-9 w-full rounded-lg border border-gray-200 px-2 text-[13px]"
              />
            </label>
            <label className="block text-[11px] text-gray-500">
              종료
              <input
                type="date"
                value={exportTo}
                onChange={(e) => setExportTo(e.target.value)}
                className="mt-0.5 h-9 w-full rounded-lg border border-gray-200 px-2 text-[13px]"
              />
            </label>
          </div>
          <label className="block text-[11px] text-gray-500">
            상태
            <select
              value={exportStatus}
              onChange={(e) =>
                setExportStatus(
                  e.target.value as "all" | "new" | "exported" | "reviewed"
                )
              }
              className="mt-0.5 h-9 w-full rounded-lg border border-gray-200 px-2 text-[13px]"
            >
              <option value="new">미처리만</option>
              <option value="exported">export됨</option>
              <option value="reviewed">검토완료</option>
              <option value="all">전체</option>
            </select>
          </label>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            <Button
              fullWidth
              className="!min-h-[36px] !text-[12px]"
              disabled={busy}
              onClick={() => void runExport(true)}
            >
              JSON·요약 다운 + export 표시
            </Button>
            <Button
              fullWidth
              variant="secondary"
              className="!min-h-[36px] !text-[12px]"
              disabled={busy}
              onClick={() => void runExport(false)}
            >
              다운로드만 (상태 유지)
            </Button>
          </div>
          <Button
            fullWidth
            variant="secondary"
            className="!min-h-[34px] !text-[12px]"
            disabled={busy}
            onClick={previewBundle}
          >
            Cursor 프롬프트 미리보기
          </Button>
          {cursorPrompt ? (
            <div className="space-y-1.5">
              <textarea
                readOnly
                value={cursorPrompt}
                className="min-h-[140px] w-full rounded-lg border border-gray-200 bg-white p-2 text-[11px] leading-relaxed text-gray-700"
              />
              <Button
                fullWidth
                variant="secondary"
                className="!min-h-[34px] !text-[12px]"
                onClick={() => {
                  void navigator.clipboard.writeText(cursorPrompt);
                }}
              >
                Cursor 프롬프트 복사
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(
              e.target.value as "all" | "new" | "exported" | "reviewed"
            )
          }
          className="h-9 rounded-lg border border-gray-200 px-2 text-[12px]"
        >
          <option value="all">전체 목록</option>
          <option value="new">미처리</option>
          <option value="exported">export됨</option>
          <option value="reviewed">검토완료</option>
        </select>
        <Button
          variant="secondary"
          className="!min-h-[34px] !px-3 !text-[12px]"
          disabled={busy}
          onClick={() => void load()}
        >
          새로고침
        </Button>
        <Button
          variant="secondary"
          className="!min-h-[34px] !px-3 !text-[12px]"
          disabled={busy || samples.length === 0}
          onClick={() =>
            void markReviewed(samples.filter((s) => s.status !== "reviewed").map((s) => s.id))
          }
        >
          목록 전체 검토완료
        </Button>
      </div>

      {error ? (
        <p className="text-[12px] font-semibold text-red-500">{error}</p>
      ) : null}

      {samples.length === 0 ? (
        <p className="text-[12px] text-gray-400">수집된 샘플이 없습니다.</p>
      ) : (
        <div className="space-y-1.5">
          {samples.map((row) => (
            <div
              key={row.id}
              className="overflow-hidden rounded-lg border border-gray-100"
            >
              <button
                type="button"
                className="flex w-full items-start justify-between gap-2 px-2.5 py-2 text-left"
                onClick={() =>
                  setExpandedId((id) => (id === row.id ? null : row.id))
                }
              >
                <div className="min-w-0">
                  <p className="text-[12px] font-bold text-gray-800">
                    <span className="text-[#3182F6]">{row.source}</span>
                    <span className="text-gray-300"> · </span>
                    {row.kind}
                    <span className="ml-1.5 text-[10px] font-semibold text-gray-400">
                      {row.status}
                    </span>
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-gray-500">
                    {row.rawText}
                  </p>
                  <p className="mt-0.5 text-[10px] text-gray-400">
                    {formatSeoulDateTime(row.createdAt)}
                    {row.missingFields.length > 0
                      ? ` · 비어 있음 ${row.missingFields.length}개`
                      : ""}
                  </p>
                </div>
                <span className="shrink-0 text-[11px] text-gray-400">
                  {expandedId === row.id ? "▲" : "▼"}
                </span>
              </button>
              {expandedId === row.id ? (
                <div className="space-y-2 border-t border-gray-100 px-2.5 pb-2.5 pt-2">
                  <pre className="max-h-32 overflow-auto whitespace-pre-wrap rounded-lg bg-gray-50 p-2 text-[10px] text-gray-700">
                    {row.rawText}
                  </pre>
                  <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-[#F7FAFF] p-2 text-[10px] text-gray-700">
                    {JSON.stringify(row.parsed, null, 2)}
                  </pre>
                  {row.missingFields.length > 0 ? (
                    <p className="text-[10px] text-gray-500">
                      미파싱: {row.missingFields.join(", ")}
                    </p>
                  ) : null}
                  {row.status !== "reviewed" ? (
                    <Button
                      variant="secondary"
                      className="!min-h-[32px] !text-[11px]"
                      disabled={busy}
                      onClick={() => void markReviewed([row.id])}
                    >
                      검토완료
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
