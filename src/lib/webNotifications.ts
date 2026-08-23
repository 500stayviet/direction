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

export function getWebNotificationPermission(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission;
}

export function shouldShowWebNotificationPrompt(userId: string | null): boolean {
  if (!userId || typeof window === "undefined") return false;
  if (!("Notification" in window)) return false;
  if (Notification.permission !== "default") return false;
  try {
    return localStorage.getItem(`${PROMPT_KEY}:${userId}`) !== "1";
  } catch {
    return true;
  }
}

export function markWebNotificationPromptSeen(userId: string): void {
  try {
    localStorage.setItem(`${PROMPT_KEY}:${userId}`, "1");
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
}): boolean {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission !== "granted") return false;

  const ck = channelKeyForPair(input.kind, input.pairKey, "web");
  const seen = loadNotifiedPairKeys(input.userId);
  if (seen.has(ck)) return false;

  try {
    const n = new Notification(formatMatchAlertTitle(input.kind), {
      body: formatMatchAlertBody(input.customer, input.property),
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
