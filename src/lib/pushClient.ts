"use client";

import { getAccessToken } from "@/lib/auth";
import { pushEnvReady } from "@/lib/pwaDetect";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64Safe);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export async function registerAppServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }
  try {
    return await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch {
    return null;
  }
}

export async function subscribeWebPush(userId: string): Promise<boolean> {
  if (!pushEnvReady() || !userId) return false;
  const reg = await registerAppServiceWorker();
  if (!reg) return false;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!.trim();
  let sub: PushSubscription | null;
  try {
    sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });
    }
  } catch {
    return false;
  }

  const token = await getAccessToken();
  if (!token) return false;

  const json = sub.toJSON();
  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      endpoint: json.endpoint,
      keys: json.keys,
      userAgent: navigator.userAgent,
    }),
  });
  return res.ok;
}

export async function unsubscribeWebPush(): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;

  const token = await getAccessToken();
  if (token) {
    await fetch("/api/push/unsubscribe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    }).catch(() => undefined);
  }
  await sub.unsubscribe().catch(() => undefined);
}

export async function syncWebPushSubscription(userId: string | null): Promise<void> {
  if (!userId || !pushEnvReady()) return;
  if (typeof Notification === "undefined") return;
  if (Notification.permission !== "granted") return;
  await subscribeWebPush(userId).catch(() => false);
}
