import { createHash } from "node:crypto";
import type { IntakeKind, IntakeParseResult } from "@/lib/intakeParse";

export type IntakeSampleSource = "message" | "photo";
export type IntakeSampleStatus = "new" | "exported" | "reviewed";

const TRACKED_FIELDS: (keyof IntakeParseResult)[] = [
  "roomType",
  "roomCount",
  "bathroomCount",
  "dealType",
  "deposit",
  "monthlyRent",
  "maintenanceFee",
  "gu",
  "dong",
  "jibun",
  "roomNo",
  "moveInFrom",
  "moveInImmediate",
  "loan",
  "insurance",
  "parking",
  "elevator",
  "name",
  "phone",
];

export function hashIntakeSampleText(text: string): string {
  return createHash("sha256")
    .update(text.replace(/\s+/g, " ").trim())
    .digest("hex")
    .slice(0, 32);
}

export function maskIntakeSampleText(text: string): string {
  return text
    .replace(/0\d{1,2}[-.\s]?\d{3,4}[-.\s]?\d{4}/g, (match) => {
      const digits = match.replace(/\D/g, "");
      if (digits.length < 10) return "****";
      return `${digits.slice(0, 3)}****${digits.slice(-4)}`;
    })
    .replace(/(?:\+82\s*)?1[016789][-.\s]?\d{3,4}[-.\s]?\d{4}/g, "****");
}

export function sanitizeParsedForSample(
  parsed: IntakeParseResult
): IntakeParseResult {
  return {
    ...parsed,
    name: parsed.name ? "[이름]" : undefined,
    nameLabeled: parsed.nameLabeled ? true : undefined,
    phone: parsed.phone ? "****" : undefined,
    tenantPhone: parsed.tenantPhone ? "****" : undefined,
    landlordPhone: parsed.landlordPhone ? "****" : undefined,
  };
}

export function listMissingIntakeFields(parsed: IntakeParseResult): string[] {
  const missing: string[] = [];
  for (const key of TRACKED_FIELDS) {
    const value = parsed[key];
    if (value == null) missing.push(key);
    else if (typeof value === "string" && !value.trim()) missing.push(key);
  }
  return missing;
}

export function shouldRecordIntakeSample(raw: string): boolean {
  const trimmed = raw.replace(/\s+/g, " ").trim();
  return trimmed.length >= 8 && /[가-힣0-9]/.test(trimmed);
}

export async function recordIntakeSample(opts: {
  raw: string;
  kind: IntakeKind;
  source: IntakeSampleSource;
  parsed: IntakeParseResult;
  accessToken?: string | null;
}): Promise<void> {
  if (typeof window === "undefined") return;
  if (!shouldRecordIntakeSample(opts.raw)) return;

  const maskedRaw = maskIntakeSampleText(opts.raw);
  const payload = {
    kind: opts.kind,
    source: opts.source,
    rawText: maskedRaw,
    parsed: sanitizeParsedForSample(opts.parsed),
    missingFields: listMissingIntakeFields(opts.parsed),
  };

  try {
    const headers: HeadersInit = { "Content-Type": "application/json" };
    const token = opts.accessToken?.trim();
    if (token) headers.Authorization = `Bearer ${token}`;

    await fetch("/api/intake-samples/collect", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch {
    /* 수집 실패는 입력 흐름을 막지 않음 */
  }
}
