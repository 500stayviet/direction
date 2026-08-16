import { NextResponse } from "next/server";
import { getClientIp } from "@/lib/adminAuth";
import { withApiErrorLog, writeAppErrorLog } from "@/lib/appErrorLog";
import {
  buildIntakeAiUserPrompt,
  leftoverMaxForSource,
  sanitizeIntakeAiPatch,
  type IntakeAiSource,
} from "@/lib/intakeAi";
import type { IntakeKind } from "@/lib/intakeParse";
import { getAuthUserFromToken, getBearerToken } from "@/lib/serverAuth";
import {
  decideIntakeAiCall,
  isIntakeAiKeyConfigured,
  shouldLogIntakeAiError,
} from "@/lib/intakeAiGuard";

export const maxDuration = 15;

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const DEEPSEEK_MODEL = "deepseek-v4-flash";
const DEEPSEEK_TIMEOUT_MS = 8000;

const SYSTEM_PROMPT = [
  "한국 부동산 중개 입력 보조다.",
  "잔여 글만 보고, 비어 있는 칸이 분명할 때만 JSON으로 채운다.",
  "금액·거래유형·전화·방수·화장실은 절대 출력하지 않는다.",
  "이미 채워진 칸을 덮어쓰지 않는다. 둘째 월세·매매 뒤 월세도 넣지 않는다.",
  "8.25처럼 점이 애매한 숫자는 날짜/금액이 아니라 memo다.",
  "이사 협의 N개월은 날짜가 아니라 memo다.",
  "가능한 키: name, buildingName, gu, dong, jibun, roomNo, moveInFrom(YYYY-MM-DD), moveInTo, moveInImmediate, memo.",
  "모르면 그 키를 생략한다. JSON 객체만 출력한다.",
].join(" ");

type DeepSeekChatResponse = {
  choices?: Array<{
    message?: { content?: string | null };
  }>;
  error?: { message?: string; type?: string };
};

function emptyOk() {
  return NextResponse.json({ ok: true, patch: {} });
}

function logAiError(opts: {
  request: Request;
  status: number;
  message: string;
  leftover: string;
}) {
  void writeAppErrorLog({
    status: opts.status,
    method: "POST",
    path: "/api/intake-ai",
    message: opts.message,
    bodyPreview: opts.leftover.slice(0, 200),
    ip: getClientIp(opts.request),
    userAgent: opts.request.headers.get("user-agent") ?? "",
  });
}

function classifyDeepSeekError(status: number, body: string): {
  status: number;
  message: string;
} {
  const lower = body.toLowerCase();
  if (
    status === 402 ||
    /insufficient|balance|quota|credits|payment required/.test(lower) ||
    /잔고|크레딧/.test(body)
  ) {
    return { status: 502, message: "[AI] DeepSeek 잔고 부족" };
  }
  if (status === 401) {
    return { status: 502, message: "[AI] DeepSeek 인증 실패" };
  }
  if (status === 429) {
    return { status: 502, message: "[AI] DeepSeek 호출 제한" };
  }
  return { status: 502, message: "[AI] DeepSeek 호출 실패" };
}

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = (fenced?.[1] ?? trimmed).trim();
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(raw.slice(start, end + 1)) as unknown;
    }
    throw new Error("not json");
  }
}

async function callDeepSeek(userPrompt: string): Promise<{
  ok: true;
  content: string;
} | {
  ok: false;
  status: number;
  body: string;
}> {
  const key = process.env.DEEPSEEK_API_KEY?.trim();
  if (!key) {
    return { ok: false, status: 503, body: "missing key" };
  }

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), DEEPSEEK_TIMEOUT_MS);
  try {
    const res = await fetch(DEEPSEEK_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.DEEPSEEK_MODEL?.trim() || DEEPSEEK_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        thinking: { type: "disabled" },
        response_format: { type: "json_object" },
        temperature: 0.2,
        max_tokens: 256,
        stream: false,
      }),
      signal: ac.signal,
    });
    const body = await res.text();
    if (!res.ok) {
      return { ok: false, status: res.status, body };
    }
    let json: DeepSeekChatResponse;
    try {
      json = JSON.parse(body) as DeepSeekChatResponse;
    } catch {
      return { ok: false, status: 502, body: "empty content" };
    }
    const content = json.choices?.[0]?.message?.content?.trim() ?? "";
    if (!content) {
      return { ok: false, status: 502, body: "empty content" };
    }
    return { ok: true, content };
  } catch (e) {
    const aborted =
      (e instanceof Error && e.name === "AbortError") || ac.signal.aborted;
    return {
      ok: false,
      status: aborted ? 504 : 502,
      body: e instanceof Error ? e.message : "fetch failed",
    };
  } finally {
    clearTimeout(timer);
  }
}

async function __POST_handler(request: Request) {
  let leftover = "";
  try {
    const auth = await getAuthUserFromToken(getBearerToken(request));
    if (!auth) return emptyOk();

    const body = (await request.json()) as {
      leftover?: unknown;
      kind?: unknown;
      source?: unknown;
      emptyFields?: unknown;
    };

    const kind: IntakeKind =
      body.kind === "customer" || body.kind === "property"
        ? body.kind
        : "property";
    const source: IntakeAiSource =
      body.source === "photo" ? "photo" : "message";
    leftover = String(body.leftover ?? "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, leftoverMaxForSource(source));
    if (!leftover || leftover.length < 2) return emptyOk();

    const emptyFields = Array.isArray(body.emptyFields)
      ? body.emptyFields.filter((v) => typeof v === "string").slice(0, 20)
      : [];

    if (!isIntakeAiKeyConfigured()) {
      if (shouldLogIntakeAiError("key")) {
        logAiError({
          request,
          status: 503,
          message: "[AI] DeepSeek 키 없음",
          leftover,
        });
      }
      return emptyOk();
    }

    const guard = decideIntakeAiCall({
      userId: auth.user.id,
      leftover,
    });
    if (!guard.allow) {
      if (guard.log) {
        logAiError({
          request,
          status: 502,
          message: `[AI] 호출 제한 (${guard.reason})`,
          leftover,
        });
      }
      return emptyOk();
    }

    const result = await callDeepSeek(
      buildIntakeAiUserPrompt({ leftover, kind, emptyFields })
    );
    if (!result.ok) {
      if (result.status === 504) {
        logAiError({
          request,
          status: 504,
          message: "[AI] DeepSeek 시간 초과",
          leftover,
        });
      } else if (result.body === "empty content") {
        logAiError({
          request,
          status: 502,
          message: "[AI] DeepSeek 응답 없음",
          leftover,
        });
      } else {
        const classified = classifyDeepSeekError(result.status, result.body);
        if (shouldLogIntakeAiError(classified.message)) {
          logAiError({
            request,
            status: classified.status,
            message: classified.message,
            leftover,
          });
        }
      }
      return emptyOk();
    }

    try {
      const parsedJson = extractJsonObject(result.content);
      const patch = sanitizeIntakeAiPatch(parsedJson, leftover);
      return NextResponse.json({ ok: true, patch });
    } catch {
      logAiError({
        request,
        status: 502,
        message: "[AI] DeepSeek 응답 형식 오류",
        leftover,
      });
      return emptyOk();
    }
  } catch {
    logAiError({
      request,
      status: 500,
      message: "[AI] DeepSeek 호출 실패",
      leftover,
    });
    return emptyOk();
  }
}

export const POST = withApiErrorLog(__POST_handler);
