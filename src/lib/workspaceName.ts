export const WORKSPACE_NAME_MAX = 20;

export function normalizeWorkspaceName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, WORKSPACE_NAME_MAX);
}
