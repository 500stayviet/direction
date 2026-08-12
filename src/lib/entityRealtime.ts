"use client";

import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { loadAppAuth } from "@/lib/supabase/appAuth";
import { createClient } from "@/lib/supabase/client";
import {
  applyRealtimeEntityChange,
  getMyWorkspaceId,
  refreshAllEntityLists,
} from "@/lib/storage";

const TABLES = ["customers", "listed_properties", "schedules"] as const;

let generation = 0;
let active: RealtimeChannel | null = null;

async function ensureRealtimeAuth(): Promise<boolean> {
  const app = loadAppAuth();
  if (!app?.access_token?.trim() || !app.refresh_token?.trim()) return false;
  const supabase = createClient();
  try {
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token === app.access_token) return true;
    const { error } = await supabase.auth.setSession({
      access_token: app.access_token,
      refresh_token: app.refresh_token,
    });
    return !error;
  } catch {
    return false;
  }
}

async function dropChannel(channel: RealtimeChannel | null) {
  if (!channel) return;
  try {
    await createClient().removeChannel(channel);
  } catch {
    /* ignore */
  }
}

function onChange(
  payload: RealtimePostgresChangesPayload<Record<string, unknown>>
) {
  void applyRealtimeEntityChange({
    table: payload.table,
    eventType: payload.eventType,
    newRecord: payload.new as Record<string, unknown>,
    oldRecord: payload.old as Record<string, unknown>,
  });
}

export async function stopEntityRealtime(): Promise<void> {
  generation += 1;
  const channel = active;
  active = null;
  await dropChannel(channel);
}

/** 화면이 앞에 있을 때만 구독. 숨기면 끊고, 다시 보이면 목록 한 번 맞춘 뒤 재구독 */
export async function startEntityRealtime(userId: string): Promise<void> {
  const mine = ++generation;
  const prev = active;
  active = null;
  await dropChannel(prev);

  if (!(await ensureRealtimeAuth())) return;
  if (mine !== generation) return;

  await refreshAllEntityLists();
  if (mine !== generation) return;
  if (typeof document !== "undefined" && document.visibilityState !== "visible") {
    return;
  }

  const workspaceId = await getMyWorkspaceId();
  if (mine !== generation) return;

  const supabase = createClient();
  const channel = supabase.channel(`entity-live:${userId}`);

  for (const table of TABLES) {
    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table,
        filter: `user_id=eq.${userId}`,
      },
      onChange
    );
    if (workspaceId) {
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          filter: `workspace_id=eq.${workspaceId}`,
        },
        onChange
      );
    }
  }

  await channel.subscribe();
  if (mine !== generation) {
    await dropChannel(channel);
    return;
  }
  active = channel;
}
