const SIGNUP_DRAFT_KEY = "direction.signupDraft";

export type SignupDraftUsernameCheck =
  | { status: "idle" }
  | { status: "ok"; username: string; message: string }
  | { status: "taken"; username: string; message: string }
  | { status: "error"; message: string };

export type SignupDraft = {
  shopName: string;
  name: string;
  username: string;
  password: string;
  passwordConfirm: string;
  phone: string;
  passwordHint: string;
  eventCode: string;
  agreed: boolean;
  usernameCheck: SignupDraftUsernameCheck;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function readSignupDraft(): SignupDraft | null {
  try {
    const raw = sessionStorage.getItem(SIGNUP_DRAFT_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return null;
    return {
      shopName: String(parsed.shopName ?? ""),
      name: String(parsed.name ?? ""),
      username: String(parsed.username ?? ""),
      password: String(parsed.password ?? ""),
      passwordConfirm: String(parsed.passwordConfirm ?? ""),
      phone: String(parsed.phone ?? ""),
      passwordHint: String(parsed.passwordHint ?? ""),
      eventCode: String(parsed.eventCode ?? ""),
      agreed: parsed.agreed === true,
      usernameCheck: parseUsernameCheck(parsed.usernameCheck),
    };
  } catch {
    return null;
  }
}

function parseUsernameCheck(value: unknown): SignupDraftUsernameCheck {
  if (!isRecord(value)) return { status: "idle" };
  const status = value.status;
  if (status === "ok" || status === "taken") {
    const username = String(value.username ?? "");
    const message = String(value.message ?? "");
    if (!username) return { status: "idle" };
    return { status, username, message };
  }
  if (status === "error") {
    return { status: "error", message: String(value.message ?? "") };
  }
  return { status: "idle" };
}

export function writeSignupDraft(draft: SignupDraft): void {
  try {
    sessionStorage.setItem(SIGNUP_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    /* ignore */
  }
}

export function clearSignupDraft(): void {
  try {
    sessionStorage.removeItem(SIGNUP_DRAFT_KEY);
  } catch {
    /* ignore */
  }
}
