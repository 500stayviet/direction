"use client";

import {
  channelKeyForPair,
  loadNotifiedPairKeys,
  rememberNotifiedPairKey,
} from "@/lib/notifiedPairsLocal";
import {
  formatMatchAlertBody,
  formatMatchAlertTitle,
  parseMatchPairKey,
  type MatchAlertKind,
} from "@/lib/alertMessaging";
import type { Customer, ListedProperty } from "@/lib/types";

const PROMPT_KEY = "realty_web_notif_prompt_v1";

function localDateKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function promptStorageKey(userId: string): string {
  return `${PROMPT_KEY}:${userId}`;
}

export function getWebNotificationPermission(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission;
}

/** 권한이 기본이고, 「나중에」를 누른 당일이 아니면 다시 띄움 */
export function shouldShowWebNotificationPrompt(userId: string | null): boolean {
  if (!userId || typeof window === "undefined") return false;
  if (!("Notification" in window)) return false;
  if (Notification.permission !== "default") return false;
  try {
    const raw = localStorage.getItem(promptStorageKey(userId));
    if (!raw) return true;
    if (raw === "1") return true;
    return raw !== localDateKey();
  } catch {
    return true;
  }
}

/** 「나중에」— 오늘 하루 숨기고 다음날 다시 묻기 */
export function markWebNotificationPromptSeen(userId: string): void {
  try {
    localStorage.setItem(promptStorageKey(userId), localDateKey());
  } catch {
    /* ignore */
  }
}

export async function requestWebNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (!("Notification" in window)) return "unsupported";
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

export function showMatchWebNotification(input: {
  userId: string;
  kind: MatchAlertKind;
  pairKey: string;
  customer: Customer;
  property: ListedProperty;
  url: string;
  side?: "customer" | "property";
}): boolean {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission !== "granted") return false;

  const ck = channelKeyForPair(input.kind, input.pairKey, "web");
  const seen = loadNotifiedPairKeys(input.userId);
  if (seen.has(ck)) return false;

  try {
    const n = new Notification(formatMatchAlertTitle(input.kind), {
      body: formatMatchAlertBody(input.customer, input.property, {
        kind: input.kind,
        side: input.side,
      }),
      icon: "/icon-192.png?v=20260823d",
      tag: ck,
      data: { url: input.url },
    });
    n.onclick = () => {
      window.focus();
      if (input.url) window.location.assign(input.url);
    };
    rememberNotifiedPairKey(input.userId, ck);
    return true;
  } catch {
    return false;
  }
}

export function resolveEntitiesForPair(
  pairKey: string,
  customers: Customer[],
  properties: ListedProperty[]
): { customer: Customer; property: ListedProperty } | null {
  const parsed = parseMatchPairKey(pairKey);
  if (!parsed) return null;
  const customer = customers.find((c) => c.id === parsed.customerId);
  const property = properties.find((p) => p.id === parsed.propertyId);
  if (!customer || !property) return null;
  return { customer, property };
}
