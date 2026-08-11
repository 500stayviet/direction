"use client";

import { getAccessToken } from "@/lib/auth";

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

async function parseJson<T>(
  res: Response
): Promise<T & { message?: string; ok?: boolean }> {
  return (await res.json()) as T & { message?: string; ok?: boolean };
}

const LOGIN_AGAIN = "로그인이 만료되었습니다. 다시 로그인한 뒤 시도해 주세요.";

export async function fetchWorkspaceStatus(): Promise<WorkspaceInfo | null> {
  const token = await getAccessToken();
  if (!token) return null;
  const res = await fetch("/api/workspace/status", {
    method: "GET",
    headers: await authHeaders(),
  });
  const body = await parseJson<{ workspace?: WorkspaceInfo | null }>(res);
  if (!res.ok) return null;
  return body.workspace ?? null;
}

export async function createWorkspace(name?: string): Promise<
  { ok: true; workspace: WorkspaceInfo } | { ok: false; message: string }
> {
  const token = await getAccessToken();
  if (!token) return { ok: false, message: LOGIN_AGAIN };

  const res = await fetch("/api/workspace/create", {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ name, accessToken: token }),
  });
  const body = await parseJson<{ workspace?: WorkspaceInfo }>(res);
  if (!res.ok || !body.workspace) {
    if (res.status === 401) return { ok: false, message: LOGIN_AGAIN };
    return {
      ok: false,
      message: body.message ?? "팀 공유 생성에 실패했습니다.",
    };
  }
  return { ok: true, workspace: body.workspace };
}

export async function joinWorkspace(shareCode: string): Promise<
  { ok: true; workspace: WorkspaceInfo } | { ok: false; message: string }
> {
  const token = await getAccessToken();
  if (!token) return { ok: false, message: LOGIN_AGAIN };

  const res = await fetch("/api/workspace/join", {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ shareCode, accessToken: token }),
  });
  const body = await parseJson<{ workspace?: WorkspaceInfo }>(res);
  if (!res.ok || !body.workspace) {
    if (res.status === 401) return { ok: false, message: LOGIN_AGAIN };
    return { ok: false, message: body.message ?? "팀 참여에 실패했습니다." };
  }
  return { ok: true, workspace: body.workspace };
}

export async function reissueShareCode(): Promise<
  { ok: true; workspace: WorkspaceInfo } | { ok: false; message: string }
> {
  const token = await getAccessToken();
  if (!token) return { ok: false, message: LOGIN_AGAIN };

  const res = await fetch("/api/workspace/reissue", {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ accessToken: token }),
  });
  const body = await parseJson<{ workspace?: WorkspaceInfo }>(res);
  if (!res.ok || !body.workspace) {
    if (res.status === 401) return { ok: false, message: LOGIN_AGAIN };
    return { ok: false, message: body.message ?? "코드 재발급에 실패했습니다." };
  }
  return { ok: true, workspace: body.workspace };
}
