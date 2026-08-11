"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import {
  DELETE_CONFIRM_PHRASE,
  deleteAccount,
  getCurrentUser,
  hardRedirectHome,
  logoutUser,
} from "@/lib/auth";
import { PasswordReveal } from "@/components/PasswordReveal";
import { formatPhone } from "@/lib/format";
import {
  createWorkspace,
  fetchWorkspaceStatus,
  joinWorkspace,
  reissueShareCode,
  type WorkspaceInfo,
} from "@/lib/workspace";
import type { User } from "@/lib/types";

function formatRemain(expiresAt: string | null | undefined): string {
  if (!expiresAt) return "만료됨";
  const ms = Date.parse(expiresAt) - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return "만료됨";
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}분 ${String(s).padStart(2, "0")}초 남음`;
}

export default function AccountPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceInfo | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [wsBusy, setWsBusy] = useState(false);
  const [wsMessage, setWsMessage] = useState("");
  const [createConsentOpen, setCreateConsentOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmPhrase, setConfirmPhrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [nowTick, setNowTick] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const u = await getCurrentUser();
      if (cancelled) return;
      if (!u) {
        router.replace("/login");
        return;
      }
      setUser(u);
      const ws = await fetchWorkspaceStatus();
      if (!cancelled) setWorkspace(ws);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    if (!workspace?.shareCodeExpiresAt) return;
    const t = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [workspace?.shareCodeExpiresAt]);

  const codeRemainLabel = useMemo(
    () => formatRemain(workspace?.shareCodeExpiresAt),
    // nowTick keeps the label fresh
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [workspace?.shareCodeExpiresAt, nowTick]
  );
  const codeValid =
    Boolean(workspace?.shareCodeExpiresAt) &&
    Date.parse(workspace?.shareCodeExpiresAt ?? "") > nowTick;

  const closeDelete = () => {
    if (busy) return;
    setDeleteOpen(false);
    setConfirmPhrase("");
    setError("");
  };

  const handleDelete = async () => {
    setError("");
    setBusy(true);
    try {
      const result = await deleteAccount(confirmPhrase);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      hardRedirectHome();
    } finally {
      setBusy(false);
    }
  };

  const handleCreate = async () => {
    setWsMessage("");
    setWsBusy(true);
    try {
      const result = await createWorkspace(user?.shopName);
      if (!result.ok) {
        setWsMessage(result.message);
        return;
      }
      setWorkspace(result.workspace);
      setCreateConsentOpen(false);
      setWsMessage(
        "팀 공유가 시작되었습니다. 공유 코드는 약 5분간만 사용할 수 있습니다."
      );
    } finally {
      setWsBusy(false);
    }
  };

  const handleJoin = async () => {
    setWsMessage("");
    setWsBusy(true);
    try {
      const result = await joinWorkspace(joinCode);
      if (!result.ok) {
        setWsMessage(result.message);
        return;
      }
      setWorkspace(result.workspace);
      setJoinCode("");
      setWsMessage("팀 공유에 참여했습니다. 고객·매물이 함께 보입니다.");
    } finally {
      setWsBusy(false);
    }
  };

  const handleReissue = async (opts?: { skipConfirm?: boolean }) => {
    if (
      !opts?.skipConfirm &&
      !window.confirm(
        "새 코드를 발급할까요? 기존 코드는 바로 사용할 수 없습니다."
      )
    ) {
      return;
    }
    setWsMessage("");
    setWsBusy(true);
    try {
      const result = await reissueShareCode();
      if (!result.ok) {
        setWsMessage(result.message);
        return;
      }
      setWorkspace(result.workspace);
      setWsMessage("새 공유 코드가 발급되었습니다. 약 5분간 유효합니다.");
    } finally {
      setWsBusy(false);
    }
  };

  const copyCode = async () => {
    if (!workspace?.shareCode || !codeValid) return;
    try {
      await navigator.clipboard.writeText(workspace.shareCode);
      setWsMessage("공유 코드를 복사했습니다.");
    } catch {
      setWsMessage(`코드: ${workspace.shareCode}`);
    }
  };

  if (!user) {
    return (
      <main className="py-20 text-center text-gray-500">불러오는 중...</main>
    );
  }

  return (
    <main>
      <PageHeader title="내정보" backHref="/" />

      <div className="space-y-3 pb-8">
        <Card className="!p-0 overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
            <p className="text-[14px] font-bold text-gray-900">계정 정보</p>
            <Link
              href="/account/edit"
              className="shrink-0 text-[13px] font-semibold text-[#3182F6] active:opacity-70"
            >
              내정보수정
            </Link>
          </div>
          <dl className="border-t border-gray-100">
            {(
              [
                ["업장명", user.shopName?.trim() || "-"],
                ["이름", user.name?.trim() || "-"],
                ["아이디", user.username],
                ["전화번호", user.phone ? formatPhone(user.phone) : "-"],
              ] as const
            ).map(([label, value], i) => (
              <div
                key={label}
                className={[
                  "flex items-center justify-between gap-3 px-3.5 py-2",
                  i > 0 ? "border-t border-gray-50" : "",
                ].join(" ")}
              >
                <dt className="shrink-0 text-[12px] text-gray-400">{label}</dt>
                <dd className="min-w-0 truncate text-right text-[13px] font-semibold text-gray-900">
                  {value}
                </dd>
              </div>
            ))}
            <div className="flex items-center justify-between gap-3 border-t border-gray-50 px-3.5 py-2">
              <dt className="shrink-0 text-[12px] text-gray-400">
                비밀번호 힌트
              </dt>
              <dd className="min-w-0">
                <PasswordReveal
                  password={user.passwordHint?.trim() || undefined}
                />
              </dd>
            </div>
          </dl>
        </Card>

        <Card className="space-y-2.5 !p-3">
          <div>
            <p className="text-[14px] font-bold text-gray-900">팀 공유</p>
            <p className="mt-0.5 text-[11px] leading-snug text-gray-500">
              코드로 동료와 고객·매물을 같이 씁니다. 네비는 일정에서 「팀공유」를
              눌러야 보입니다.
            </p>
          </div>

          {workspace ? (
            <div className="space-y-2">
              <div className="rounded-lg bg-gray-50 px-2.5 py-2">
                <p className="text-[11px] text-gray-400">공유 공간</p>
                <p className="text-[14px] font-bold text-gray-900">
                  {workspace.workspaceName || "팀 공간"}
                </p>
                <p className="mt-0.5 text-[11px] text-gray-500">
                  {workspace.role === "owner" ? "생성자" : "멤버"}
                </p>
                <button
                  type="button"
                  onClick={() => setMembersOpen((v) => !v)}
                  className="mt-1.5 flex w-full items-center justify-between rounded-md bg-white px-2 py-1.5 text-left active:scale-[0.99] transition-all duration-150"
                >
                  <span className="text-[12px] font-bold text-gray-800">
                    공유중인 팀원 · {workspace.memberCount}명
                  </span>
                  <span className="text-[11px] font-semibold text-[#3182F6]">
                    {membersOpen ? "접기" : "보기"}
                  </span>
                </button>
                {membersOpen ? (
                  <div className="mt-1.5 space-y-1">
                    {(workspace.members ?? []).map((m) => (
                      <div
                        key={m.userId}
                        className="rounded-md border border-gray-100 bg-white px-2 py-1.5 text-[12px] leading-snug text-gray-700"
                      >
                        <span className="font-semibold text-gray-900">
                          {m.shopName}
                        </span>
                        <span className="text-gray-300"> · </span>
                        <span className="font-semibold text-gray-800">
                          {m.name}
                        </span>
                        <span className="text-gray-300"> · </span>
                        <span className="font-mono text-[11px] text-gray-500">
                          {m.username}
                        </span>
                        {m.role === "owner" ? (
                          <span className="ml-1 text-[10px] font-bold text-[#3182F6]">
                            생성자
                          </span>
                        ) : null}
                      </div>
                    ))}
                    {(workspace.members ?? []).length === 0 ? (
                      <p className="px-1 text-[11px] text-gray-400">
                        팀원 정보를 불러오지 못했습니다.
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
              {codeValid ? (
                <div className="rounded-lg border-2 border-[#3182F6]/30 bg-[#E8F3FF] px-2.5 py-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold text-[#3182F6]">
                        공유 코드 (동료에게 전달)
                      </p>
                      <p className="mt-1 font-mono text-[22px] font-extrabold tracking-[0.2em] text-[#1B64DA]">
                        {workspace.shareCode}
                      </p>
                      <p className="mt-1 text-[11px] font-semibold text-emerald-600">
                        {codeRemainLabel}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col gap-1">
                      <Button
                        variant="outline"
                        className="!min-h-[32px] !rounded-lg !border-[#3182F6]/40 !bg-white !px-2.5 !text-[12px] !text-[#3182F6]"
                        onClick={() => void copyCode()}
                      >
                        복사
                      </Button>
                      {workspace.role === "owner" ? (
                        <Button
                          variant="secondary"
                          disabled={wsBusy}
                          className="!min-h-[32px] !rounded-lg !px-2.5 !text-[12px]"
                          onClick={() => void handleReissue()}
                        >
                          재발급
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : workspace.role === "owner" ? (
                <Button
                  fullWidth
                  disabled={wsBusy}
                  className="!min-h-[44px] !text-[15px]"
                  onClick={() => void handleReissue({ skipConfirm: true })}
                >
                  {wsBusy ? "생성 중…" : "공유 코드 생성"}
                </Button>
              ) : (
                <p className="rounded-lg bg-gray-50 px-2.5 py-2 text-[12px] leading-snug text-gray-500">
                  공유 코드가 만료되었습니다. 생성자에게 새 코드를 요청해 주세요.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <Button
                fullWidth
                disabled={wsBusy}
                className="!min-h-[44px] !text-[15px]"
                onClick={() => setCreateConsentOpen(true)}
              >
                공유 코드 생성
              </Button>
              <div className="flex items-end gap-1.5">
                <div className="min-w-0 flex-1">
                  <label className="mb-0.5 block text-[11px] font-semibold text-gray-500">
                    공유 코드
                  </label>
                  <input
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="코드 입력"
                    autoComplete="off"
                    className="h-9 w-full rounded-lg border border-gray-200 bg-white px-2.5 text-[13px] font-semibold tracking-wide text-gray-900 outline-none focus:border-[#3182F6]"
                  />
                </div>
                <Button
                  variant="secondary"
                  disabled={wsBusy || !joinCode.trim()}
                  className="!h-9 !min-h-0 !rounded-lg !px-3 !text-[12px]"
                  onClick={() => void handleJoin()}
                >
                  참여
                </Button>
              </div>
            </div>
          )}

          {wsMessage ? (
            <p
              className={[
                "text-[11px] font-semibold",
                wsMessage.includes("로그인") || wsMessage.includes("실패")
                  ? "text-red-500"
                  : "text-[#3182F6]",
              ].join(" ")}
            >
              {wsMessage}
            </p>
          ) : null}
        </Card>

        <Button
          variant="secondary"
          fullWidth
          onClick={() => {
            void (async () => {
              await logoutUser();
              hardRedirectHome();
            })();
          }}
        >
          로그아웃
        </Button>

        <Button
          variant="danger"
          fullWidth
          onClick={() => setDeleteOpen(true)}
        >
          회원탈퇴
        </Button>
      </div>

      <Modal
        open={createConsentOpen}
        onClose={() => {
          if (wsBusy) return;
          setCreateConsentOpen(false);
        }}
        title="팀 공유를 시작할까요?"
        description="동의하시면 공유 코드가 생성됩니다. 같은 코드를 입력한 동료와 고객·매물 리스트가 함께 보입니다. 코드는 약 5분만 유효합니다."
      >
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="secondary"
            disabled={wsBusy}
            onClick={() => setCreateConsentOpen(false)}
          >
            취소
          </Button>
          <Button disabled={wsBusy} onClick={() => void handleCreate()}>
            {wsBusy ? "생성 중…" : "동의하고 생성"}
          </Button>
        </div>
      </Modal>

      <Modal
        open={deleteOpen}
        onClose={closeDelete}
        title="정말 탈퇴할까요?"
        description={`탈퇴하면 앱을 더 이상 이용할 수 없고, 같은 아이디로는 다시 가입할 수 없습니다. 아래 문구를 정확히 입력해 주세요. 「${DELETE_CONFIRM_PHRASE}」`}
      >
        <div className="space-y-3">
          <Input
            label="확인 문구"
            value={confirmPhrase}
            onChange={(e) => setConfirmPhrase(e.target.value)}
            placeholder={DELETE_CONFIRM_PHRASE}
            autoComplete="off"
          />
          {error ? (
            <p className="text-[13px] font-semibold text-red-500">{error}</p>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="secondary"
              disabled={busy}
              onClick={closeDelete}
            >
              취소
            </Button>
            <Button
              disabled={busy}
              className="!bg-red-500 hover:!bg-red-600"
              onClick={() => void handleDelete()}
            >
              {busy ? "처리 중…" : "탈퇴하기"}
            </Button>
          </div>
        </div>
      </Modal>
    </main>
  );
}
