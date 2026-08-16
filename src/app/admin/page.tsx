"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { formatSeoulDateTime, todayISO, toISODate } from "@/lib/date";
import { planDisplayForUser } from "@/lib/planDisplay";
import { PlanBadge } from "@/components/PlanBadge";
import { IntakeParserAdminPanel } from "@/components/admin/IntakeParserAdminPanel";

function daysAgoISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return toISODate(d);
}

const AUTH_STORAGE = "realty_admin_session_v2";
const ERROR_SEEN_STORAGE = "realty_admin_error_seen_at_v1";

function readErrorSeenAt(): string | null {
  try {
    const raw = sessionStorage.getItem(ERROR_SEEN_STORAGE);
    if (!raw) return null;
    return Number.isNaN(Date.parse(raw)) ? null : raw;
  } catch {
    return null;
  }
}

function writeErrorSeenAt(iso: string) {
  try {
    sessionStorage.setItem(ERROR_SEEN_STORAGE, iso);
  } catch {
    /* ignore */
  }
}

type AdminRole = "super" | "staff";
type Tab = "accounts" | "properties" | "search" | "teams" | "deleted" | "staff" | "events" | "parser" | "errors" | "logs";

type Session = {
  id: string;
  username: string;
  displayName: string;
  title: string;
  role: AdminRole;
  token: string;
};

type Summary = {
  profiles: number;
  workspaces: number;
  customersActive: number;
  customersDeleted: number;
  propertiesActive: number;
  propertiesDeleted: number;
  schedulesActive: number;
  schedulesDeleted: number;
  deletedAccounts: number;
  todayVisitors: number;
  todaySignups: number;
};

type AccountListItem = {
  id: string;
  username: string;
  shopName: string;
  name: string;
  phone: string;
  createdAt: string;
};

type PropertyListItem = {
  id: string;
  userId: string;
  roomType: string;
  dealType: string;
  money: string;
  address: string;
  createdByName: string;
  username: string;
  shopName: string;
  createdAt: string;
};

type AccountDetail = {
  id: string;
  username: string;
  shopName: string;
  name: string;
  phone: string;
  passwordHint?: string;
  createdAt: string;
  status?: "active" | "suspended" | "deleted";
  suspendedAt?: string | null;
  suspendedReason?: string | null;
  planTier?: string;
  matchingEnabled?: boolean;
  promoSource?: string | null;
  counts: {
    customersActive: number;
    customersDeleted: number;
    propertiesActive: number;
    propertiesDeleted: number;
    schedulesActive: number;
    schedulesDeleted: number;
  };
  team: {
    workspaceId: string;
    name: string;
    role: string;
    memberCount: number;
  } | null;
};

type EntityKind = "customers" | "properties" | "schedules";
type EntityScope = "active" | "deleted" | "all";

type EntityRow = {
  id: string;
  title: string;
  subtitle: string;
  shared: boolean;
  deleted: boolean;
  updatedAt?: string;
};

type EntityDetailField = {
  label: string;
  value: string;
  secretKey?: string;
};

type EntityItemDetail = {
  id: string;
  kind: EntityKind;
  title: string;
  fields: EntityDetailField[];
  slots?: { title: string; fields: EntityDetailField[] }[];
  routes?: string[];
  secrets?: Record<string, string>;
  shared?: boolean;
  deleted?: boolean;
  createdByName?: string;
  updatedAt?: string;
  createdAt?: string;
  owner?: {
    id: string;
    username: string;
    shopName: string;
    name: string;
    phone: string;
    createdAt: string;
  } | null;
};

function resolveDetailField(
  field: EntityDetailField,
  reveal: boolean,
  secrets?: Record<string, string>
): string {
  if (
    reveal &&
    field.secretKey &&
    secrets?.[field.secretKey]
  ) {
    const raw = secrets[field.secretKey];
    if (field.secretKey.endsWith("roomNo") || field.secretKey === "roomNo") {
      return `${raw}호`;
    }
    return raw;
  }
  return field.value;
}

type TeamItem = {
  id: string;
  name: string;
  memberCount: number;
  members: {
    userId: string;
    role: string;
    shopName: string;
    name: string;
    username: string;
  }[];
};

type DeletedRow = {
  id: string;
  user_id: string;
  created_by_name: string;
  deleted_at: string | null;
  title: string;
  ageDays: number | null;
  within30Days: boolean;
  payload?: Record<string, unknown>;
  owner?: {
    username: string;
    shopName: string;
    name: string;
    phone: string;
  } | null;
};

type PromoCodeRow = {
  id: string;
  code: string;
  benefit: string;
  startsDate: string;
  endsDate: string;
  maxUses: number | null;
  useCount: number;
  active: boolean;
  memo: string;
  createdByName: string;
  createdAt: string;
};

type EarlyBirdCampaign = {
  id: string;
  slug: string;
  benefit: string;
  startsDate: string;
  endsDate: string;
  active: boolean;
  memo: string;
};

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

function checkAdminUnauthorized(res: Response): boolean {
  if (res.status !== 401) return false;
  sessionStorage.removeItem(AUTH_STORAGE);
  return true;
}

const SUSPEND_PRESETS = [
  "허위 매물·고객 등록",
  "약관 위반",
  "스팸·비정상 이용",
  "신고 접수·조사 중",
  "기타 (직접 입력)",
] as const;

