export const INTAKE_AI_LIMITS = {
  userPerMinute: 8,
  userPerHour: 40,
  userPerDay: 80,
  globalPerHour: 200,
  duplicateMs: 90_000,
  rateLogGapMs: 10 * 60 * 1000,
} as const;

export type IntakeAiGuardReason = "rate" | "duplicate";

export type IntakeAiGuardDecision =
  | { allow: true }
  | { allow: false; reason: IntakeAiGuardReason; log: boolean };

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

const userHits = new Map<string, number[]>();
const globalHits: number[] = [];
const recentLeftover = new Map<string, number>();
const rateLogAt = new Map<string, number>();
const errorLogAt = new Map<string, number>();

function pruneList(list: number[], now: number, windowMs: number): number[] {
  const from = now - windowMs;
  let i = 0;
  while (i < list.length && list[i] < from) i += 1;
  if (i > 0) list.splice(0, i);
  return list;
}

function countSince(list: number[], now: number, windowMs: number): number {
  const from = now - windowMs;
  let n = 0;
  for (let i = list.length - 1; i >= 0; i -= 1) {
    if (list[i] < from) break;
    n += 1;
  }
  return n;
}

export function resetIntakeAiGuardForTests(): void {
  userHits.clear();
  globalHits.length = 0;
  recentLeftover.clear();
  rateLogAt.clear();
  errorLogAt.clear();
}

/** 같은 [AI] 에러가 연속이면 관리자 탭만 조용히. 다음 요청은 다시 DeepSeek를 시도한다. */
export function shouldLogIntakeAiError(kind: string, now = Date.now()): boolean {
  const key = kind.trim() || "unknown";
  const prev = errorLogAt.get(key) ?? 0;
  if (now - prev < INTAKE_AI_LIMITS.rateLogGapMs) return false;
  errorLogAt.set(key, now);
  return true;
}

export function isIntakeAiKeyConfigured(key = process.env.DEEPSEEK_API_KEY): boolean {
  return Boolean(key?.trim());
}

export function decideIntakeAiCall(opts: {
  userId: string;
  leftover: string;
  now?: number;
}): IntakeAiGuardDecision {
  const now = opts.now ?? Date.now();
  const userId = opts.userId.trim();
  const leftover = opts.leftover.replace(/\s+/g, " ").trim();
  if (!userId || leftover.length < 2) {
    return { allow: false, reason: "rate", log: false };
  }

  const dupKey = `${userId}:${leftover}`;
  const lastDup = recentLeftover.get(dupKey) ?? 0;
  if (now - lastDup < INTAKE_AI_LIMITS.duplicateMs) {
    return { allow: false, reason: "duplicate", log: false };
  }

  const userList = pruneList(userHits.get(userId) ?? [], now, DAY_MS);
  pruneList(globalHits, now, HOUR_MS);

  const overLimit =
    countSince(userList, now, MINUTE_MS) >= INTAKE_AI_LIMITS.userPerMinute ||
    countSince(userList, now, HOUR_MS) >= INTAKE_AI_LIMITS.userPerHour ||
    userList.length >= INTAKE_AI_LIMITS.userPerDay ||
    globalHits.length >= INTAKE_AI_LIMITS.globalPerHour;

  if (overLimit) {
    const prevLog = rateLogAt.get(userId) ?? 0;
    const log = now - prevLog >= INTAKE_AI_LIMITS.rateLogGapMs;
    if (log) rateLogAt.set(userId, now);
    return { allow: false, reason: "rate", log };
  }

  userList.push(now);
  userHits.set(userId, userList);
  globalHits.push(now);
  recentLeftover.set(dupKey, now);

  if (recentLeftover.size > 2000) {
    for (const [key, at] of recentLeftover) {
      if (now - at > INTAKE_AI_LIMITS.duplicateMs) recentLeftover.delete(key);
    }
  }
  return { allow: true };
}
