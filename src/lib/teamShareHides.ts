"use client";

import { peekCurrentUser } from "@/lib/auth";

export type HideBucket = "customers" | "properties" | "schedules";

type HideState = Record<HideBucket, string[]>;

const STORAGE_PREFIX = "realty_team_share_hides_v1";

const emptyState = (): HideState => ({
  customers: [],
  properties: [],
  schedules: [],
});

let userId: string | null = null;
let state: HideState = emptyState();

function storageKey(uid: string) {
  return `${STORAGE_PREFIX}:${uid}`;
}

function persist() {
  if (typeof window === "undefined" || !userId) return;
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

function load(uid: string): HideState {
  if (typeof window === "undefined") return emptyState();
  try {
    const raw = localStorage.getItem(storageKey(uid));
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<HideState>;
    return {
      customers: Array.isArray(parsed.customers) ? parsed.customers : [],
      properties: Array.isArray(parsed.properties) ? parsed.properties : [],
      schedules: Array.isArray(parsed.schedules) ? parsed.schedules : [],
    };
  } catch {
    return emptyState();
  }
}

export function ensureTeamShareHidesUser(uid: string | null) {
  if (!uid) {
    userId = null;
    state = emptyState();
    return;
  }
  if (userId === uid) return;
  userId = uid;
  state = load(uid);
}

function ready(): boolean {
  const uid = peekCurrentUser()?.id ?? userId;
  ensureTeamShareHidesUser(uid ?? null);
  return Boolean(userId);
}

export function hideBucketForTable(
  table: "customers" | "listed_properties" | "schedules"
): HideBucket {
  if (table === "listed_properties") return "properties";
  if (table === "schedules") return "schedules";
  return "customers";
}

export function isSharedEntityHidden(bucket: HideBucket, id: string): boolean {
  if (!ready() || !id) return false;
  return state[bucket].includes(id);
}

export function hideSharedEntity(bucket: HideBucket, id: string) {
  if (!ready() || !id) return;
  if (state[bucket].includes(id)) return;
  state = { ...state, [bucket]: [...state[bucket], id] };
  persist();
}

export function unhideSharedEntity(bucket: HideBucket, id: string) {
  if (!ready() || !id) return;
  if (!state[bucket].includes(id)) return;
  state = { ...state, [bucket]: state[bucket].filter((x) => x !== id) };
  persist();
}

/** 서버에 더 이상 공유되지 않는 id는 숨김 해제 → 다시 켜면 보임 */
export function pruneHiddenToLiveIds(bucket: HideBucket, liveIds: string[]) {
  if (!ready()) return;
  const live = new Set(liveIds);
  const next = state[bucket].filter((id) => live.has(id));
  if (next.length === state[bucket].length) return;
  state = { ...state, [bucket]: next };
  persist();
}
