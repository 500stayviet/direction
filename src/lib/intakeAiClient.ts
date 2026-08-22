import {
  INTAKE_AI_MIN_WAIT_MS,
  intakeAiLeftover,
  leftoverNeedsAi,
  listEmptyIntakeAiFields,
  mergeIntakeAi,
  type IntakeAiPatch,
  type IntakeAiSource,
} from "@/lib/intakeAi";
import {
  appendIntakeMemo,
  parseIntakeText,
  scrubCorruptIntakeText,
  type IntakeKind,
  type IntakeParseResult,
} from "@/lib/intakeParse";
import {
  preprocessCustomerBlankForm,
  preprocessPropertyBlankForm,
} from "@/lib/blankIntakeForm";
import { preprocessPropertyShareText } from "@/lib/shareIntakePreprocess";

export { INTAKE_AI_MIN_WAIT_MS };

function isAbortError(err: unknown): boolean {
  return (
    (err instanceof DOMException && err.name === "AbortError") ||
    (err instanceof Error && err.name === "AbortError")
  );
}

export async function requestIntakeAi(opts: {
  leftover: string;
  kind: IntakeKind;
  source: IntakeAiSource;
  parsed: IntakeParseResult;
  accessToken?: string | null;
  signal?: AbortSignal;
}): Promise<IntakeAiPatch | null> {
  if (typeof window === "undefined") return null;
  if (opts.signal?.aborted) return null;
  const leftover = scrubCorruptIntakeText(opts.leftover).trim();
  if (!leftover) return null;
  const token = opts.accessToken?.trim();
  if (!token) return null;

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  try {
    const res = await fetch("/api/intake-ai", {
      method: "POST",
      headers,
      signal: opts.signal,
      body: JSON.stringify({
        leftover,
        kind: opts.kind,
        source: opts.source,
        emptyFields: listEmptyIntakeAiFields(opts.parsed),
      }),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { ok?: boolean; patch?: unknown };
    if (!body?.ok || !body.patch || typeof body.patch !== "object") {
      return null;
    }
    return body.patch as IntakeAiPatch;
  } catch (err) {
    if (isAbortError(err)) return null;
    return null;
  }
}

export async function resolveIntakeWithAi(opts: {
  raw: string;
  kind: IntakeKind;
  source: IntakeAiSource;
  accessToken?: string | null;
  signal?: AbortSignal;
}): Promise<IntakeParseResult> {
  const preprocessed =
    opts.kind === "customer"
      ? preprocessCustomerBlankForm(opts.raw)
      : opts.kind === "property"
        ? (preprocessPropertyBlankForm(opts.raw) ??
          preprocessPropertyShareText(opts.raw))
        : null;
  const rawForParse = preprocessed !== null ? preprocessed : opts.raw;
  const parsed = parseIntakeText(rawForParse, opts.kind);
  const leftover = scrubCorruptIntakeText(
    intakeAiLeftover(rawForParse, parsed, opts.source)
  );
  if (!leftover) return parsed;
  if (!leftoverNeedsAi(leftover, parsed)) {
    return {
      ...parsed,
      options: [...parsed.options],
      notes: appendIntakeMemo(parsed.notes, leftover),
    };
  }
  if (opts.signal?.aborted) return parsed;
  const patch = await requestIntakeAi({
    leftover,
    kind: opts.kind,
    source: opts.source,
    parsed,
    accessToken: opts.accessToken,
    signal: opts.signal,
  });
  if (!patch) return parsed;
  return mergeIntakeAi(parsed, patch, leftover);
}
