"use client";

import { useEffect, useState } from "react";
import { fetchWorkspaceStatus } from "@/lib/workspace";

/** 팀 공유 공간에 속해 있으면 true. 등록 폼에서 팀공유 유무를 켤 때 사용 */
export function useHasTeam(enabled = true): boolean {
  const [hasTeam, setHasTeam] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void fetchWorkspaceStatus().then((ws) => {
      if (cancelled || !ws.ok) return;
      setHasTeam(Boolean(ws.workspace));
    });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return hasTeam;
}
