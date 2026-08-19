import type { NaviMeetingParsedPayload } from "@/lib/naviMeetingSampleCollect";
import type { NaviMeetingRawPayload } from "@/lib/naviMeetingSampleCollect";
import type { NaviMeetingSampleStatus } from "@/lib/naviMeetingSampleCollect";

export type NaviMeetingSampleRow = {
  id: string;
  scheduleId: string;
  rawPayload: NaviMeetingRawPayload;
  parsed: NaviMeetingParsedPayload;
  missingFields: string[];
  status: NaviMeetingSampleStatus;
  createdAt: string;
  exportedAt?: string | null;
  reviewedAt?: string | null;
};

export type NaviMeetingSampleStats = {
  total: number;
  newCount: number;
  exportedCount: number;
  reviewedCount: number;
  weekCount: number;
  scheduleCount: number;
  propertyCount: number;
};

export function summarizeNaviMeetingSampleStats(
  rows: NaviMeetingSampleRow[]
): NaviMeetingSampleStats {
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const scheduleCount = rows.length;
  const propertyCount = rows.reduce(
    (acc, r) => acc + (r.rawPayload.properties?.length ?? 0),
    0
  );
  return {
    total: rows.length,
    newCount: rows.filter((r) => r.status === "new").length,
    exportedCount: rows.filter((r) => r.status === "exported").length,
    reviewedCount: rows.filter((r) => r.status === "reviewed").length,
    weekCount: rows.filter((r) => Date.parse(r.createdAt) >= weekAgo).length,
    scheduleCount,
    propertyCount,
  };
}

function dedupeByScheduleId(rows: NaviMeetingSampleRow[]): NaviMeetingSampleRow[] {
  const seen = new Set<string>();
  const out: NaviMeetingSampleRow[] = [];
  for (const r of rows) {
    if (seen.has(r.scheduleId)) continue;
    seen.add(r.scheduleId);
    out.push(r);
  }
  return out;
}

export function buildNaviMeetingSampleExportBundle(
  rows: NaviMeetingSampleRow[],
  periodLabel: string
): { json: string; summary: string; cursorPrompt: string } {
  const unique = dedupeByScheduleId(rows);
  const stats = summarizeNaviMeetingSampleStats(rows);

  const missingCounts = new Map<string, number>();
  for (const row of unique) {
    for (const field of row.missingFields) {
      missingCounts.set(field, (missingCounts.get(field) ?? 0) + 1);
    }
  }

  const topMissing = [...missingCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);

  const exportPayload = {
    period: periodLabel,
    exportedAt: new Date().toISOString(),
    stats,
    sampleCount: unique.length,
    samples: unique.map((row) => ({
      id: row.id,
      scheduleId: row.scheduleId,
      raw: row.rawPayload,
      parsed: row.parsed,
      missing: row.missingFields,
      createdAt: row.createdAt,
    })),
  };

  const summaryLines = [
    `# 네비 수집 파서 수집 요약 (${periodLabel})`,
    "",
    `- 총 ${stats.total}건 · 이번 export ${unique.length}건 (중복 제거)`,
    `- 신규 ${stats.newCount} · export됨 ${stats.exportedCount} · 검토완료 ${stats.reviewedCount}`,
    `- 일정 ${stats.scheduleCount} · 총 매물 ${stats.propertyCount}`,
    "",
    "## 자주 비어 있는 필드",
    ...topMissing.map(([field, count]) => `- ${field}: ${count}건`),
    "",
    "## 샘플 미리보기",
    ...unique.slice(0, 8).map((row, i) => {
      const missing =
        row.missingFields.length > 0 ? row.missingFields.join(", ") : "(없음)";
      return [
        `### ${i + 1}. ${row.scheduleId}`,
        "",
        `방문: ${row.parsed.visit.date ?? "-"} ${row.parsed.visit.time ?? "-"}`,
        `고객: ${row.parsed.customer.guestName ?? row.parsed.customer.customerId ?? "-"}`,
        `매물 수: ${row.rawPayload.properties.length}`,
        "",
        `미파싱: ${missing}`,
        "",
      ].join("\n");
    }),
  ];

  const cursorPrompt = [
    "첨부 JSON은 네비(현장동선) 입력(일정 생성) 파싱 샘플입니다.",
    "",
    "요청:",
    "1. naviMeetingSampleCollect.ts (+ 필요 시 naviMeetingSampleExport.ts)만 참고",
    "2. 코드 수정·커밋·푸시는 하지 말 것",
    "3. docs/parser-reports/ 아래 작업 리스트 마크다운 초안 작성",
    "",
    "문서에 포함:",
    "- P0/P1 우선순위 작업 리스트",
    "- 어떤 필드가 실제 현장에 자주 비는지 요약",
    "- 제안 규칙·테스트 케이스 초안",
    "",
    `기간: ${periodLabel}`,
    `샘플 ${unique.length}건`,
    "",
    "JSON:",
    JSON.stringify(exportPayload, null, 2),
  ].join("\n");

  return {
    json: JSON.stringify(exportPayload, null, 2),
    summary: summaryLines.join("\n"),
    cursorPrompt,
  };
}

