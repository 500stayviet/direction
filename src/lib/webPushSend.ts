import webpush from "web-push";
import {
  deepLinkForMatchPair,
  deepLinkForShareAlert,
  formatMatchAlertBody,
  formatMatchAlertTitle,
  formatShareAlertBody,
  formatShareAlertTitle,
} from "@/lib/alertMessaging";
import type { Customer, ListedProperty } from "@/lib/types";

export type PushSubscriptionRow = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

let configured = false;

export function isWebPushConfigured(): boolean {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim();
  return Boolean(publicKey && privateKey && subject);
}

function ensureWebPushConfigured(): boolean {
  if (configured) return true;
  if (!isWebPushConfigured()) return false;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!.trim(),
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!.trim(),
    process.env.VAPID_PRIVATE_KEY!.trim()
  );
  configured = true;
  return true;
}

export async function sendMatchWebPush(input: {
  subscription: PushSubscriptionRow;
  kind: "match" | "newMatch";
  customer: Customer;
  property: ListedProperty;
  customerId: string;
  propertyId: string;
  side?: "customer" | "property";
  origin: string;
}): Promise<boolean> {
  if (!ensureWebPushConfigured()) return false;

  const path = deepLinkForMatchPair(
    input.customerId,
    input.propertyId,
    input.side ?? "customer"
  );
  const url = `${input.origin.replace(/\/$/, "")}${path}`;
  const payload = JSON.stringify({
    title: formatMatchAlertTitle(input.kind),
    body: formatMatchAlertBody(input.customer, input.property, {
      kind: input.kind,
      side: input.side,
    }),
    url,
    tag: `${input.kind}:${input.customerId}::${input.propertyId}`,
  });

  try {
    await webpush.sendNotification(
      {
        endpoint: input.subscription.endpoint,
        keys: {
          p256dh: input.subscription.p256dh,
          auth: input.subscription.auth,
        },
      },
      payload
    );
    return true;
  } catch (err: unknown) {
    const status = (err as { statusCode?: number })?.statusCode;
    if (status === 404 || status === 410) {
      return false;
    }
    throw err;
  }
}

export async function sendShareWebPush(input: {
  subscription: PushSubscriptionRow;
  tab: "customers" | "properties" | "navi";
  entityId: string;
  label: string;
  origin: string;
}): Promise<boolean> {
  if (!ensureWebPushConfigured()) return false;

  const path = deepLinkForShareAlert(input.tab, input.entityId);
  const url = `${input.origin.replace(/\/$/, "")}${path}`;
  const payload = JSON.stringify({
    title: formatShareAlertTitle(),
    body: formatShareAlertBody(input.label),
    url,
    tag: `share:${input.tab}:${input.entityId}`,
  });

  try {
    await webpush.sendNotification(
      {
        endpoint: input.subscription.endpoint,
        keys: {
          p256dh: input.subscription.p256dh,
          auth: input.subscription.auth,
        },
      },
      payload
    );
    return true;
  } catch (err: unknown) {
    const status = (err as { statusCode?: number })?.statusCode;
    if (status === 404 || status === 410) {
      return false;
    }
    throw err;
  }
}

export function resolveOrigin(request: Request): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") || "https";
  if (host) return `${proto}://${host}`;
  return "https://localhost:3000";
}