export default function AdminPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Tab>("accounts");
  const [summary, setSummary] = useState<Summary | null>(null);

  const [accounts, setAccounts] = useState<AccountListItem[]>([]);
  const [accountsHasMore, setAccountsHasMore] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [properties, setProperties] = useState<PropertyListItem[]>([]);
  const [propertiesHasMore, setPropertiesHasMore] = useState(false);
  const [propertyQ, setPropertyQ] = useState("");
  const [detail, setDetail] = useState<AccountDetail | null>(null);
  const [entityKind, setEntityKind] = useState<EntityKind>("customers");
  const [entityScope, setEntityScope] = useState<EntityScope>("active");
  const [entityQ, setEntityQ] = useState("");
  const [entityRows, setEntityRows] = useState<EntityRow[]>([]);
  const [entityTotal, setEntityTotal] = useState(0);
  const [entityHasMore, setEntityHasMore] = useState(false);
  const [entityLoading, setEntityLoading] = useState(false);
  const [entityItem, setEntityItem] = useState<EntityItemDetail | null>(null);
  const [entityReveal, setEntityReveal] = useState(false);
  const [entityOwnerOpen, setEntityOwnerOpen] = useState(false);
  /** 올린 사람 → 가입자 상세에서 뒤로 시 복원할 매물/고객/네비 상세 */
  const [returnEntityItem, setReturnEntityItem] =
    useState<EntityItemDetail | null>(null);
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [suspendPreset, setSuspendPreset] = useState<string>(SUSPEND_PRESETS[0]);
  const [suspendCustom, setSuspendCustom] = useState("");
  const [resetPasswordInfo, setResetPasswordInfo] = useState<{
    username: string;
    temporaryPassword: string;
    phone: string;
  } | null>(null);

  const [teams, setTeams] = useState<TeamItem[]>([]);
  const [teamQ, setTeamQ] = useState("");
  const [teamDetail, setTeamDetail] = useState<TeamItem | null>(null);

  const [delType, setDelType] = useState<"customers" | "properties" | "schedules">(
    "customers"
  );
  const [deletedRows, setDeletedRows] = useState<DeletedRow[]>([]);
  const [deletedQ, setDeletedQ] = useState("");
  const [deletedAccountsQ, setDeletedAccountsQ] = useState("");
  const [restoreRow, setRestoreRow] = useState<DeletedRow | null>(null);
  const [restoreToUsername, setRestoreToUsername] = useState("");

  const [deletedAccounts, setDeletedAccounts] = useState<
    {
      username: string;
      formerUserId: string;
      shopName: string;
      name: string;
      phone?: string;
      deletedAt: string;
      ageDays: number | null;
      counts: Record<string, number>;
    }[]
  >([]);

  const [staffList, setStaffList] = useState<Record<string, unknown>[]>([]);
  const [staffForm, setStaffForm] = useState({
    title: "직원",
    displayName: "",
    username: "",
    password: "",
    role: "staff" as AdminRole,
  });
  const [auditLogs, setAuditLogs] = useState<
    {
      id: string;
      actorName: string;
      action: string;
      entityType: string;
      entityId: string;
      detail: Record<string, unknown>;
      createdAt: string;
    }[]
  >([]);
  const [auditQ, setAuditQ] = useState("");
  const [auditFrom, setAuditFrom] = useState(() => daysAgoISO(30));
  const [auditTo, setAuditTo] = useState(() => todayISO());

  const [errorLogs, setErrorLogs] = useState<
    {
      id: string;
      createdAt: string;
      status: number;
      method: string;
      path: string;
      message: string;
      reportText: string;
    }[]
  >([]);
  const [errorLogQ, setErrorLogQ] = useState("");
  const [errorLogStatus, setErrorLogStatus] = useState<"all" | "4xx" | "5xx">(
    "5xx"
  );
  const [copiedErrorId, setCopiedErrorId] = useState<string | null>(null);
  const [errorBadge, setErrorBadge] = useState(0);
  const [parserNewBadge, setParserNewBadge] = useState(0);
  const [expandedErrorId, setExpandedErrorId] = useState<string | null>(null);

  const [promoCodes, setPromoCodes] = useState<PromoCodeRow[]>([]);
  const [earlyBird, setEarlyBird] = useState<EarlyBirdCampaign | null>(null);
  const [earlyBirdOpen, setEarlyBirdOpen] = useState(false);
  const [earlyBirdForm, setEarlyBirdForm] = useState({
    startsDate: todayISO(),
    endsDate: "",
    active: true,
    memo: "가입 기간 자동 평생 무료(기본)",
  });
  const [promoCreate, setPromoCreate] = useState({
    code: "",
    autoGenerate: true,
    startsDate: todayISO(),
    endsDate: "",
    maxUses: "",
    memo: "",
  });
  const [promoEdits, setPromoEdits] = useState<
    Record<string, { startsDate: string; endsDate: string }>
  >({});

  const isSuper = session?.role === "super";

  const clearSession = useCallback(() => {
    sessionStorage.removeItem(AUTH_STORAGE);
    setSession(null);
    setError("세션이 만료되었거나 계정이 비활성화되었습니다.");
  }, []);

  const loadSummary = useCallback(async (token: string) => {
    const res = await fetch("/api/admin/summary", {
      headers: authHeaders(token),
    });
    if (checkAdminUnauthorized(res)) {
      clearSession();
      return;
    }
    const body = (await res.json()) as {
      ok?: boolean;
      message?: string;
      summary?: Summary;
      session?: Omit<Session, "token">;
    };
    if (!res.ok || !body.ok) {
      throw new Error(body.message ?? "세션이 만료되었습니다.");
    }
    setSummary(body.summary ?? null);
  }, [clearSession]);

  const loadAccounts = useCallback(
    async (token: string, q = "", offset = 0) => {
      const res = await fetch(
        `/api/admin/accounts?q=${encodeURIComponent(q)}&limit=20&offset=${offset}`,
        { headers: authHeaders(token) }
      );
      if (checkAdminUnauthorized(res)) {
        clearSession();
        return;
      }
      const body = (await res.json()) as {
        ok?: boolean;
        accounts?: AccountListItem[];
        hasMore?: boolean;
        message?: string;
      };
      if (!res.ok || !body.ok) throw new Error(body.message ?? "계정 조회 실패");
      setAccounts((prev) =>
        offset > 0 ? [...prev, ...(body.accounts ?? [])] : body.accounts ?? []
      );
      setAccountsHasMore(Boolean(body.hasMore));
    },
    [clearSession]
  );

  const loadProperties = useCallback(
    async (token: string, q = "", offset = 0) => {
      const res = await fetch(
        `/api/admin/properties?q=${encodeURIComponent(q)}&limit=20&offset=${offset}`,
        { headers: authHeaders(token) }
      );
      if (checkAdminUnauthorized(res)) {
        clearSession();
        return;
      }
      const body = (await res.json()) as {
        ok?: boolean;
        properties?: PropertyListItem[];
        hasMore?: boolean;
        message?: string;
      };
      if (!res.ok || !body.ok) throw new Error(body.message ?? "매물 조회 실패");
      setProperties((prev) =>
        offset > 0
          ? [...prev, ...(body.properties ?? [])]
          : body.properties ?? []
      );
      setPropertiesHasMore(Boolean(body.hasMore));
    },
    [clearSession]
  );

  const loadTeams = useCallback(async (token: string, q = "") => {
    const res = await fetch(`/api/admin/teams?q=${encodeURIComponent(q)}`, {
      headers: authHeaders(token),
    });
    if (checkAdminUnauthorized(res)) {
      clearSession();
      return;
    }
    const body = (await res.json()) as {
      ok?: boolean;
      teams?: TeamItem[];
      message?: string;
    };
    if (!res.ok || !body.ok) throw new Error(body.message ?? "팀 조회 실패");
    setTeams(body.teams ?? []);
  }, [clearSession]);

  const loadDeleted = useCallback(
    async (token: string, type: typeof delType, q = "") => {
      const res = await fetch(
        `/api/admin/deleted?type=${type}&q=${encodeURIComponent(q)}`,
        {
          headers: authHeaders(token),
        }
      );
      if (checkAdminUnauthorized(res)) {
        clearSession();
        return;
      }
      const body = (await res.json()) as {
        ok?: boolean;
        rows?: DeletedRow[];
        message?: string;
      };
      if (!res.ok || !body.ok) throw new Error(body.message ?? "삭제 목록 실패");
      setDeletedRows(body.rows ?? []);
    },
    [clearSession]
  );

  const loadDeletedAccounts = useCallback(async (token: string, q = "") => {
    const res = await fetch(
      `/api/admin/deleted-accounts?q=${encodeURIComponent(q)}`,
      {
        headers: authHeaders(token),
      }
    );
    if (checkAdminUnauthorized(res)) {
      clearSession();
      return;
    }
    const body = (await res.json()) as {
      ok?: boolean;
      accounts?: {
        username: string;
        formerUserId: string;
        shopName: string;
        name: string;
        phone?: string;
        deletedAt: string;
        ageDays: number | null;
        counts: Record<string, number>;
      }[];
      message?: string;
    };
    if (!res.ok || !body.ok) throw new Error(body.message ?? "탈퇴 목록 실패");
    setDeletedAccounts(body.accounts ?? []);
  }, [clearSession]);

  const loadStaff = useCallback(async (token: string) => {
    const res = await fetch("/api/admin/staff", {
      headers: authHeaders(token),
    });
    if (checkAdminUnauthorized(res)) {
      clearSession();
      return;
    }
    const body = (await res.json()) as {
      ok?: boolean;
      staff?: Record<string, unknown>[];
      message?: string;
    };
    if (!res.ok || !body.ok) throw new Error(body.message ?? "직원 목록 실패");
    setStaffList(body.staff ?? []);
  }, [clearSession]);

  const loadAuditLogs = useCallback(
    async (token: string, q = "", from = auditFrom, to = auditTo) => {
      const params = new URLSearchParams({ limit: "30" });
      if (q) params.set("q", q);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const res = await fetch(`/api/admin/audit-logs?${params}`, {
        headers: authHeaders(token),
      });
      if (checkAdminUnauthorized(res)) {
        clearSession();
        return;
      }
      const body = (await res.json()) as {
        ok?: boolean;
        rows?: typeof auditLogs;
        message?: string;
      };
      if (!res.ok || !body.ok) throw new Error(body.message ?? "로그 조회 실패");
      setAuditLogs(body.rows ?? []);
    },
    [auditFrom, auditTo, clearSession]
  );

  const loadErrorLogs = useCallback(
    async (
      token: string,
      q = "",
      status: "all" | "4xx" | "5xx" = "5xx"
    ) => {
      const params = new URLSearchParams({ limit: "40" });
      if (q.trim()) params.set("q", q.trim());
      if (status !== "all") params.set("status", status);
      const res = await fetch(`/api/admin/error-logs?${params}`, {
        headers: authHeaders(token),
      });
      if (checkAdminUnauthorized(res)) {
        clearSession();
        return;
      }
      const body = (await res.json()) as {
        ok?: boolean;
        message?: string;
        rows?: typeof errorLogs;
      };
      if (!res.ok || !body.ok) {
        throw new Error(body.message ?? "에러 로그 조회 실패");
      }
      setErrorLogs(body.rows ?? []);
    },
    [clearSession]
  );

  const loadErrorBadge = useCallback(
    async (token: string) => {
      const params = new URLSearchParams({ count: "1", status: "5xx" });
      const seen = readErrorSeenAt();
      if (seen) params.set("since", seen);
      const res = await fetch(`/api/admin/error-logs?${params}`, {
        headers: authHeaders(token),
      });
      if (checkAdminUnauthorized(res)) {
        clearSession();
        return;
      }
      const body = (await res.json()) as {
        ok?: boolean;
        count?: number;
      };
      if (!res.ok || !body.ok) return;
      setErrorBadge(Math.max(0, Number(body.count ?? 0)));
    },
    [clearSession]
  );

  const markErrorsSeenOnLeave = useCallback(() => {
    writeErrorSeenAt(new Date().toISOString());
    setErrorBadge(0);
  }, []);

  const copyErrorReport = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedErrorId(id);
      window.setTimeout(() => setCopiedErrorId(null), 1500);
    } catch {
      setError("클립보드 복사에 실패했습니다.");
    }
  };

  const loadPromoEvents = useCallback(
    async (token: string) => {
      const [codesRes, campaignRes] = await Promise.all([
        fetch("/api/admin/promo-codes", { headers: authHeaders(token) }),
        fetch("/api/admin/promo-campaigns", { headers: authHeaders(token) }),
      ]);
      if (checkAdminUnauthorized(codesRes) || checkAdminUnauthorized(campaignRes)) {
        clearSession();
        return;
      }
      const codesBody = (await codesRes.json()) as {
        ok?: boolean;
        codes?: PromoCodeRow[];
        message?: string;
      };
      const campaignBody = (await campaignRes.json()) as {
        ok?: boolean;
        campaign?: EarlyBirdCampaign | null;
        message?: string;
      };
      if (!codesRes.ok || !codesBody.ok) {
        throw new Error(codesBody.message ?? "프로모 코드 조회 실패");
      }
      if (!campaignRes.ok || !campaignBody.ok) {
        throw new Error(campaignBody.message ?? "캠페인 조회 실패");
      }
      const rows = codesBody.codes ?? [];
      setPromoCodes(rows);
      setPromoEdits(
        Object.fromEntries(
          rows.map((row) => [
            row.id,
            { startsDate: row.startsDate, endsDate: row.endsDate },
          ])
        )
      );
      const campaign = campaignBody.campaign ?? null;
      setEarlyBird(campaign);
      if (campaign) {
        setEarlyBirdForm({
          startsDate: campaign.startsDate,
          endsDate: campaign.endsDate,
          active: campaign.active,
          memo: campaign.memo,
        });
      }
    },
    [clearSession]
  );

  const loadParserBadge = useCallback(
    async (token: string) => {
      const res = await fetch("/api/admin/intake-samples?status=new&limit=1", {
        headers: authHeaders(token),
      });
      if (checkAdminUnauthorized(res)) {
        clearSession();
        return;
      }
      const body = (await res.json()) as {
        ok?: boolean;
        stats?: { newCount?: number };
      };
      if (res.ok && body.ok) {
        setParserNewBadge(body.stats?.newCount ?? 0);
      }
    },
    [clearSession]
  );

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(AUTH_STORAGE);
      if (!raw) return;
      const saved = JSON.parse(raw) as Session;
      if (!saved?.token) return;
      setSession(saved);
      void (async () => {
        try {
          await loadSummary(saved.token);
          await loadAccounts(saved.token);
          if (saved.role === "super") {
            await loadErrorBadge(saved.token);
            await loadParserBadge(saved.token);
          }
        } catch {
          sessionStorage.removeItem(AUTH_STORAGE);
          setSession(null);
        }
      })();
    } catch {
      /* ignore */
    }
  }, [loadAccounts, loadErrorBadge, loadParserBadge, loadSummary]);

  useEffect(() => {
    if (!session || session.role !== "super") return;
    const tick = window.setInterval(() => {
      void loadErrorBadge(session.token);
    }, 60_000);
    return () => window.clearInterval(tick);
  }, [session, loadErrorBadge]);

  const login = async () => {
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const body = (await res.json()) as {
        ok?: boolean;
        message?: string;
        token?: string;
        session?: Omit<Session, "token">;
      };
      if (!res.ok || !body.ok || !body.token || !body.session) {
        setError(body.message ?? "로그인에 실패했습니다.");
        return;
      }
      const next: Session = { ...body.session, token: body.token };
      sessionStorage.setItem(AUTH_STORAGE, JSON.stringify(next));
      setSession(next);
      await loadSummary(next.token);
      await loadAccounts(next.token);
      if (next.role === "super") {
        await loadErrorBadge(next.token);
        await loadParserBadge(next.token);
      }
    } catch {
      setError("서버에 연결할 수 없습니다.");
    } finally {
      setBusy(false);
    }
  };

  const openAccount = async (
    id: string,
    opts?: { returnToEntity?: EntityItemDetail }
  ) => {
    if (!session) return;
    if (opts?.returnToEntity) {
      setReturnEntityItem(opts.returnToEntity);
    } else {
      setReturnEntityItem(null);
    }
    setBusy(true);
    setEntityKind("customers");
    setEntityScope("active");
    setEntityQ("");
    setEntityRows([]);
    setEntityTotal(0);
    setEntityHasMore(false);
    setEntityItem(null);
    setEntityReveal(false);
    setEntityOwnerOpen(false);
    try {
      const res = await fetch(`/api/admin/accounts/${id}`, {
        headers: authHeaders(session.token),
      });
      const body = (await res.json()) as {
        ok?: boolean;
        account?: AccountDetail;
        message?: string;
      };
      if (!res.ok || !body.ok || !body.account) {
        alert(body.message ?? "상세를 불러오지 못했습니다.");
        return;
      }
      setDetail(body.account);
      await loadAccountEntities(id, "customers", "active", "", 0);
    } finally {
      setBusy(false);
    }
  };

  const closeAccountDetail = () => {
    if (returnEntityItem) {
      const back = returnEntityItem;
      setReturnEntityItem(null);
      setDetail(null);
      setEntityRows([]);
      setEntityTotal(0);
      setEntityHasMore(false);
      setEntityItem(back);
      setEntityReveal(false);
      setEntityOwnerOpen(false);
      return;
    }
    setDetail(null);
    setEntityItem(null);
    setEntityReveal(false);
    setEntityOwnerOpen(false);
  };

  const loadAccountEntities = async (
    userId: string,
    kind: EntityKind,
    scope: EntityScope,
    q: string,
    offset = 0
  ) => {
    if (!session) return;
    setEntityLoading(true);
    try {
      const res = await fetch(
        `/api/admin/accounts/${userId}/entities?type=${kind}&scope=${scope}&q=${encodeURIComponent(q)}&limit=80&offset=${offset}`,
        { headers: authHeaders(session.token) }
      );
      const body = (await res.json()) as {
        ok?: boolean;
        rows?: EntityRow[];
        total?: number;
        hasMore?: boolean;
        message?: string;
      };
      if (!res.ok || !body.ok) {
        setError(body.message ?? "목록 조회 실패");
        return;
      }
      setEntityRows((prev) =>
        offset > 0 ? [...prev, ...(body.rows ?? [])] : body.rows ?? []
      );
      setEntityTotal(body.total ?? 0);
      setEntityHasMore(Boolean(body.hasMore));
    } finally {
      setEntityLoading(false);
    }
  };

  const openEntityItem = async (userId: string, kind: EntityKind, rowId: string) => {
    if (!session) return;
    setEntityReveal(false);
    setEntityOwnerOpen(false);
    try {
      const res = await fetch(
        `/api/admin/accounts/${userId}/entities/${rowId}?type=${kind}`,
        { headers: authHeaders(session.token) }
      );
      const body = (await res.json()) as {
        ok?: boolean;
        item?: EntityItemDetail;
        message?: string;
      };
      if (!res.ok || !body.ok || !body.item) {
        alert(body.message ?? "상세를 불러오지 못했습니다.");
        return;
      }
      setEntityItem(body.item);
    } catch {
      alert("상세를 불러오지 못했습니다.");
    }
  };

  const switchTab = async (next: Tab) => {
    if (!session) return;
    if (tab === "errors" && next !== "errors") {
      markErrorsSeenOnLeave();
    }
    setTab(next);
    setError("");
    setBusy(true);
    try {
      if (next === "accounts") await loadAccounts(session.token, searchQ);
      if (next === "properties") await loadProperties(session.token, propertyQ);
      if (next === "search") await loadAccounts(session.token, searchQ);
      if (next === "teams") await loadTeams(session.token, teamQ);
      if (next === "deleted") {
        await loadDeleted(session.token, delType, deletedQ);
        await loadDeletedAccounts(session.token, deletedAccountsQ);
      }
      if (next === "staff" && session.role === "super") {
        await loadStaff(session.token);
      }
      if (next === "events" && session.role === "super") {
        await loadPromoEvents(session.token);
      }
      if (next === "errors" && session.role === "super") {
        await loadErrorLogs(session.token, errorLogQ, errorLogStatus);
        await loadErrorBadge(session.token);
      }
      if (next === "logs" && session.role === "super") {
        await loadAuditLogs(session.token, auditQ, auditFrom, auditTo);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "불러오기 실패");
    } finally {
      setBusy(false);
    }
  };

  if (!session) {
    return (
      <main>
        <PageHeader title="관리자" titleAlign="left" />
        <Card className="relative overflow-hidden space-y-3 !p-5">
          <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-[#3182F6]/10" />
          <p className="text-[18px] font-extrabold tracking-tight text-gray-900">
            현장동선 운영
          </p>
          <p className="text-[13px] leading-snug text-gray-500">
            슈퍼관리자·직원 계정으로 로그인합니다. 직원은 정지·팀 강퇴 가능,
            복원·PII 열람은 슈퍼만.
          </p>
          <Input
            label="관리자 아이디"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
          />
          <Input
            label="비밀번호"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          {error ? (
            <p className="text-[13px] font-semibold text-red-500">{error}</p>
          ) : null}
          <Button
            fullWidth
            size="lg"
            disabled={busy || !username.trim() || !password.trim()}
            onClick={() => void login()}
          >
            {busy ? "확인 중…" : "로그인"}
          </Button>
        </Card>
      </main>
    );
  }

  const tabs: {
    id: Exclude<Tab, "staff" | "events" | "parser" | "errors" | "logs">;
    label: string;
  }[] = [
    { id: "accounts", label: "가입자" },
    { id: "properties", label: "매물" },
    { id: "search", label: "회원" },
    { id: "teams", label: "팀" },
    { id: "deleted", label: "삭제" },
  ];

  return (
    <main>
      <PageHeader
        title="관리자"
        titleAlign="left"
        right={
          <div className="flex max-w-[min(100vw-5.5rem,100%)] flex-wrap items-center justify-end gap-x-2.5 gap-y-1">
            {isSuper ? (
              <>
                <button
                  type="button"
                  className={[
                    "text-[11px] font-bold whitespace-nowrap sm:text-[12px]",
                    tab === "events" ? "text-[#3182F6]" : "text-gray-500",
                  ].join(" ")}
                  onClick={() => void switchTab("events")}
                >
                  이벤트
                </button>
                <button
                  type="button"
                  className={[
                    "inline-flex items-center gap-0.5 text-[11px] font-bold whitespace-nowrap sm:text-[12px]",
                    tab === "parser" ? "text-[#3182F6]" : "text-gray-500",
                  ].join(" ")}
                  onClick={() => void switchTab("parser")}
                >
                  파서
                  {parserNewBadge > 0 ? (
                    <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[#3182F6] px-1 text-[9px] font-extrabold leading-none text-white">
                      {parserNewBadge > 99 ? "99+" : parserNewBadge}
                    </span>
                  ) : null}
                </button>
                <button
                  type="button"
                  className={[
                    "inline-flex items-center gap-0.5 text-[11px] font-bold whitespace-nowrap sm:text-[12px]",
                    tab === "errors" ? "text-[#3182F6]" : "text-gray-500",
                  ].join(" ")}
                  onClick={() => void switchTab("errors")}
                >
                  에러
                  {errorBadge > 0 ? (
                    <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-extrabold leading-none text-white">
                      {errorBadge > 99 ? "99+" : errorBadge}
                    </span>
                  ) : null}
                </button>
                <button
                  type="button"
                  className={[
                    "text-[11px] font-bold whitespace-nowrap sm:text-[12px]",
                    tab === "logs" ? "text-[#3182F6]" : "text-gray-500",
                  ].join(" ")}
                  onClick={() => void switchTab("logs")}
                >
                  로그
                </button>
                <button
                  type="button"
                  className={[
                    "text-[11px] font-bold whitespace-nowrap sm:text-[12px]",
                    tab === "staff" ? "text-[#3182F6]" : "text-gray-500",
                  ].join(" ")}
                  onClick={() => void switchTab("staff")}
                >
                  직원
                </button>
              </>
            ) : null}
            <button
              type="button"
              className="text-[11px] font-bold whitespace-nowrap text-gray-500 sm:text-[12px]"
              onClick={() => {
                sessionStorage.removeItem(AUTH_STORAGE);
                setSession(null);
              }}
            >
              로그아웃
            </button>
          </div>
        }
      />

      <div className="space-y-3 pb-10">
        <Card className="!p-3">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-[12px] font-bold text-gray-900">
              {session.title === session.displayName
                ? session.title
                : `${session.title} · ${session.displayName}`}
            </p>
            <p className="text-[10px] text-gray-400">@{session.username}</p>
          </div>

          {summary ? (
            <div className="mt-2 space-y-1.5">
              <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-[#D9E6F8] bg-[#F7FAFF]">
                <div className="border-r border-[#D9E6F8] px-2.5 py-2 text-center">
                  <p className="text-[12px] text-[#6B8AB8]">오늘 접속</p>
                  <p className="mt-0.5 text-[18px] font-extrabold tabular-nums text-gray-900">
                    {summary.todayVisitors ?? 0}
                  </p>
                </div>
                <div className="px-2.5 py-2 text-center">
                  <p className="text-[12px] text-[#6B8AB8]">오늘 가입</p>
                  <p className="mt-0.5 text-[18px] font-extrabold tabular-nums text-[#3182F6]">
                    {summary.todaySignups ?? 0}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 rounded-lg bg-[#F7F8FA] px-1.5 py-1.5">
                <div className="text-center">
                  <p className="text-[11px] text-gray-400">계정</p>
                  <p className="mt-0.5 text-[14px] font-semibold tabular-nums text-gray-600">
                    {summary.profiles}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-[11px] text-gray-400">팀</p>
                  <p className="mt-0.5 text-[14px] font-semibold tabular-nums text-gray-600">
                    {summary.workspaces ?? 0}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-[11px] text-gray-400">탈퇴</p>
                  <p className="mt-0.5 text-[14px] font-semibold tabular-nums text-gray-600">
                    {summary.deletedAccounts}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 rounded-lg bg-[#F7F8FA] px-1.5 py-1.5">
                <div className="text-center">
                  <p className="text-[11px] text-gray-400">고객</p>
                  <p className="mt-0.5 text-[14px] font-semibold tabular-nums text-gray-600">
                    {summary.customersActive}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-[11px] text-gray-400">매물</p>
                  <p className="mt-0.5 text-[14px] font-semibold tabular-nums text-gray-600">
                    {summary.propertiesActive}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-[11px] text-gray-400">네비</p>
                  <p className="mt-0.5 text-[14px] font-semibold tabular-nums text-gray-600">
                    {summary.schedulesActive}
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </Card>

        <div className="grid grid-cols-5 gap-1 rounded-xl bg-gray-100 p-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => void switchTab(t.id)}
              className={[
                "rounded-lg py-1.5 text-[12px] font-bold transition-colors",
                tab === t.id
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500",
              ].join(" ")}
            >
              {t.label}
            </button>
          ))}
        </div>

        {error ? (
          <p className="text-[12px] font-semibold text-red-500">{error}</p>
        ) : null}

        {tab === "accounts" || tab === "search" ? (
          <Card className="space-y-2.5 !p-3">
            <div>
              <p className="text-[14px] font-bold">
                {tab === "search" ? "회원" : "가입자"}
              </p>
              <p className="mt-0.5 text-[11px] text-gray-500">
                {tab === "search"
                  ? "아이디·이름·상호·전화 검색"
                  : "최근 20건 · 더 보기로 추가 · 아이디·이름·상호·전화 검색"}
              </p>
            </div>
            <div className="flex gap-1.5">
              <input
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                placeholder="아이디·이름·상호·전화"
                className="h-9 min-w-0 flex-1 rounded-lg border border-gray-200 px-2.5 text-[13px]"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    void loadAccounts(session.token, searchQ).catch((err) =>
                      setError(
                        err instanceof Error ? err.message : "검색 실패"
                      )
                    );
                  }
                }}
              />
              <Button
                className="!min-h-[36px] !px-2.5 !text-[12px]"
                disabled={busy}
                onClick={() =>
                  void loadAccounts(session.token, searchQ).catch((e) =>
                    setError(e instanceof Error ? e.message : "검색 실패")
                  )
                }
              >
                검색
              </Button>
            </div>
            <div className="space-y-0.5 text-[12px]">
              {accounts.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => void openAccount(a.id)}
                  className="flex w-full items-baseline justify-between gap-2 border-b border-gray-50 py-2 text-left active:bg-gray-50"
                >
                  <span className="min-w-0 truncate font-semibold text-gray-900">
                    {a.name || "-"} · {a.username}
                    {a.phone ? ` · ${a.phone}` : ""}
                  </span>
                  <span className="shrink-0 text-[11px] tabular-nums text-gray-500">
                    {formatSeoulDateTime(a.createdAt)}
                  </span>
                </button>
              ))}
              {accounts.length === 0 ? (
                <p className="py-3 text-center text-gray-400">
                  {searchQ.trim()
                    ? "검색 결과가 없습니다."
                    : "계정이 없습니다."}
                </p>
              ) : null}
              {accountsHasMore ? (
                <Button
                  variant="secondary"
                  fullWidth
                  className="!min-h-[36px] !text-[12px]"
                  disabled={busy}
                  onClick={() =>
                    void loadAccounts(
                      session.token,
                      searchQ,
                      accounts.length
                    ).catch((e) =>
                      setError(e instanceof Error ? e.message : "불러오기 실패")
                    )
                  }
                >
                  더 보기 (20건씩)
                </Button>
              ) : accounts.length > 0 ? (
                <p className="pt-1 text-center text-[10px] text-gray-400">
                  {searchQ.trim() ? "검색 결과 끝" : "더 이상 없음"}
                </p>
              ) : null}
            </div>
          </Card>
        ) : null}

        {tab === "properties" ? (
          <Card className="space-y-2.5 !p-3">
            <div>
              <p className="text-[14px] font-bold">매물</p>
              <p className="mt-0.5 text-[11px] text-gray-500">
                신규 등록순 · 20건씩 · 유형·거래·금액·주소·등록자 검색
              </p>
            </div>
            <div className="flex gap-1.5">
              <input
                value={propertyQ}
                onChange={(e) => setPropertyQ(e.target.value)}
                placeholder="원룸·전세·주소·등록자"
                className="h-9 min-w-0 flex-1 rounded-lg border border-gray-200 px-2.5 text-[13px]"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    void loadProperties(session.token, propertyQ).catch((err) =>
                      setError(
                        err instanceof Error ? err.message : "검색 실패"
                      )
                    );
                  }
                }}
              />
              <Button
                className="!min-h-[36px] !px-2.5 !text-[12px]"
                disabled={busy}
                onClick={() =>
                  void loadProperties(session.token, propertyQ).catch((e) =>
                    setError(e instanceof Error ? e.message : "검색 실패")
                  )
                }
              >
                검색
              </Button>
            </div>
            <div className="space-y-0.5 text-[12px]">
              {properties.map((p) => (
                <button
                  key={`${p.userId}:${p.id}`}
                  type="button"
                  onClick={() =>
                    void openEntityItem(p.userId, "properties", p.id)
                  }
                  className="flex w-full items-baseline justify-between gap-2 border-b border-gray-50 py-2 text-left active:bg-gray-50"
                >
                  <span className="min-w-0 truncate font-semibold text-gray-900">
                    {p.roomType} · {p.dealType} · {p.money}
                  </span>
                  <span className="shrink-0 text-[11px] tabular-nums text-gray-500">
                    {formatSeoulDateTime(p.createdAt)}
                  </span>
                </button>
              ))}
              {properties.length === 0 ? (
                <p className="py-3 text-center text-gray-400">
                  {propertyQ.trim()
                    ? "검색 결과가 없습니다."
                    : "등록된 매물이 없습니다."}
                </p>
              ) : null}
              {propertiesHasMore ? (
                <Button
                  variant="secondary"
                  fullWidth
                  className="!min-h-[36px] !text-[12px]"
                  disabled={busy}
                  onClick={() =>
                    void loadProperties(
                      session.token,
                      propertyQ,
                      properties.length
                    ).catch((e) =>
                      setError(e instanceof Error ? e.message : "불러오기 실패")
                    )
                  }
                >
                  더 보기 (20건씩)
                </Button>
              ) : properties.length > 0 ? (
                <p className="pt-1 text-center text-[10px] text-gray-400">
                  {propertyQ.trim() ? "검색 결과 끝" : "더 이상 없음"}
                </p>
              ) : null}
            </div>
          </Card>
        ) : null}

        {tab === "teams" ? (
          <Card className="space-y-2.5 !p-3">
            <div>
              <p className="text-[14px] font-bold">팀</p>
              <p className="mt-0.5 text-[11px] text-gray-500">
                최근 5건 · 팀명·아이디·이름·상호·전화로 검색
              </p>
            </div>
            <div className="flex gap-1.5">
              <input
                value={teamQ}
                onChange={(e) => setTeamQ(e.target.value)}
                placeholder="팀명·아이디·이름·상호·전화"
                className="h-9 min-w-0 flex-1 rounded-lg border border-gray-200 px-2.5 text-[13px]"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    void loadTeams(session.token, teamQ).catch((err) =>
                      setError(
                        err instanceof Error ? err.message : "검색 실패"
                      )
                    );
                  }
                }}
              />
              <Button
                className="!min-h-[36px] !px-2.5 !text-[12px]"
                disabled={busy}
                onClick={() =>
                  void loadTeams(session.token, teamQ).catch((e) =>
                    setError(e instanceof Error ? e.message : "검색 실패")
                  )
                }
              >
                검색
              </Button>
            </div>
            <div className="space-y-0.5 text-[12px]">
              {teams.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTeamDetail(t)}
                  className="flex w-full flex-col border-b border-gray-50 py-2 text-left active:bg-gray-50"
                >
                  <span className="font-semibold text-gray-900">{t.name}</span>
                  <span className="text-[11px] text-gray-500">
                    멤버 {t.memberCount}명
                  </span>
                </button>
              ))}
              {teams.length === 0 ? (
                <p className="py-3 text-center text-gray-400">
                  {teamQ.trim() ? "검색 결과가 없습니다." : "팀이 없습니다."}
                </p>
              ) : (
                <p className="pt-1 text-center text-[10px] text-gray-400">
                    {teamQ.trim()
                      ? "검색 최대 5건"
                      : "최근 5건 · 더 찾으려면 검색"}
                </p>
              )}
            </div>
          </Card>
        ) : null}

        {tab === "deleted" ? (
          <>
            <Card className="space-y-2.5 !p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[14px] font-bold">소프트 삭제 · 복원</p>
                  <p className="mt-0.5 text-[11px] text-gray-500">
                    최근 3건 · 나머지는 검색 · 복원은 슈퍼만
                  </p>
                </div>
                {isSuper && process.env.NODE_ENV !== "production" ? (
                  <button
                    type="button"
                    disabled={busy}
                    className="shrink-0 text-[11px] font-semibold text-gray-400 disabled:opacity-50"
                    onClick={() => {
                      void (async () => {
                        setBusy(true);
                        setError("");
                        try {
                          const res = await fetch(
                            "/api/admin/deleted/seed-test",
                            {
                              method: "POST",
                              headers: {
                                "Content-Type": "application/json",
                                ...authHeaders(session.token),
                              },
                              body: JSON.stringify({}),
                            }
                          );
                          const body = (await res.json()) as {
                            ok?: boolean;
                            message?: string;
                            owner?: { username: string };
                          };
                          if (!res.ok || !body.ok) {
                            setError(body.message ?? "테스트 생성 실패");
                            return;
                          }
                          alert(
                            `소프트삭제 테스트 4건을 만들었습니다.\n소유: @${body.owner?.username ?? "-"}\n고객/매물/네비 탭에서 확인·복원해 보세요.`
                          );
                          await loadDeleted(session.token, delType, deletedQ);
                          await loadSummary(session.token);
                        } catch {
                          setError("테스트 생성에 실패했습니다.");
                        } finally {
                          setBusy(false);
                        }
                      })();
                    }}
                  >
                    테스트
                  </button>
                ) : null}
              </div>

              <div className="grid grid-cols-3 gap-1 rounded-xl bg-gray-100 p-1">
                {(
                  [
                    ["customers", "고객"],
                    ["properties", "매물"],
                    ["schedules", "네비"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className={[
                      "rounded-lg py-1.5 text-[12px] font-bold transition-colors",
                      delType === id
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-500",
                    ].join(" ")}
                    onClick={() => {
                      setDelType(id);
                      void loadDeleted(session.token, id, deletedQ);
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="flex gap-1.5">
                <input
                  value={deletedQ}
                  onChange={(e) => setDeletedQ(e.target.value)}
                  placeholder="아이디·상호·전화·이름·주소"
                  className="h-9 min-w-0 flex-1 rounded-lg border border-gray-200 px-2.5 text-[13px]"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      void loadDeleted(session.token, delType, deletedQ);
                    }
                  }}
                />
                <Button
                  className="!min-h-[36px] !px-2.5 !text-[12px]"
                  disabled={busy}
                  onClick={() =>
                    void loadDeleted(session.token, delType, deletedQ)
                  }
                >
                  검색
                </Button>
              </div>

              <div className="space-y-0.5 text-[12px]">
                {deletedRows.map((row) => (
                  <div
                    key={`${row.user_id}:${row.id}`}
                    className="flex items-center gap-2 border-b border-gray-50 py-2"
                  >
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left active:opacity-70"
                      onClick={() =>
                        void openEntityItem(row.user_id, delType, row.id)
                      }
                    >
                      <p className="truncate font-semibold text-gray-900">
                        {row.title}
                      </p>
                      <p className="truncate text-[11px] text-gray-500">
                        {row.owner
                          ? `@${row.owner.username} · ${row.owner.shopName || "-"}`
                          : row.created_by_name || "-"}
                        {" · "}
                        {row.ageDays ?? "-"}일
                        {row.within30Days ? "" : "+"}
                        {" · 상세 보기"}
                      </p>
                    </button>
                    {isSuper ? (
                      <button
                        type="button"
                        disabled={busy}
                        className="shrink-0 rounded-md bg-[#3182F6]/10 px-2.5 py-1 text-[11px] font-bold text-[#3182F6] disabled:opacity-50"
                        onClick={(e) => {
                          e.stopPropagation();
                          setRestoreRow(row);
                          setRestoreToUsername("");
                        }}
                      >
                        복원
                      </button>
                    ) : null}
                  </div>
                ))}
                {deletedRows.length === 0 ? (
                  <p className="py-3 text-center text-gray-400">
                    {deletedQ.trim()
                      ? "검색 결과가 없습니다."
                      : "삭제된 항목이 없습니다."}
                  </p>
                ) : (
                  <p className="pt-1 text-center text-[10px] text-gray-400">
                    행을 누르면 삭제 시점 상세 · 최대 3건 · 더 찾으려면 검색
                  </p>
                )}
              </div>
            </Card>

            <Card className="space-y-2.5 !p-3">
              <div>
                <p className="text-[14px] font-bold">탈퇴 계정</p>
                <p className="mt-0.5 text-[11px] text-gray-500">
                  최근 3건 · 나머지는 검색 · 복구는 슈퍼만
                </p>
              </div>
              <div className="flex gap-1.5">
                <input
                  value={deletedAccountsQ}
                  onChange={(e) => setDeletedAccountsQ(e.target.value)}
                  placeholder="아이디·상호·이름·전화"
                  className="h-9 min-w-0 flex-1 rounded-lg border border-gray-200 px-2.5 text-[13px]"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      void loadDeletedAccounts(
                        session.token,
                        deletedAccountsQ
                      );
                    }
                  }}
                />
                <Button
                  className="!min-h-[36px] !px-2.5 !text-[12px]"
                  disabled={busy}
                  onClick={() =>
                    void loadDeletedAccounts(
                      session.token,
                      deletedAccountsQ
                    )
                  }
                >
                  검색
                </Button>
              </div>
              <div className="space-y-0.5 text-[12px]">
                {deletedAccounts.map((d) => (
                  <div
                    key={d.username}
                    className="flex items-center gap-2 border-b border-gray-50 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-gray-900">
                        {d.username}
                      </p>
                      <p className="truncate text-[11px] text-gray-500">
                        {d.name} · {d.shopName}
                        {d.phone ? ` · ${d.phone}` : ""}
                      </p>
                      <p className="text-[10px] text-gray-400">
                        {d.ageDays ?? "-"}일 전
                      </p>
                    </div>
                    {isSuper ? (
                      <button
                        type="button"
                        disabled={busy}
                        className="shrink-0 rounded-md bg-red-50 px-2.5 py-1 text-[11px] font-bold text-red-500 disabled:opacity-50"
                        onClick={() => {
                          if (
                            !window.confirm(
                              `${d.username} 탈퇴를 해제하고 로그인 가능하게 할까요?`
                            )
                          ) {
                            return;
                          }
                          void (async () => {
                            setBusy(true);
                            try {
                              const res = await fetch(
                                "/api/admin/deleted-accounts",
                                {
                                  method: "POST",
                                  headers: {
                                    "Content-Type": "application/json",
                                    ...authHeaders(session.token),
                                  },
                                  body: JSON.stringify({
                                    username: d.username,
                                  }),
                                }
                              );
                              const body = (await res.json()) as {
                                ok?: boolean;
                                message?: string;
                              };
                              if (!res.ok || !body.ok) {
                                alert(body.message ?? "복구 실패");
                                return;
                              }
                              await loadDeletedAccounts(
                                session.token,
                                deletedAccountsQ
                              );
                            } finally {
                              setBusy(false);
                            }
                          })();
                        }}
                      >
                        복구
                      </button>
                    ) : null}
                  </div>
                ))}
                {deletedAccounts.length === 0 ? (
                  <p className="py-3 text-center text-gray-400">
                    {deletedAccountsQ.trim()
                      ? "검색 결과가 없습니다."
                      : "탈퇴 계정이 없습니다."}
                  </p>
                ) : (
                  <p className="pt-1 text-center text-[10px] text-gray-400">
                    {deletedAccountsQ.trim()
                      ? "검색 최대 3건"
                      : "최근 3건 · 더 찾으려면 검색"}
                  </p>
                )}
              </div>
            </Card>
          </>
        ) : null}

        {tab === "staff" && isSuper ? (
          <Card className="space-y-2.5 !p-3">
            <div>
              <p className="text-[14px] font-bold">관리자 계정</p>
              <p className="mt-0.5 text-[11px] text-gray-500">
                슈퍼만 비활성·생성 · 비활성 시 즉시 차단
              </p>
            </div>
            <div className="space-y-1 text-[12px]">
              {staffList.map((s) => {
                const active = s.active !== false;
                const id = String(s.id);
                const isSelf = id === session.id;
                return (
                  <div
                    key={id}
                    className="flex items-center gap-2 border-b border-gray-50 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-gray-900">
                        {String(s.display_name || s.username)} · @{String(s.username)}
                      </p>
                      <p className="truncate text-[11px] text-gray-500">
                        {String(s.title)} · {s.role === "super" ? "슈퍼" : "직원"}
                        {!active ? " · 비활성" : ""}
                      </p>
                    </div>
                    {!isSelf ? (
                      <button
                        type="button"
                        disabled={busy}
                        className={[
                          "shrink-0 rounded-md px-2.5 py-1 text-[11px] font-bold disabled:opacity-50",
                          active
                            ? "bg-red-50 text-red-500"
                            : "bg-[#3182F6]/10 text-[#3182F6]",
                        ].join(" ")}
                        onClick={() => {
                          const msg = active
                            ? `@${String(s.username)} 계정을 비활성화할까요?`
                            : `@${String(s.username)} 계정을 다시 활성화할까요?`;
                          if (!window.confirm(msg)) return;
                          void (async () => {
                            setBusy(true);
                            try {
                              const res = await fetch(
                                `/api/admin/staff/${id}`,
                                {
                                  method: "PATCH",
                                  headers: {
                                    "Content-Type": "application/json",
                                    ...authHeaders(session.token),
                                  },
                                  body: JSON.stringify({ active: !active }),
                                }
                              );
                              const body = (await res.json()) as {
                                ok?: boolean;
                                message?: string;
                              };
                              if (!res.ok || !body.ok) {
                                alert(body.message ?? "변경 실패");
                                return;
                              }
                              await loadStaff(session.token);
                            } finally {
                              setBusy(false);
                            }
                          })();
                        }}
                      >
                        {active ? "비활성" : "활성화"}
                      </button>
                    ) : null}
                  </div>
                );
              })}
              {staffList.length === 0 ? (
                <p className="py-2 text-center text-gray-400">관리자가 없습니다.</p>
              ) : null}
            </div>

            <div className="border-t border-gray-100 pt-2.5">
              <p className="text-[13px] font-bold">계정 생성</p>
              <div className="mt-2 grid grid-cols-2 gap-1 rounded-lg bg-gray-100 p-1">
                {(
                  [
                    ["staff", "직원"],
                    ["super", "슈퍼"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className={[
                      "rounded-md py-1.5 text-[12px] font-bold",
                      staffForm.role === id
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-500",
                    ].join(" ")}
                    onClick={() =>
                      setStaffForm((s) => ({ ...s, role: id }))
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="mt-2 space-y-2">
                <Input
                  label="직함"
                  value={staffForm.title}
                  onChange={(e) =>
                    setStaffForm((s) => ({ ...s, title: e.target.value }))
                  }
                />
                <Input
                  label="이름"
                  value={staffForm.displayName}
                  onChange={(e) =>
                    setStaffForm((s) => ({ ...s, displayName: e.target.value }))
                  }
                />
                <Input
                  label="아이디"
                  value={staffForm.username}
                  onChange={(e) =>
                    setStaffForm((s) => ({ ...s, username: e.target.value }))
                  }
                />
                <Input
                  label="비밀번호"
                  type="password"
                  value={staffForm.password}
                  onChange={(e) =>
                    setStaffForm((s) => ({ ...s, password: e.target.value }))
                  }
                />
                <Button
                  fullWidth
                  disabled={busy}
                  onClick={() => {
                    if (
                      staffForm.role === "super" &&
                      !window.confirm("슈퍼관리자 계정을 만드시겠습니까?")
                    ) {
                      return;
                    }
                    void (async () => {
                      setBusy(true);
                      try {
                        const res = await fetch("/api/admin/staff", {
                          method: "POST",
                          headers: {
                            "Content-Type": "application/json",
                            ...authHeaders(session.token),
                          },
                          body: JSON.stringify(staffForm),
                        });
                        const body = (await res.json()) as {
                          ok?: boolean;
                          message?: string;
                        };
                        if (!res.ok || !body.ok) {
                          alert(body.message ?? "생성 실패");
                          return;
                        }
                        setStaffForm({
                          title: "직원",
                          displayName: "",
                          username: "",
                          password: "",
                          role: "staff",
                        });
                        await loadStaff(session.token);
                      } finally {
                        setBusy(false);
                      }
                    })();
                  }}
                >
                  {staffForm.role === "super" ? "슈퍼 만들기" : "직원 만들기"}
                </Button>
              </div>
            </div>
          </Card>
        ) : null}

        {tab === "events" && isSuper ? (
          <Card className="space-y-3 !p-3">
            <div>
              <p className="text-[14px] font-bold">이벤트 · 프로모</p>
              <p className="mt-0.5 text-[11px] text-gray-500">
                얼리버드 기간·프로모 코드 생성·기간 수정·비활성화
              </p>
            </div>

            <div className="overflow-hidden rounded-xl border border-gray-100 bg-gray-50/80">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 px-2.5 py-2.5 text-left"
                onClick={() => setEarlyBirdOpen((v) => !v)}
                aria-expanded={earlyBirdOpen}
              >
                <div className="min-w-0">
                  <p className="text-[13px] font-bold text-gray-800">
                    얼리버드 캠페인
                  </p>
                  {!earlyBirdOpen ? (
                    <p className="mt-0.5 truncate text-[11px] text-gray-400">
                      {earlyBird
                        ? `${earlyBird.startsDate} ~ ${earlyBird.endsDate}${earlyBird.active ? " · 활성" : " · 비활성"}`
                        : "일시 이벤트 · 탭하여 설정"}
                    </p>
                  ) : null}
                </div>
                <span
                  className={[
                    "shrink-0 text-[12px] font-bold text-gray-400 transition-transform",
                    earlyBirdOpen ? "rotate-180" : "",
                  ].join(" ")}
                  aria-hidden
                >
                  ▼
                </span>
              </button>
              {earlyBirdOpen ? (
                <div className="space-y-2 border-t border-gray-100 px-2.5 pb-2.5 pt-2">
                  <p className="text-[11px] text-gray-500">
                    기간 내 <span className="font-semibold text-gray-600">신규 가입만</span>{" "}
                    기본 평생 무료 적용(본인 고객↔매물 조건 매칭은 원래 무료,
                    사이트내 공유 매칭은 별도). 기존 회원·저장 시점
                    일괄 부여는 하지 않습니다. 한 번 부여된 혜택은 종료 후에도
                    유지됩니다.
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    <label className="block text-[11px] text-gray-500">
                      시작
                      <input
                        type="date"
                        value={earlyBirdForm.startsDate}
                        onChange={(e) =>
                          setEarlyBirdForm((f) => ({
                            ...f,
                            startsDate: e.target.value,
                          }))
                        }
                        className="mt-0.5 h-9 w-full rounded-lg border border-gray-200 px-2 text-[13px]"
                      />
                    </label>
                    <label className="block text-[11px] text-gray-500">
                      종료
                      <input
                        type="date"
                        value={earlyBirdForm.endsDate}
                        onChange={(e) =>
                          setEarlyBirdForm((f) => ({
                            ...f,
                            endsDate: e.target.value,
                          }))
                        }
                        className="mt-0.5 h-9 w-full rounded-lg border border-gray-200 px-2 text-[13px]"
                      />
                    </label>
                  </div>
                  <label className="flex items-center gap-2 text-[12px] text-gray-600">
                    <input
                      type="checkbox"
                      checked={earlyBirdForm.active}
                      onChange={(e) =>
                        setEarlyBirdForm((f) => ({
                          ...f,
                          active: e.target.checked,
                        }))
                      }
                      className="h-4 w-4 rounded border-gray-300 accent-[#3182F6]"
                    />
                    활성
                    {earlyBird ? (
                      <span className="text-[11px] text-gray-400">· 저장됨</span>
                    ) : null}
                  </label>
                  <Button
                    fullWidth
                    className="!min-h-[36px] !text-[12px]"
                    disabled={
                      busy ||
                      !earlyBirdForm.startsDate ||
                      !earlyBirdForm.endsDate
                    }
                    onClick={() => {
                      void (async () => {
                        setBusy(true);
                        try {
                          const res = await fetch("/api/admin/promo-campaigns", {
                            method: "PUT",
                            headers: {
                              ...authHeaders(session.token),
                              "Content-Type": "application/json",
                            },
                            body: JSON.stringify(earlyBirdForm),
                          });
                          if (checkAdminUnauthorized(res)) {
                            clearSession();
                            return;
                          }
                          const body = (await res.json()) as {
                            ok?: boolean;
                            message?: string;
                          };
                          if (!res.ok || !body.ok) {
                            alert(body.message ?? "저장 실패");
                            return;
                          }
                          await loadPromoEvents(session.token);
                        } finally {
                          setBusy(false);
                        }
                      })();
                    }}
                  >
                    얼리버드 저장
                  </Button>
                </div>
              ) : null}
            </div>

            <div className="space-y-2 rounded-xl border border-gray-100 p-2.5">
              <p className="text-[13px] font-bold text-gray-800">프로모 코드 생성</p>
              <label className="flex items-center gap-2 text-[12px] text-gray-600">
                <input
                  type="checkbox"
                  checked={promoCreate.autoGenerate}
                  onChange={(e) =>
                    setPromoCreate((f) => ({
                      ...f,
                      autoGenerate: e.target.checked,
                    }))
                  }
                  className="h-4 w-4 rounded border-gray-300 accent-[#3182F6]"
                />
                코드 자동 생성
              </label>
              {!promoCreate.autoGenerate ? (
                <input
                  value={promoCreate.code}
                  onChange={(e) =>
                    setPromoCreate((f) => ({ ...f, code: e.target.value }))
                  }
                  placeholder="수동 코드 (영문·숫자)"
                  className="h-9 w-full rounded-lg border border-gray-200 px-2.5 text-[13px] uppercase"
                />
              ) : null}
              <div className="grid grid-cols-2 gap-1.5">
                <label className="block text-[11px] text-gray-500">
                  시작
                  <input
                    type="date"
                    value={promoCreate.startsDate}
                    onChange={(e) =>
                      setPromoCreate((f) => ({
                        ...f,
                        startsDate: e.target.value,
                      }))
                    }
                    className="mt-0.5 h-9 w-full rounded-lg border border-gray-200 px-2 text-[13px]"
                  />
                </label>
                <label className="block text-[11px] text-gray-500">
                  종료
                  <input
                    type="date"
                    value={promoCreate.endsDate}
                    onChange={(e) =>
                      setPromoCreate((f) => ({
                        ...f,
                        endsDate: e.target.value,
                      }))
                    }
                    className="mt-0.5 h-9 w-full rounded-lg border border-gray-200 px-2 text-[13px]"
                  />
                </label>
              </div>
              <input
                value={promoCreate.maxUses}
                onChange={(e) =>
                  setPromoCreate((f) => ({ ...f, maxUses: e.target.value }))
                }
                placeholder="최대 사용 횟수 (비우면 무제한)"
                className="h-9 w-full rounded-lg border border-gray-200 px-2.5 text-[13px]"
              />
              <input
                value={promoCreate.memo}
                onChange={(e) =>
                  setPromoCreate((f) => ({ ...f, memo: e.target.value }))
                }
                placeholder="메모 (선택)"
                className="h-9 w-full rounded-lg border border-gray-200 px-2.5 text-[13px]"
              />
              <Button
                fullWidth
                variant="secondary"
                className="!min-h-[36px] !text-[12px]"
                disabled={
                  busy ||
                  !promoCreate.startsDate ||
                  !promoCreate.endsDate ||
                  (!promoCreate.autoGenerate && !promoCreate.code.trim())
                }
                onClick={() => {
                  void (async () => {
                    setBusy(true);
                    try {
                      const res = await fetch("/api/admin/promo-codes", {
                        method: "POST",
                        headers: {
                          ...authHeaders(session.token),
                          "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                          autoGenerate: promoCreate.autoGenerate,
                          code: promoCreate.code,
                          startsDate: promoCreate.startsDate,
                          endsDate: promoCreate.endsDate,
                          maxUses: promoCreate.maxUses.trim()
                            ? Number(promoCreate.maxUses)
                            : null,
                          memo: promoCreate.memo,
                        }),
                      });
                      if (checkAdminUnauthorized(res)) {
                        clearSession();
                        return;
                      }
                      const body = (await res.json()) as {
                        ok?: boolean;
                        message?: string;
                      };
                      if (!res.ok || !body.ok) {
                        alert(body.message ?? "생성 실패");
                        return;
                      }
                      setPromoCreate((f) => ({
                        ...f,
                        code: "",
                        endsDate: "",
                        maxUses: "",
                        memo: "",
                      }));
                      await loadPromoEvents(session.token);
                    } finally {
                      setBusy(false);
                    }
                  })();
                }}
              >
                프로모 코드 생성
              </Button>
            </div>

            <div className="space-y-1">
              <p className="text-[12px] font-bold text-gray-700">
                프로모 코드 ({promoCodes.filter((c) => c.active).length}개 활성)
              </p>
              {promoCodes.length === 0 ? (
                <p className="py-4 text-center text-[12px] text-gray-400">
                  등록된 코드가 없습니다.
                </p>
              ) : (
                promoCodes.map((row) => {
                  const edit = promoEdits[row.id] ?? {
                    startsDate: row.startsDate,
                    endsDate: row.endsDate,
                  };
                  return (
                    <div
                      key={row.id}
                      className={[
                        "flex flex-wrap items-center gap-1.5 border-b border-gray-50 py-2 text-[12px]",
                        row.active ? "" : "opacity-50",
                      ].join(" ")}
                    >
                      <span className="min-w-[72px] font-mono font-bold text-gray-900">
                        {row.code}
                      </span>
                      <input
                        type="date"
                        value={edit.startsDate}
                        disabled={!row.active}
                        onChange={(e) =>
                          setPromoEdits((prev) => ({
                            ...prev,
                            [row.id]: {
                              ...edit,
                              startsDate: e.target.value,
                            },
                          }))
                        }
                        className="h-8 min-w-0 flex-1 rounded border border-gray-200 px-1 text-[11px]"
                      />
                      <input
                        type="date"
                        value={edit.endsDate}
                        disabled={!row.active}
                        onChange={(e) =>
                          setPromoEdits((prev) => ({
                            ...prev,
                            [row.id]: {
                              ...edit,
                              endsDate: e.target.value,
                            },
                          }))
                        }
                        className="h-8 min-w-0 flex-1 rounded border border-gray-200 px-1 text-[11px]"
                      />
                      <span className="shrink-0 text-[11px] text-gray-400">
                        {row.useCount}
                        {row.maxUses != null ? `/${row.maxUses}` : ""}회
                      </span>
                      {row.active ? (
                        <>
                          <button
                            type="button"
                            className="shrink-0 rounded-lg bg-gray-100 px-2 py-1 text-[11px] font-bold text-gray-600"
                            disabled={busy}
                            onClick={() => {
                              void (async () => {
                                setBusy(true);
                                try {
                                  const res = await fetch(
                                    `/api/admin/promo-codes/${row.id}`,
                                    {
                                      method: "PATCH",
                                      headers: {
                                        ...authHeaders(session.token),
                                        "Content-Type": "application/json",
                                      },
                                      body: JSON.stringify(edit),
                                    }
                                  );
                                  if (checkAdminUnauthorized(res)) {
                                    clearSession();
                                    return;
                                  }
                                  const body = (await res.json()) as {
                                    ok?: boolean;
                                    message?: string;
                                  };
                                  if (!res.ok || !body.ok) {
                                    alert(body.message ?? "수정 실패");
                                    return;
                                  }
                                  await loadPromoEvents(session.token);
                                } finally {
                                  setBusy(false);
                                }
                              })();
                            }}
                          >
                            저장
                          </button>
                          <button
                            type="button"
                            className="shrink-0 rounded-lg bg-red-50 px-2 py-1 text-[11px] font-bold text-red-500"
                            disabled={busy}
                            onClick={() => {
                              if (
                                !confirm(
                                  `${row.code} 코드를 비활성화(삭제)할까요?`
                                )
                              ) {
                                return;
                              }
                              void (async () => {
                                setBusy(true);
                                try {
                                  const res = await fetch(
                                    `/api/admin/promo-codes/${row.id}`,
                                    {
                                      method: "DELETE",
                                      headers: authHeaders(session.token),
                                    }
                                  );
                                  if (checkAdminUnauthorized(res)) {
                                    clearSession();
                                    return;
                                  }
                                  const body = (await res.json()) as {
                                    ok?: boolean;
                                    message?: string;
                                  };
                                  if (!res.ok || !body.ok) {
                                    alert(body.message ?? "삭제 실패");
                                    return;
                                  }
                                  await loadPromoEvents(session.token);
                                } finally {
                                  setBusy(false);
                                }
                              })();
                            }}
                          >
                            삭제
                          </button>
                        </>
                      ) : (
                        <span className="text-[11px] text-gray-400">비활성</span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </Card>
        ) : null}

        {tab === "parser" && isSuper && session ? (
          <IntakeParserAdminPanel
            token={session.token}
            onNewCount={setParserNewBadge}
          />
        ) : null}

        {tab === "errors" && isSuper ? (
          <Card className="space-y-2.5 !p-3">
            <div>
              <p className="text-[14px] font-bold">API 에러</p>
              <p className="mt-0.5 text-[11px] leading-snug text-gray-500">
                기본 500대 · 로그인 실패(4xx)는 기록하지 않음 · 「복사」후
                Cursor에 붙여넣기 · 다른 탭으로 나가면 알림 숫자 초기화
              </p>
            </div>
            <div className="flex flex-wrap gap-1">
              {(
                [
                  ["all", "전체"],
                  ["4xx", "400대"],
                  ["5xx", "500대"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={[
                    "rounded-lg px-2.5 py-1.5 text-[11px] font-bold",
                    errorLogStatus === id
                      ? "bg-[#3182F6] text-white"
                      : "bg-gray-100 text-gray-600",
                  ].join(" ")}
                  onClick={() => {
                    setErrorLogStatus(id);
                    if (!session) return;
                    void loadErrorLogs(session.token, errorLogQ, id).catch(
                      (e) =>
                        setError(
                          e instanceof Error ? e.message : "에러 로그 조회 실패"
                        )
                    );
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex gap-1.5">
              <input
                value={errorLogQ}
                onChange={(e) => setErrorLogQ(e.target.value)}
                placeholder="경로·메시지 검색"
                className="h-9 min-w-0 flex-1 rounded-lg border border-gray-200 px-2.5 text-[13px]"
              />
              <Button
                type="button"
                className="!min-h-[36px] shrink-0 !px-2.5 !text-[12px]"
                disabled={busy || !session}
                onClick={() => {
                  if (!session) return;
                  setBusy(true);
                  void loadErrorLogs(session.token, errorLogQ, errorLogStatus)
                    .catch((e) =>
                      setError(
                        e instanceof Error ? e.message : "에러 로그 조회 실패"
                      )
                    )
                    .finally(() => setBusy(false));
                }}
              >
                조회
              </Button>
            </div>
            <div className="overflow-hidden rounded-xl border border-red-100">
              {errorLogs.map((row, idx) => {
                const when = new Intl.DateTimeFormat("ko-KR", {
                  timeZone: "Asia/Seoul",
                  month: "2-digit",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                  hour12: false,
                }).format(new Date(row.createdAt));
                const open = expandedErrorId === row.id;
                return (
                  <div
                    key={row.id}
                    className={[
                      "space-y-1.5 px-2.5 py-2.5",
                      idx > 0 ? "border-t border-red-100" : "",
                      row.status >= 500 ? "bg-red-50" : "bg-red-50/70",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] text-red-400/90">{when}</p>
                        <p className="mt-0.5 break-all text-[12px] font-bold leading-snug text-gray-900">
                          <span className="text-red-600">{row.status}</span>{" "}
                          {row.method} {row.path}
                          {row.message.startsWith("[AI]") ? (
                            <span className="ml-1 rounded bg-violet-100 px-1 py-0.5 align-middle text-[10px] font-bold text-violet-700">
                              AI
                            </span>
                          ) : null}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-[11px] text-gray-600">
                          {row.message || "(메시지 없음)"}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col gap-1">
                        <button
                          type="button"
                          className="rounded-lg bg-white/80 px-2 py-1 text-[11px] font-bold text-gray-700 ring-1 ring-red-100"
                          onClick={() =>
                            void copyErrorReport(row.id, row.reportText)
                          }
                        >
                          {copiedErrorId === row.id ? "복사됨" : "복사"}
                        </button>
                        <button
                          type="button"
                          className="rounded-lg bg-white/80 px-2 py-1 text-[11px] font-bold text-gray-500 ring-1 ring-red-100"
                          onClick={() =>
                            setExpandedErrorId((cur) =>
                              cur === row.id ? null : row.id
                            )
                          }
                        >
                          {open ? "접기" : "상세"}
                        </button>
                      </div>
                    </div>
                    {open ? (
                      <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-white/90 p-2 text-[10px] leading-relaxed text-gray-600 ring-1 ring-red-100">
                        {row.reportText}
                      </pre>
                    ) : null}
                  </div>
                );
              })}
              {errorLogs.length === 0 ? (
                <p className="bg-white py-3 text-center text-gray-400">
                  기록된 에러가 없습니다.
                </p>
              ) : null}
            </div>
          </Card>
        ) : null}

        {tab === "logs" && isSuper ? (
          <Card className="space-y-2.5 !p-3">
            <div>
              <p className="text-[14px] font-bold">감사 로그</p>
              <p className="mt-0.5 text-[11px] text-gray-500">
                기간 선택 후 조회·CSV 다운로드 (최대 1만 건·366일)
              </p>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <label className="block text-[11px] text-gray-500">
                시작
                <input
                  type="date"
                  value={auditFrom}
                  onChange={(e) => setAuditFrom(e.target.value)}
                  className="mt-0.5 h-9 w-full rounded-lg border border-gray-200 px-2 text-[13px]"
                />
              </label>
              <label className="block text-[11px] text-gray-500">
                종료
                <input
                  type="date"
                  value={auditTo}
                  onChange={(e) => setAuditTo(e.target.value)}
                  className="mt-0.5 h-9 w-full rounded-lg border border-gray-200 px-2 text-[13px]"
                />
              </label>
            </div>
            <div className="flex gap-1.5">
              <input
                value={auditQ}
                onChange={(e) => setAuditQ(e.target.value)}
                placeholder="관리자·행동·대상 검색"
                className="h-9 min-w-0 flex-1 rounded-lg border border-gray-200 px-2.5 text-[13px]"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    void loadAuditLogs(
                      session.token,
                      auditQ,
                      auditFrom,
                      auditTo
                    ).catch((err) =>
                      setError(
                        err instanceof Error ? err.message : "로그 조회 실패"
                      )
                    );
                  }
                }}
              />
              <Button
                className="!min-h-[36px] !px-2.5 !text-[12px]"
                disabled={busy}
                onClick={() =>
                  void loadAuditLogs(
                    session.token,
                    auditQ,
                    auditFrom,
                    auditTo
                  ).catch((e) =>
                    setError(e instanceof Error ? e.message : "로그 조회 실패")
                  )
                }
              >
                조회
              </Button>
            </div>
            <Button
              fullWidth
              variant="secondary"
              className="!min-h-[36px] !text-[12px]"
              disabled={busy || !auditFrom || !auditTo}
              onClick={() => {
                void (async () => {
                  setBusy(true);
                  try {
                    const params = new URLSearchParams({
                      from: auditFrom,
                      to: auditTo,
                    });
                    if (auditQ.trim()) params.set("q", auditQ.trim());
                    const res = await fetch(
                      `/api/admin/audit-logs/export?${params}`,
                      { headers: authHeaders(session.token) }
                    );
                    if (checkAdminUnauthorized(res)) {
                      clearSession();
                      return;
                    }
                    if (!res.ok) {
                      const body = (await res.json()) as { message?: string };
                      alert(body.message ?? "다운로드 실패");
                      return;
                    }
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `audit-logs_${auditFrom}_${auditTo}.csv`;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    URL.revokeObjectURL(url);
                  } finally {
                    setBusy(false);
                  }
                })();
              }}
            >
              CSV 다운로드
            </Button>
            <div className="space-y-1 text-[12px]">
              {auditLogs.map((row) => (
                <div
                  key={row.id}
                  className="border-b border-gray-50 py-2"
                >
                  <p className="font-semibold text-gray-900">
                    {formatSeoulDateTime(row.createdAt)} · {row.actorName}
                  </p>
                  <p className="text-[11px] text-gray-600">
                    {row.action.replace(/^admin_/, "")} · {row.entityType}
                    {row.entityId ? ` · ${row.entityId}` : ""}
                  </p>
                </div>
              ))}
              {auditLogs.length === 0 ? (
                <p className="py-3 text-center text-gray-400">로그가 없습니다.</p>
              ) : null}
            </div>
          </Card>
        ) : null}
      </div>

      <Modal
        open={Boolean(detail)}
        onClose={closeAccountDetail}
        title="계정 상세"
        description={detail ? `@${detail.username}` : undefined}
        dense
        footer={
          detail ? (
            <Button fullWidth variant="secondary" onClick={closeAccountDetail}>
              {returnEntityItem ? "뒤로" : "닫기"}
            </Button>
          ) : null
        }
        headerRight={
          detail && detail.status !== "deleted" ? (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={busy}
                className="rounded-lg bg-gray-800 px-2.5 py-1.5 text-[12px] font-bold text-white disabled:opacity-50"
                onClick={() => {
                  if (
                    !window.confirm(
                      `@${detail.username} 비밀번호를 랜덤 코드로 재설정할까요?\n(이메일 발송은 준비중 · 지금은 화면에 표시된 코드로 로그인)`
                    )
                  ) {
                    return;
                  }
                  void (async () => {
                    setBusy(true);
                    try {
                      const res = await fetch(
                        `/api/admin/accounts/${detail.id}`,
                        {
                          method: "POST",
                          headers: {
                            "Content-Type": "application/json",
                            ...authHeaders(session.token),
                          },
                          body: JSON.stringify({ action: "reset_password" }),
                        }
                      );
                      const body = (await res.json()) as {
                        ok?: boolean;
                        message?: string;
                        temporaryPassword?: string;
                        username?: string;
                        phone?: string;
                      };
                      if (!res.ok || !body.ok || !body.temporaryPassword) {
                        alert(body.message ?? "비밀번호 재설정 실패");
                        return;
                      }
                      setResetPasswordInfo({
                        username: body.username ?? detail.username,
                        temporaryPassword: body.temporaryPassword,
                        phone: body.phone ?? detail.phone ?? "",
                      });
                    } finally {
                      setBusy(false);
                    }
                  })();
                }}
              >
                비밀번호 재설정
              </button>
              {detail.status === "suspended" ? (
                <button
                  type="button"
                  disabled={busy}
                  className="rounded-lg bg-[#3182F6] px-2.5 py-1.5 text-[12px] font-bold text-white disabled:opacity-50"
                  onClick={() => {
                    if (
                      !window.confirm(
                        `@${detail.username} 계정 정지를 해제할까요?`
                      )
                    ) {
                      return;
                    }
                    void (async () => {
                      setBusy(true);
                      try {
                        const res = await fetch(
                          `/api/admin/accounts/${detail.id}`,
                          {
                            method: "POST",
                            headers: {
                              "Content-Type": "application/json",
                              ...authHeaders(session.token),
                            },
                            body: JSON.stringify({ action: "unsuspend" }),
                          }
                        );
                        const body = (await res.json()) as {
                          ok?: boolean;
                          message?: string;
                        };
                        if (!res.ok || !body.ok) {
                          alert(body.message ?? "정지 해제 실패");
                          return;
                        }
                        await openAccount(detail.id);
                      } finally {
                        setBusy(false);
                      }
                    })();
                  }}
                >
                  정지 해제
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  className="rounded-lg bg-red-500 px-2.5 py-1.5 text-[12px] font-bold text-white disabled:opacity-50"
                  onClick={() => {
                    setSuspendPreset(SUSPEND_PRESETS[0]);
                    setSuspendCustom("");
                    setSuspendOpen(true);
                  }}
                >
                  계정 정지
                </button>
              )}
            </div>
          ) : null
        }
      >
        {detail ? (
          <div className="space-y-3 text-[13px]">
            {(() => {
              const plan = planDisplayForUser({
                planTier: detail.planTier,
                matchingEnabled: detail.matchingEnabled,
                promoSource: detail.promoSource,
              });
              if (!plan) return null;
              return (
                <div className="flex items-center justify-between gap-2 rounded-xl bg-gray-50 px-3 py-2">
                  <span className="text-[12px] text-gray-400">이용 요금</span>
                  <PlanBadge plan={plan} />
                </div>
              );
            })()}
            <div className="space-y-1 rounded-xl bg-gray-50 px-3 py-2">
              <p>
                <span className="text-gray-400">업장</span> {detail.shopName}
              </p>
              <p>
                <span className="text-gray-400">이름</span> {detail.name}
              </p>
              <p>
                <span className="text-gray-400">전화</span>{" "}
                {detail.phone || "-"}
              </p>
              <p>
                <span className="text-gray-400">가입</span>{" "}
                {formatSeoulDateTime(detail.createdAt)}
              </p>
              <p>
                <span className="text-gray-400">상태</span>{" "}
                {detail.status === "suspended" ? (
                  <span className="font-bold text-red-500">정지</span>
                ) : detail.status === "deleted" ? (
                  <span className="font-bold text-gray-500">탈퇴</span>
                ) : (
                  <span className="font-bold text-emerald-600">정상</span>
                )}
              </p>
              {detail.status === "suspended" && detail.suspendedReason ? (
                <p className="text-[12px] text-red-500">
                  사유: {detail.suspendedReason}
                </p>
              ) : null}
              {detail.passwordHint ? (
                <p>
                  <span className="text-gray-400">힌트</span>{" "}
                  {detail.passwordHint}
                </p>
              ) : null}
              <p className="text-[12px] text-gray-600">
                고객 {detail.counts.customersActive}/삭제{" "}
                {detail.counts.customersDeleted} · 매물{" "}
                {detail.counts.propertiesActive}/삭제{" "}
                {detail.counts.propertiesDeleted} · 네비{" "}
                {detail.counts.schedulesActive}/삭제{" "}
                {detail.counts.schedulesDeleted}
              </p>
              {detail.team ? (
                <p className="text-[12px] text-[#3182F6]">
                  팀 {detail.team.name} · {detail.team.memberCount}명 ·{" "}
                  {detail.team.role}
                </p>
              ) : (
                <p className="text-[12px] text-gray-400">팀 없음</p>
              )}
              {!isSuper ? (
                <p className="pt-1 text-[11px] text-gray-400">
                  고객·매물의 전화·호실은 마스킹됩니다. 항목을 눌러 상세를
                  보세요.
                </p>
              ) : (
                <p className="pt-1 text-[11px] text-gray-400">
                  고객·매물 목록의 전화·호실은 가려집니다. 항목 상세에서만
                  볼 수 있습니다.
                </p>
              )}
            </div>

            <div className="space-y-2 rounded-xl border border-gray-100 p-2.5">
              <p className="text-[13px] font-bold">자료 조회</p>
              <div className="flex flex-wrap gap-1">
                {(
                  [
                    ["customers", `고객 ${detail.counts.customersActive}`],
                    ["properties", `매물 ${detail.counts.propertiesActive}`],
                    ["schedules", `네비 ${detail.counts.schedulesActive}`],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className={[
                      "rounded-full px-2.5 py-1 text-[11px] font-bold",
                      entityKind === id
                        ? "bg-[#3182F6] text-white"
                        : "bg-gray-100 text-gray-600",
                    ].join(" ")}
                    onClick={() => {
                      setEntityKind(id);
                      setEntityQ("");
                      void loadAccountEntities(
                        detail.id,
                        id,
                        entityScope,
                        "",
                        0
                      );
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-1">
                {(
                  [
                    ["active", "활성"],
                    ["deleted", "삭제"],
                    ["all", "전체"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className={[
                      "rounded-lg px-2 py-1 text-[11px] font-semibold",
                      entityScope === id
                        ? "bg-gray-800 text-white"
                        : "bg-gray-50 text-gray-500",
                    ].join(" ")}
                    onClick={() => {
                      setEntityScope(id);
                      void loadAccountEntities(
                        detail.id,
                        entityKind,
                        id,
                        entityQ,
                        0
                      );
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex gap-1.5">
                <input
                  value={entityQ}
                  onChange={(e) => setEntityQ(e.target.value)}
                  placeholder="이름·주소 검색"
                  className="h-9 min-w-0 flex-1 rounded-lg border border-gray-200 px-2.5 text-[13px]"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      void loadAccountEntities(
                        detail.id,
                        entityKind,
                        entityScope,
                        entityQ,
                        0
                      );
                    }
                  }}
                />
                <Button
                  className="!min-h-[36px] !px-2.5 !text-[12px]"
                  disabled={entityLoading}
                  onClick={() =>
                    void loadAccountEntities(
                      detail.id,
                      entityKind,
                      entityScope,
                      entityQ,
                      0
                    )
                  }
                >
                  검색
                </Button>
              </div>
              <p className="text-[11px] text-gray-400">
                {entityTotal}건 · 탭하면 상세 · 전화·호실은 목록에서 가림
              </p>
              <div className="max-h-[36vh] space-y-1 overflow-y-auto">
                {entityRows.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() =>
                      void openEntityItem(detail.id, entityKind, row.id)
                    }
                    className="flex w-full flex-col border-b border-gray-50 py-1.5 text-left active:bg-gray-50"
                  >
                    <p className="font-semibold text-gray-900">
                      {row.title}
                      {row.deleted ? (
                        <span className="ml-1 text-[10px] font-bold text-red-500">
                          삭제
                        </span>
                      ) : null}
                      {row.shared ? (
                        <span className="ml-1 text-[10px] font-bold text-[#3182F6]">
                          공유
                        </span>
                      ) : null}
                    </p>
                    <p className="text-gray-500">{row.subtitle || "-"}</p>
                  </button>
                ))}
                {entityRows.length === 0 && !entityLoading ? (
                  <p className="py-2 text-gray-400">항목이 없습니다.</p>
                ) : null}
                {entityLoading ? (
                  <p className="py-2 text-gray-400">불러오는 중…</p>
                ) : null}
              </div>
              {entityHasMore ? (
                <Button
                  variant="secondary"
                  fullWidth
                  className="!min-h-[36px] !text-[12px]"
                  disabled={entityLoading}
                  onClick={() =>
                    void loadAccountEntities(
                      detail.id,
                      entityKind,
                      entityScope,
                      entityQ,
                      entityRows.length
                    )
                  }
                >
                  더 보기
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(entityItem)}
        onClose={() => {
          setEntityItem(null);
          setEntityReveal(false);
          setEntityOwnerOpen(false);
        }}
        title={
          entityItem?.kind === "customers"
            ? entityItem.deleted
              ? "삭제된 고객 상세"
              : "고객 상세"
            : entityItem?.kind === "properties"
              ? entityItem.deleted
                ? "삭제된 매물 상세"
                : "매물 상세"
              : entityItem?.deleted
                ? "삭제된 네비 상세"
                : "네비 상세"
        }
        description={entityItem?.title}
        dense
        footer={
          entityItem ? (
            <Button
              fullWidth
              variant="secondary"
              onClick={() => {
                setEntityItem(null);
                setEntityReveal(false);
                setEntityOwnerOpen(false);
              }}
            >
              닫기
            </Button>
          ) : null
        }
        headerRight={
          isSuper && entityItem?.secrets && Object.keys(entityItem.secrets).length > 0 ? (
            <button
              type="button"
              className="rounded-md bg-[#3182F6] px-2 py-0.5 text-[11px] font-bold text-white"
              onClick={() => {
                void (async () => {
                  const next = !entityReveal;
                  if (next && entityItem && session) {
                    await fetch("/api/admin/audit/pii-reveal", {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        ...authHeaders(session.token),
                      },
                      body: JSON.stringify({
                        targetType: entityItem.kind,
                        targetId: entityItem.id,
                        field: "phone_room",
                      }),
                    });
                  }
                  setEntityReveal(next);
                })();
              }}
            >
              {entityReveal ? "가리기" : "전화·호실 보기"}
            </button>
          ) : null
        }
      >
        {entityItem ? (
          <div className="space-y-3 text-[13px]">
            {entityItem.owner ? (
              <div className="overflow-hidden rounded-xl border border-gray-100">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left"
                  onClick={() => setEntityOwnerOpen((v) => !v)}
                  aria-expanded={entityOwnerOpen}
                >
                  <div className="min-w-0">
                    <p className="text-[12px] font-bold text-gray-800">
                      올린 사람
                    </p>
                    {!entityOwnerOpen ? (
                      <p className="mt-0.5 truncate text-[11px] text-gray-400">
                        {entityItem.owner.name || "-"} · @
                        {entityItem.owner.username}
                        {entityItem.owner.shopName
                          ? ` · ${entityItem.owner.shopName}`
                          : ""}
                      </p>
                    ) : null}
                  </div>
                  <span
                    className={[
                      "shrink-0 text-[11px] font-bold text-gray-400 transition-transform",
                      entityOwnerOpen ? "rotate-180" : "",
                    ].join(" ")}
                    aria-hidden
                  >
                    ▼
                  </span>
                </button>
                {entityOwnerOpen ? (
                  <div className="space-y-1 border-t border-gray-50 px-2.5 py-2 text-[12px]">
                    <p>
                      <span className="text-gray-400">업장</span>{" "}
                      {entityItem.owner.shopName || "-"}
                    </p>
                    <p>
                      <span className="text-gray-400">이름</span>{" "}
                      {entityItem.owner.name || "-"}
                    </p>
                    <p>
                      <span className="text-gray-400">아이디</span> @
                      {entityItem.owner.username}
                    </p>
                    <p>
                      <span className="text-gray-400">전화</span>{" "}
                      {entityItem.owner.phone || "-"}
                    </p>
                    {entityItem.owner.createdAt ? (
                      <p>
                        <span className="text-gray-400">가입</span>{" "}
                        {formatSeoulDateTime(entityItem.owner.createdAt)}
                      </p>
                    ) : null}
                    <button
                      type="button"
                      className="pt-0.5 text-[11px] font-bold text-[#3182F6]"
                      onClick={() => {
                        const ownerId = entityItem.owner?.id;
                        if (!ownerId) return;
                        void openAccount(ownerId, {
                          returnToEntity: entityItem,
                        });
                      }}
                    >
                      가입자 상세 보기
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="space-y-1.5">
              {entityItem.fields.map((field) => (
                <p key={`${field.label}-${field.secretKey ?? field.value}`}>
                  <span className="text-gray-400">{field.label}</span>{" "}
                  <span className="whitespace-pre-wrap text-gray-900">
                    {resolveDetailField(
                      field,
                      entityReveal,
                      entityItem.secrets
                    )}
                  </span>
                </p>
              ))}
            </div>

            {entityItem.slots?.map((slot) => (
              <div
                key={slot.title}
                className="space-y-1 rounded-xl border border-gray-100 px-2.5 py-2"
              >
                <p className="text-[12px] font-bold text-[#3182F6]">
                  {slot.title}
                </p>
                {slot.fields.map((field) => (
                  <p key={`${slot.title}-${field.label}-${field.secretKey ?? ""}`}>
                    <span className="text-gray-400">{field.label}</span>{" "}
                    <span className="whitespace-pre-wrap text-gray-900">
                      {resolveDetailField(
                        field,
                        entityReveal,
                        entityItem.secrets
                      )}
                    </span>
                  </p>
                ))}
              </div>
            ))}

            {entityItem.routes && entityItem.routes.length > 0 ? (
              <div className="space-y-1 rounded-xl bg-gray-50 px-2.5 py-2">
                <p className="text-[12px] font-bold text-gray-500">이동 경로</p>
                {entityItem.routes.map((r) => (
                  <p key={r} className="text-gray-800">
                    {r}
                  </p>
                ))}
              </div>
            ) : null}

            <p className="text-[12px] text-gray-500">
              {entityItem.shared ? "팀 공유 · " : ""}
              {entityItem.deleted ? "삭제됨 · " : ""}
              {entityItem.createdByName || ""}
              {entityItem.updatedAt ? ` · ${entityItem.updatedAt}` : ""}
            </p>
            {!isSuper ? (
              <p className="text-[11px] text-gray-400">
                전화·호실·비밀번호는 마스킹됩니다. (슈퍼만 상세에서 해제)
              </p>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(teamDetail)}
        onClose={() => setTeamDetail(null)}
        title="팀 상세"
        description={teamDetail?.name}
        dense
      >
        {teamDetail ? (
          <div className="max-h-[60vh] space-y-2 overflow-y-auto">
            {(teamDetail.members ?? []).map((m) => (
              <div
                key={m.userId}
                className="flex items-center justify-between gap-2 rounded-xl border border-gray-100 px-2.5 py-2 text-[12px]"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold">
                    {m.shopName} · {m.name}
                  </p>
                  <p className="text-gray-400">
                    @{m.username} · {m.role}
                  </p>
                </div>
                <Button
                  variant="danger"
                  className="!min-h-[32px] shrink-0 !px-2 !text-[11px]"
                  disabled={busy}
                  onClick={() => {
                    if (
                      !window.confirm(
                        `${m.username} 님만 팀에서 나가게 할까요? 공유는 팀에서 빠집니다.`
                      )
                    ) {
                      return;
                    }
                    void (async () => {
                      setBusy(true);
                      try {
                        const res = await fetch(
                          `/api/admin/teams/${teamDetail.id}`,
                          {
                            method: "POST",
                            headers: {
                              "Content-Type": "application/json",
                              ...authHeaders(session.token),
                            },
                            body: JSON.stringify({
                              action: "remove-member",
                              userId: m.userId,
                            }),
                          }
                        );
                        const body = (await res.json()) as {
                          ok?: boolean;
                          message?: string;
                        };
                        if (!res.ok || !body.ok) {
                          alert(body.message ?? "실패");
                          return;
                        }
                        setTeamDetail(null);
                        await loadTeams(session.token, teamQ);
                      } finally {
                        setBusy(false);
                      }
                    })();
                  }}
                >
                  나가기
                </Button>
              </div>
            ))}
            <Button
              fullWidth
              variant="secondary"
              onClick={() => setTeamDetail(null)}
            >
              닫기
            </Button>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(resetPasswordInfo)}
        onClose={() => setResetPasswordInfo(null)}
        title="비밀번호 재설정"
        description={
          resetPasswordInfo
            ? `@${resetPasswordInfo.username} — 랜덤 코드가 새 비밀번호입니다`
            : undefined
        }
        dense
        position="center"
      >
        {resetPasswordInfo ? (
          <div className="space-y-3">
            <p className="text-[12px] leading-snug text-gray-500">
              아래 랜덤 코드로 로그인하세요. 가입 이메일로 보내는 발송은
              준비중이며, 지금은 이 화면에만 표시됩니다.
            </p>
            {resetPasswordInfo.phone ? (
              <p className="text-[12px] text-gray-600">
                연락처{" "}
                <span className="font-bold text-gray-900">
                  {resetPasswordInfo.phone}
                </span>
              </p>
            ) : null}
            <div className="rounded-xl bg-gray-50 px-3 py-3 text-center">
              <p className="text-[11px] text-gray-400">랜덤 코드 (로그인 비밀번호)</p>
              <p className="mt-1 break-all font-mono text-[20px] font-extrabold tracking-wide text-gray-900">
                {resetPasswordInfo.temporaryPassword}
              </p>
              <p className="mt-1.5 text-[10px] font-semibold text-amber-600">
                이메일 발송 · 준비중
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  void navigator.clipboard
                    .writeText(resetPasswordInfo.temporaryPassword)
                    .then(() => alert("랜덤 코드를 복사했습니다."))
                    .catch(() => alert("복사에 실패했습니다."));
                }}
              >
                복사
              </Button>
              <Button onClick={() => setResetPasswordInfo(null)}>확인</Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={suspendOpen}
        onClose={() => setSuspendOpen(false)}
        title="계정 정지"
        description={
          detail ? `@${detail.username} — 사유를 선택하거나 직접 작성` : undefined
        }
        dense
      >
        <div className="space-y-3">
          <div className="space-y-1.5">
            {SUSPEND_PRESETS.map((preset) => (
              <label
                key={preset}
                className={[
                  "flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-[13px]",
                  suspendPreset === preset
                    ? "border-[#3182F6] bg-blue-50 font-semibold text-[#3182F6]"
                    : "border-gray-100 text-gray-700",
                ].join(" ")}
              >
                <input
                  type="radio"
                  name="suspend-reason"
                  className="accent-[#3182F6]"
                  checked={suspendPreset === preset}
                  onChange={() => setSuspendPreset(preset)}
                />
                {preset}
              </label>
            ))}
          </div>
          {suspendPreset === "기타 (직접 입력)" ? (
            <Input
              label="직접 작성"
              value={suspendCustom}
              onChange={(e) => setSuspendCustom(e.target.value)}
              placeholder="정지 사유를 입력해 주세요"
            />
          ) : null}
          <p className="text-[11px] text-gray-500">
            정지도 로그인은 됩니다. 홈에서만 머물고 다른 메뉴는 문의 안내가
            뜹니다.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => setSuspendOpen(false)}>
              취소
            </Button>
            <Button
              variant="danger"
              disabled={
                busy ||
                !detail ||
                (suspendPreset === "기타 (직접 입력)" &&
                  !suspendCustom.trim())
              }
              onClick={() => {
                if (!detail || !session) return;
                const reason =
                  suspendPreset === "기타 (직접 입력)"
                    ? suspendCustom.trim()
                    : suspendPreset;
                if (!reason) return;
                void (async () => {
                  setBusy(true);
                  try {
                    const res = await fetch(
                      `/api/admin/accounts/${detail.id}`,
                      {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                          ...authHeaders(session.token),
                        },
                        body: JSON.stringify({
                          action: "suspend",
                          reason,
                        }),
                      }
                    );
                    const body = (await res.json()) as {
                      ok?: boolean;
                      message?: string;
                    };
                    if (!res.ok || !body.ok) {
                      alert(body.message ?? "정지 실패");
                      return;
                    }
                    setSuspendOpen(false);
                    await openAccount(detail.id);
                  } finally {
                    setBusy(false);
                  }
                })();
              }}
            >
              정지하기
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(restoreRow)}
        onClose={() => setRestoreRow(null)}
        title="항목 복원"
        description="비워 두면 원래 계정으로 복원합니다. 다른 아이디를 넣으면 그 계정으로 옮깁니다."
        dense
      >
        <div className="space-y-3">
          <p className="text-[13px] font-semibold">{restoreRow?.title}</p>
          <Input
            label="복원 대상 아이디 (선택)"
            value={restoreToUsername}
            onChange={(e) => setRestoreToUsername(e.target.value)}
            placeholder="비우면 원래 계정"
          />
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => setRestoreRow(null)}>
              취소
            </Button>
            <Button
              disabled={busy || !restoreRow}
              onClick={() => {
                if (!restoreRow || !session) return;
                void (async () => {
                  setBusy(true);
                  try {
                    const res = await fetch("/api/admin/deleted", {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        ...authHeaders(session.token),
                      },
                      body: JSON.stringify({
                        type: delType,
                        id: restoreRow.id,
                        fromUserId: restoreRow.user_id,
                        toUsername: restoreToUsername.trim() || undefined,
                      }),
                    });
                    const body = (await res.json()) as {
                      ok?: boolean;
                      message?: string;
                    };
                    if (!res.ok || !body.ok) {
                      alert(body.message ?? "복원 실패");
                      return;
                    }
                    setRestoreRow(null);
                    await loadDeleted(session.token, delType, deletedQ);
                  } finally {
                    setBusy(false);
                  }
                })();
              }}
            >
              복원
            </Button>
          </div>
        </div>
      </Modal>
    </main>
  );
}
