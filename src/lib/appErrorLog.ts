import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getClientIp } from "@/lib/adminAuth";

/** 400~599만 기록 (3xx·2xx 제외) */
export function shouldLogHttpStatus(status: number): boolean {
  return Number.isFinite(status) && status >= 400 && status <= 599;
}

function formatKst(isoOrDate: Date = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
    .format(isoOrDate);
}

export function buildErrorReportText(input: {
  createdAt?: Date;
  status: number;
  method: string;
  path: string;
  message: string;
  bodyPreview?: string;
  stack?: string;
  ip?: string;
  userAgent?: string;
}): string {
  const when = `${formatKst(input.createdAt ?? new Date())} KST`;
  const lines = [
    "=== 현장동선 API 에러 ===",
    `시각: ${when}`,
    `HTTP: ${input.status}`,
    `메서드: ${input.method || "-"}`,
    `경로: ${input.path || "-"}`,
    `메시지: ${input.message || "-"}`,
  ];
  if (input.bodyPreview?.trim()) {
    lines.push(`응답본문: ${input.bodyPreview.trim().slice(0, 1500)}`);
  }
  if (input.stack?.trim()) {
    lines.push(`스택: ${input.stack.trim().slice(0, 2000)}`);
  }
  if (input.ip?.trim()) lines.push(`IP: ${input.ip.trim()}`);
  if (input.userAgent?.trim()) {
    lines.push(`UA: ${input.userAgent.trim().slice(0, 200)}`);
  }
  lines.push("========================");
  lines.push("위 블록을 Cursor에 붙여넣고 원인 분석을 요청하세요.");
  return lines.join("\n");
}

function isMissingErrorLogsTable(error: { message?: string; code?: string } | null) {
  const msg = (error?.message ?? "").toLowerCase();
  return (
    msg.includes("app_error_logs") ||
    msg.includes("does not exist") ||
    msg.includes("schema cache") ||
    error?.code === "42P01" ||
    error?.code === "PGRST205"
  );
}

export type AppErrorLogInput = {
  status: number;
  method: string;
  path: string;
  message?: string;
  bodyPreview?: string;
  stack?: string;
  ip?: string;
  userAgent?: string;
};

/** fire-and-forget 가능. 실패해도 본 요청을 막지 않음 */
export async function writeAppErrorLog(input: AppErrorLogInput): Promise<void> {
  if (!shouldLogHttpStatus(input.status)) return;
  const path = input.path || "";
  if (path.startsWith("/api/admin/error-logs")) return;

  try {
    const admin = createAdminClient();
    const reportText = buildErrorReportText({
      status: input.status,
      method: input.method,
      path,
      message: input.message ?? "",
      bodyPreview: input.bodyPreview,
      stack: input.stack,
      ip: input.ip,
      userAgent: input.userAgent,
    });
    const { error } = await admin.from("app_error_logs").insert({
      status: input.status,
      method: (input.method || "").slice(0, 16),
      path: path.slice(0, 500),
      message: (input.message ?? "").slice(0, 1000),
      body_preview: (input.bodyPreview ?? "").slice(0, 2000),
      stack: (input.stack ?? "").slice(0, 4000),
      report_text: reportText.slice(0, 8000),
      ip: (input.ip ?? "").slice(0, 128),
      user_agent: (input.userAgent ?? "").slice(0, 300),
    });
    if (error && !isMissingErrorLogsTable(error)) {
      console.error("[app_error_logs]", error.message);
    }
  } catch {
    /* never throw */
  }
}

async function extractResponseMessage(res: Response): Promise<{
  message: string;
  bodyPreview: string;
}> {
  try {
    const text = await res.clone().text();
    const bodyPreview = text.slice(0, 2000);
    try {
      const json = JSON.parse(text) as { message?: unknown; error?: unknown };
      const message = String(json.message ?? json.error ?? "").slice(0, 1000);
      return { message: message || bodyPreview.slice(0, 200), bodyPreview };
    } catch {
      return { message: bodyPreview.slice(0, 200), bodyPreview };
    }
  } catch {
    return { message: "", bodyPreview: "" };
  }
}

export async function logApiResponseIfNeeded(
  request: Request,
  res: Response
): Promise<void> {
  if (!shouldLogHttpStatus(res.status)) return;
  const url = new URL(request.url);
  const { message, bodyPreview } = await extractResponseMessage(res);
  await writeAppErrorLog({
    status: res.status,
    method: request.method,
    path: url.pathname,
    message,
    bodyPreview,
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent") ?? "",
  });
}

type RouteCtx = {
  params?: Promise<Record<string, string>> | Record<string, string>;
};

/**
 * Route handler 래퍼: 4xx/5xx 응답·미처리 예외를 app_error_logs에 기록.
 * Next dynamic route handlers may require `params`; keep the constraint loose.
 */
export function withApiErrorLog<
  // Next App Router: handlers may use NextRequest and/or required `{ params }`.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T extends (request: any, ctx?: any) => Promise<Response> | Response,
>(handler: T): T {
  const wrapped = async (request: Request, ctx?: RouteCtx) => {
    try {
      const res = await handler(request, ctx);
      void logApiResponseIfNeeded(request, res);
      return res;
    } catch (e) {
      const url = new URL(request.url);
      const message = e instanceof Error ? e.message : "Unhandled API error";
      const stack = e instanceof Error ? e.stack ?? "" : "";
      void writeAppErrorLog({
        status: 500,
        method: request.method,
        path: url.pathname,
        message,
        stack,
        ip: getClientIp(request),
        userAgent: request.headers.get("user-agent") ?? "",
      });
      return NextResponse.json(
        { ok: false, message: "요청을 처리하지 못했습니다." },
        { status: 500 }
      );
    }
  };
  return wrapped as T;
}
