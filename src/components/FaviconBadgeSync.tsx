"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import {
  getTeamAlertsSnapshot,
  subscribeTeamAlerts,
} from "@/lib/teamAlerts";
import { totalUnseenFromState } from "@/lib/alertCounts";
import {
  getAuthEpoch,
  peekCurrentUser,
  subscribeAuthChange,
} from "@/lib/auth";

const DEFAULT_ICON = "/icon.svg";

function useAlertSnap() {
  return useSyncExternalStore(
    subscribeTeamAlerts,
    getTeamAlertsSnapshot,
    getTeamAlertsSnapshot
  );
}

function useLoggedIn(): boolean {
  const epoch = useSyncExternalStore(
    subscribeAuthChange,
    getAuthEpoch,
    () => 0
  );
  return Boolean(peekCurrentUser()?.id);
}

function drawBadgeIcon(count: number): string | null {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = "#3182F6";
  ctx.beginPath();
  ctx.roundRect(8, 8, 48, 48, 12);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = "bold 28px system-ui,sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(count > 9 ? "9+" : String(count), 32, 34);

  ctx.fillStyle = "#EF4444";
  ctx.beginPath();
  ctx.arc(52, 12, 10, 0, Math.PI * 2);
  ctx.fill();

  return canvas.toDataURL("image/png");
}

/** 파비콘에 unseen 숫자 표시 (지원 브라우저) */
export function FaviconBadgeSync() {
  const snap = useAlertSnap();
  const loggedIn = useLoggedIn();
  const linkRef = useRef<HTMLLinkElement | null>(null);

  useEffect(() => {
    if (typeof document === "undefined") return;

    let link =
      document.querySelector<HTMLLinkElement>('link[rel="icon"][data-alert-sync]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      link.setAttribute("data-alert-sync", "1");
      document.head.appendChild(link);
    }
    linkRef.current = link;

    return () => {
      if (linkRef.current) {
        linkRef.current.href = DEFAULT_ICON;
      }
    };
  }, []);

  useEffect(() => {
    const link = linkRef.current;
    if (!link) return;
    if (!loggedIn) {
      link.href = DEFAULT_ICON;
      return;
    }
    const total = totalUnseenFromState(snap);
    if (total <= 0) {
      link.href = DEFAULT_ICON;
      return;
    }
    const dataUrl = drawBadgeIcon(total);
    link.href = dataUrl ?? DEFAULT_ICON;
  }, [loggedIn, snap]);

  return null;
}
