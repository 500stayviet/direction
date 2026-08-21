const STORAGE_PREFIX = "realty_notified_pairs_v1";

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}:${userId}`;
}

export function loadNotifiedPairKeys(userId: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as string[];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

export function rememberNotifiedPairKey(userId: string, channelKey: string): void {
  if (typeof window === "undefined" || !userId || !channelKey) return;
  const set = loadNotifiedPairKeys(userId);
  set.add(channelKey);
  const capped = [...set].slice(-500);
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(capped));
  } catch {
    /* ignore */
  }
}

/** web-notification vs web-push 중복 방지용 */
export function channelKeyForPair(
  kind: "match" | "newMatch",
  pairKey: string,
  channel: "web" | "push"
): string {
  return `${channel}:${kind}:${pairKey}`;
}

export function clearNotifiedPairs(userId: string): void {
  if (typeof window === "undefined" || !userId) return;
  try {
    localStorage.removeItem(storageKey(userId));
  } catch {
    /* ignore */
  }
}
