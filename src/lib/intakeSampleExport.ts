import type { IntakeKind, IntakeParseResult } from "@/lib/intakeParse";
import type { IntakeSampleSource, IntakeSampleStatus } from "@/lib/intakeSampleCollect";
import { hashIntakeSampleText } from "@/lib/intakeSampleCollect";

export type IntakeSampleRow = {
  id: string;
  kind: IntakeKind;
  source: IntakeSampleSource;
  rawText: string;
  parsed: IntakeParseResult;
  missingFields: string[];
  status: IntakeSampleStatus;
  createdAt: string;
  exportedAt?: string | null;
  reviewedAt?: string | null;
};

export type IntakeSampleStats = {
  total: number;
  newCount: number;
  exportedCount: number;
  reviewedCount: number;
  weekCount: number;
  messageCount: number;
  photoCount: number;
};

export function summarizeIntakeSampleStats(rows: IntakeSampleRow[]): IntakeSampleStats {
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return {
    total: rows.length,
    newCount: rows.filter((r) => r.status === "new").length,
    exportedCount: rows.filter((r) => r.status === "exported").length,
    reviewedCount: rows.filter((r) => r.status === "reviewed").length,
    weekCount: rows.filter((r) => Date.parse(r.createdAt) >= weekAgo).length,
    messageCount: rows.filter((r) => r.source === "message").length,
    photoCount: rows.filter((r) => r.source === "photo").length,
  };
}

function dedupeSamples(rows: IntakeSampleRow[]): IntakeSampleRow[] {
  const seen = new Set<string>();
  const out: IntakeSampleRow[] = [];
  for (const row of rows) {
    const hash = hashIntakeSampleText(row.rawText);
    if (seen.has(hash)) continue;
    seen.add(hash);
    out.push(row);
  }
  return out;
}

export function buildIntakeSampleExportBundle(
  rows: IntakeSampleRow[],
  periodLabel: string
): { json: string; summary: string; cursorPrompt: string } {
  const unique = dedupeSamples(rows);
  const stats = summarizeIntakeSampleStats(rows);
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
      kind: row.kind,
      source: row.source,
      raw: row.rawText,
      parsed: row.parsed,
      missing: row.missingFields,
      createdAt: row.createdAt,
    })),
  };

  const summaryLines = [
    `# 인테이크 파서 수집 요약 (${periodLabel})`,
    "",
    `- 총 ${stats.total}건 · 이번 export ${unique.length}건 (중복 제거)`,
    `- 신규 ${stats.newCount} · export됨 ${stats.exportedCount} · 검토완료 ${stats.reviewedCount}`,
    `- 메시지 ${stats.messageCount} · 사진 ${stats.photoCount}`,
    "",
    "## 자주 비어 있는 필드",
    ...topMissing.map(([field, count]) => `- ${field}: ${count}건`),
    "",
    "## 샘플 미리보기",
    ...unique.slice(0, 8).map((row, i) => {
      const missing =
        row.missingFields.length > 0 ? row.missingFields.join(", ") : "(없음)";
      return [
        `### ${i + 1}. ${row.source}/${row.kind}`,
        "",
        "원문:",
        "```",
        row.rawText.slice(0, 400),
        "```",
        "",
        `미파싱: ${missing}`,
        "",
      ].join("\n");
    }),
  ];

  const cursorPrompt = [
    "첨부 JSON은 현장 메시지·사진 OCR 인테이크 파싱 샘플입니다.",
    "",
    "요청:",
    "1. intakeParse.ts, intakeOcrNormalize.ts, intakeParse.test.ts만 참고",
    "2. 코드 수정·커밋·푸시는 하지 말 것",
    "3. docs/parser-reports/ 아래 작업 리스트 마크다운 초안 작성",
    "",
    "문서에 포함:",
    "- P0/P1 우선순위 작업 리스트",
    "- 패턴별 raw 예시 1~2개",
    "- 제안 규칙·테스트 케이스 초안",
    "- 이번에 미룰 항목",
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

export function downloadTextFile(filename: string, content: string, mime: string) {
  if (typeof window === "undefined") return;
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
