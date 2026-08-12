"use client";

import { forceRelogin, getAccessToken } from "@/lib/auth";
import {
  invalidateWorkspaceIdCache,
  refreshAllEntityLists,
} from "@/lib/storage";

export type WorkspaceMemberInfo = {
  userId: string;
  role: "owner" | "member";
  shopName: string;
  name: string;
  username: string;
};

export type WorkspaceInfo = {
  workspaceId: string;
  role: "owner" | "member";
  displayName: string;
  shareCode: string;
  shareCodeExpiresAt: string | null;
  shareCodeValid: boolean;
  workspaceName: string;
  memberCount: number;
  members?: WorkspaceMemberInfo[];
};

async function authHeaders(): Promise<HeadersInit> {
  const token = (await getAccessToken()) ?? "";
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

const NETWORK_FAIL =
  "네트워크 연결을 확인해 주세요. 잠시 후 다시 시도해 주세요.";

function isNetworkError(e: unknown): boolean {
  return (
    e instanceof TypeError ||
    (e instanceof Error &&
      /failed to fetch|networkerror|load failed/i.test(e.message))
  );
}

/** 세션 없음/401 → 로그인 화면으로 (문구 대신) */
function handleAuthExpired(): { ok: false; message: string } {
  forceRelogin();
  return { ok: false, message: "" };
}

async function safeFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch (e) {
    if (isNetworkError(e)) {
      throw new Error(NETWORK_FAIL);
    }
    throw e;
  }
}

async function parseJson<T>(
  res: Response
): Promise<T & { message?: string; ok?: boolean }> {
  try {
    return (await res.json()) as T & { message?: string; ok?: boolean };
  } catch {
    return { message: "서버 응답을 읽지 못했습니다." } as T & {
      message?: string;
      ok?: boolean;
    };
  }
}

export async function fetchWorkspaceStatus(): Promise<
  | { ok: true; workspace: WorkspaceInfo | null }
  | { ok: false; message: string }
> {
  const token = await getAccessToken();
  if (!token) {
    return handleAuthExpired();
  }
  try {
    const res = await safeFetch("/api/workspace/status", {
      method: "GET",
      headers: await authHeaders(),
      cache: "no-store",
    });
    const body = await parseJson<{ workspace?: WorkspaceInfo | null }>(res);
    if (!res.ok) {
      if (res.status === 401) return handleAuthExpired();
      return {
        ok: false,
        message: body.message ?? "팀 공유 상태를 불러오지 못했습니다.",
      };
    }
    return { ok: true, workspace: body.workspace ?? null };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "팀 공유 상태를 불러오지 못했습니다.",
    };
  }
}

export async function createWorkspace(name?: string): Promise<
  { ok: true; workspace: WorkspaceInfo } | { ok: false; message: string }
> {
  const token = await getAccessToken();
  if (!token) return handleAuthExpired();

  try {
    const res = await safeFetch("/api/workspace/create", {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ name, accessToken: token }),
    });
    const body = await parseJson<{ workspace?: WorkspaceInfo }>(res);
    if (!res.ok || !body.workspace) {
      if (res.status === 401) return handleAuthExpired();
      return {
        ok: false,
        message: body.message ?? "팀 공유 생성에 실패했습니다.",
      };
    }
    invalidateWorkspaceIdCache();
    return { ok: true, workspace: body.workspace };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "팀 공유 생성에 실패했습니다.",
    };
  }
}

export async function joinWorkspace(shareCode: string): Promise<
  { ok: true; workspace: WorkspaceInfo } | { ok: false; message: string }
> {
  const token = await getAccessToken();
  if (!token) return handleAuthExpired();

  try {
    const res = await safeFetch("/api/workspace/join", {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ shareCode, accessToken: token }),
    });
    const body = await parseJson<{ workspace?: WorkspaceInfo }>(res);
    if (!res.ok || !body.workspace) {
      if (res.status === 401) return handleAuthExpired();
      return { ok: false, message: body.message ?? "팀 참여에 실패했습니다." };
    }
    // 팀 참여 직후 캐시된 목록·업장 id를 버리고 고객·매물·일정 다시 받기
    invalidateWorkspaceIdCache();
    await refreshAllEntityLists();
    return { ok: true, workspace: body.workspace };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "팀 참여에 실패했습니다.",
    };
  }
}

export async function reissueShareCode(): Promise<
  { ok: true; workspace: WorkspaceInfo } | { ok: false; message: string }
> {
  const token = await getAccessToken();
  if (!token) return handleAuthExpired();

  try {
    const res = await safeFetch("/api/workspace/reissue", {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ accessToken: token }),
    });
    const body = await parseJson<{ workspace?: WorkspaceInfo }>(res);
    if (!res.ok || !body.workspace) {
      if (res.status === 401) return handleAuthExpired();
      return {
        ok: false,
        message: body.message ?? "코드 재발급에 실패했습니다.",
      };
    }
    return { ok: true, workspace: body.workspace };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "코드 재발급에 실패했습니다.",
    };
  }
}
