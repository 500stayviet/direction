"use client";

import { useEffect, useRef, useState } from "react";
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
  getAccessToken,
  getCurrentUser,
  hardRedirectHome,
  logoutUser,
  peekCurrentUser,
  refreshSuspendedFromServer,
} from "@/lib/auth";
import { PasswordReveal } from "@/components/PasswordReveal";
import { formatPhone } from "@/lib/format";
import {
  createWorkspace,
  fetchWorkspaceStatus,
  joinWorkspace,
  reissueShareCode,
  renameWorkspace,
  type WorkspaceInfo,
} from "@/lib/workspace";
import { WORKSPACE_NAME_MAX, normalizeWorkspaceName } from "@/lib/workspaceName";
import type { User } from "@/lib/types";
import { planDisplayForUser } from "@/lib/planDisplay";
import { PlanBadge } from "@/components/PlanBadge";

export default function AccountPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceInfo | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [wsBusy, setWsBusy] = useState(false);
  const [wsMessage, setWsMessage] = useState("");
  const [codeConsent, setCodeConsent] = useState<"create" | "reissue" | null>(
    null
  );
  const [membersOpen, setMembersOpen] = useState(false);
  const [nameOpen, setNameOpen] = useState<"set" | "edit" | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [nameError, setNameError] = useState("");
  /** 이 방문에서 유효 코드를 본 뒤에만 만료 빨간 UI 표시 (재진입 시 초기화) */
  const sawValidCodeThisVisit = useRef(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmPhrase, setConfirmPhrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [nowTick, setNowTick] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    const loadWorkspace = async () => {
      let status = await fetchWorkspaceStatus();
      if (!status.ok) {
        await new Promise((r) => window.setTimeout(r, 400));
        if (cancelled) return;
        status = await fetchWorkspaceStatus();
      }
      if (cancelled) return;
      if (status.ok) {
        setWorkspace(status.workspace);
      } else if (status.message) {
        setWsMessage(status.message);
      }
    };

    void (async () => {
      const u = await getCurrentUser();
      if (cancelled) return;
      if (!u) {
        router.replace("/login");
        return;
      }
      setUser(u);

      // 요금·얼리버드 배지: localStorage 캐시에 planTier가 없을 수 있어 서버 동기화
      const token = await getAccessToken();
      if (token && !cancelled) {
        await refreshSuspendedFromServer(token);
        const synced = peekCurrentUser();
        if (!cancelled && synced) setUser({ ...synced });
      }

      await loadWorkspace();
    })();

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void loadWorkspace();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router]);

  useEffect(() => {
    if (!workspace?.shareCodeExpiresAt) return;
    const t = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [workspace?.shareCodeExpiresAt]);

  const codeValid =
    Boolean(workspace?.shareCodeExpiresAt) &&
    Date.parse(workspace?.shareCodeExpiresAt ?? "") > nowTick;

  // 내정보 재진입 시: 이미 만료면 만료 UI 없이 초기화 / 유효하면 이 방문에서 만료 추적
  useEffect(() => {
    if (!workspace?.shareCode) {
      sawValidCodeThisVisit.current = false;
      return;
    }
    const stillValid =
      Boolean(workspace.shareCodeExpiresAt) &&
      Date.parse(workspace.shareCodeExpiresAt ?? "") > Date.now();
    sawValidCodeThisVisit.current = stillValid;
  }, [
    workspace?.workspaceId,
    workspace?.shareCode,
    workspace?.shareCodeExpiresAt,
  ]);

  useEffect(() => {
    if (codeValid) sawValidCodeThisVisit.current = true;
  }, [codeValid]);

  /** 혼자인데 코드 만료 → 서버에서 공간 해체 후 초기 화면으로 */
  useEffect(() => {
    if (!workspace) return;
    if (codeValid) return;
    if ((workspace.memberCount ?? 0) >= 2) return;
    let cancelled = false;
    void (async () => {
      const status = await fetchWorkspaceStatus();
      if (cancelled || !status.ok) return;
      setWorkspace(status.workspace);
      sawValidCodeThisVisit.current = false;
      setNameOpen(null);
      setWsMessage("");
    })();
    return () => {
      cancelled = true;
    };
  }, [codeValid, workspace]);

  /** 이 화면에서 카운트다운이 끝난 경우에만 빨간 만료 UI (팀이 있을 때) */
  const showExpiredCodeUi =
    Boolean(workspace?.shareCode) &&
    !codeValid &&
    sawValidCodeThisVisit.current &&
    (workspace?.memberCount ?? 0) >= 2;

  /** 유효한 코드 박스 (재진입·만료 후는 생성 버튼으로 초기화) */
  const showActiveCodeUi = Boolean(workspace?.shareCode) && codeValid;

  const teammateCount = workspace?.memberCount ?? 0;
  /** 동료가 있을 때만 실제 팀. 혼자면 초대 코드만 있는 상태 */
  const hasTeam = teammateCount >= 2;
  const showTeammateList = hasTeam;

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
      setCodeConsent(null);
      setNameDraft(result.workspace.workspaceName || "");
      setNameError("");
      setNameOpen("set");
      setWsMessage(
        "공유 코드가 발급되었습니다. 공유 코드는 공유받는 기기의 「공유 코드 입력」칸에 입력하면 팀원이 됩니다."
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

  const handleReissue = async () => {
    setWsMessage("");
    setWsBusy(true);
    try {
      const result = await reissueShareCode();
      if (!result.ok) {
        setWsMessage(result.message);
        return;
      }
      setWorkspace(result.workspace);
      setCodeConsent(null);
      setWsMessage(
        "새 공유 코드가 발급되었습니다. 공유 코드는 공유받는 기기의 「공유 코드 입력」칸에 입력하면 팀원이 됩니다."
      );
    } finally {
      setWsBusy(false);
    }
  };

  const confirmCodeConsent = () => {
    if (codeConsent === "create") {
      void handleCreate();
      return;
    }
    if (codeConsent === "reissue") {
      void handleReissue();
    }
  };

  const closeNameModal = () => {
    if (wsBusy) return;
    setNameOpen(null);
    setNameError("");
  };

  const openNameEdit = () => {
    setNameDraft(workspace?.workspaceName ?? "");
    setNameError("");
    setNameOpen("edit");
  };

  const handleRename = async () => {
    const name = normalizeWorkspaceName(nameDraft);
    if (!name) {
      setNameError("팀이름을 입력해 주세요.");
      return;
    }
    setNameError("");
    setWsBusy(true);
    try {
      const result = await renameWorkspace(name);
      if (!result.ok) {
        setNameError(result.message);
        return;
      }
      setWorkspace(result.workspace);
      setNameOpen(null);
      setWsMessage("팀이름을 저장했습니다.");
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

  const planDisplay = planDisplayForUser(user);

  return (
    <main>
      <PageHeader title="내정보" backHref="/" />

      <div className="space-y-3 pb-8">
        <Card className="!p-0 overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
            <div className="flex min-w-0 items-center gap-2">
              <p className="text-[14px] font-bold text-gray-900">계정 정보</p>
              {planDisplay ? <PlanBadge plan={planDisplay} tip={false} /> : null}
            </div>
            <Link
              href="/account/edit"
              className="shrink-0 text-[13px] font-semibold text-[#3182F6] active:opacity-70"
            >
              내정보수정
            </Link>
          </div>
          <dl className="border-t border-gray-100">
            {planDisplay ? (
              <div className="flex items-center justify-between gap-3 border-b border-gray-50 px-3.5 py-2">
                <dt className="shrink-0 text-[12px] text-gray-400">이용 요금</dt>
                <dd className="min-w-0">
                  <PlanBadge plan={planDisplay} />
                </dd>
              </div>
            ) : null}
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
              코드를 생성하여 팀원과 고객·매물·네비를 공유할 수 있습니다. 공유는
              고객리스트·매물리스트·네비 리스트에서 「팀공유하기」 버튼을 눌러야
              가능합니다.
            </p>
          </div>

          {workspace ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 rounded-lg bg-gray-50 px-2.5 py-2">
                <div className="min-w-0">
                  <p className="text-[11px] text-gray-400">팀이름</p>
                  <p className="truncate text-[14px] font-bold text-gray-900">
                    {workspace.workspaceName || "미설정"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openNameEdit}
                  className="shrink-0 text-[13px] font-semibold text-[#3182F6] active:opacity-70"
                >
                  수정
                </button>
              </div>
              {showTeammateList ? (
                <div className="rounded-lg bg-gray-50 px-2.5 py-2">
                  <button
                    type="button"
                    onClick={() => setMembersOpen((v) => !v)}
                    className="flex w-full items-center justify-between rounded-md bg-white px-2 py-1.5 text-left active:scale-[0.99] transition-all duration-150"
                  >
                    <span className="text-[12px] font-bold text-gray-800">
                      공유중인 팀원 · {teammateCount}명
                    </span>
                    <span className="text-[11px] font-semibold text-[#3182F6]">
                      {membersOpen ? "접기" : "보기"}
                    </span>
                  </button>
                  {membersOpen ? (
                    <div className="mt-1.5 space-y-1">
                      {(workspace.members ?? []).map((m) => {
                        const isSelf =
                          m.userId === user.id || m.username === user.username;
                        return (
                          <div
                            key={m.userId}
                            className="flex items-center gap-2 rounded-md border border-gray-100 bg-white px-2 py-1.5 text-[12px] leading-snug text-gray-700"
                          >
                            <p className="min-w-0 flex-1 truncate">
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
                            </p>
                            {isSelf ? (
                              <button
                                type="button"
                                onClick={() => setLeaveOpen(true)}
                                className="shrink-0 text-[11px] font-bold text-red-500 active:opacity-70"
                              >
                                나가기
                              </button>
                            ) : null}
                          </div>
                        );
                      })}
                      {(workspace.members ?? []).length === 0 ? (
                        <p className="px-1 text-[11px] text-gray-400">
                          팀원 정보를 불러오지 못했습니다.
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
              {showActiveCodeUi ? (
                <div className="rounded-lg border-2 border-[#3182F6]/30 bg-[#E8F3FF] px-2.5 py-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold text-[#3182F6]">
                        공유 코드 (동료에게 전달)
                      </p>
                      <p className="mt-1 font-mono text-[22px] font-extrabold tracking-[0.2em] text-[#1B64DA]">
                        {workspace.shareCode}
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
                          onClick={() => setCodeConsent("reissue")}
                        >
                          재발급
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : showExpiredCodeUi ? (
                <div className="rounded-lg border-2 border-red-200 bg-red-50 px-2.5 py-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold text-red-600">
                        공유 코드 (
                        <span className="text-red-600">만료됨</span>
                        {" · "}
                        <span className="text-red-600">다시 발급 필요</span>)
                      </p>
                      <p className="mt-1 font-mono text-[22px] font-extrabold tracking-[0.2em] text-red-400">
                        {workspace.shareCode}
                      </p>
                      <p className="mt-1 text-[11px] font-semibold text-red-600">
                        만료된 코드로는 참여할 수 없습니다. 다시 발급해 주세요.
                      </p>
                    </div>
                    {workspace.role === "owner" ? (
                      <Button
                        disabled={wsBusy}
                        className="!min-h-[32px] !rounded-lg !bg-red-500 !px-2.5 !text-[12px] hover:!bg-red-600"
                        onClick={() => setCodeConsent("reissue")}
                      >
                        코드 다시 발급
                      </Button>
                    ) : null}
                  </div>
                </div>
              ) : workspace.role === "owner" ? (
                <Button
                  fullWidth
                  disabled={wsBusy}
                  className="!min-h-[44px] !text-[15px]"
                  onClick={() => setCodeConsent("reissue")}
                >
                  공유 코드 생성
                </Button>
              ) : (
                <p className="rounded-lg bg-gray-50 px-2.5 py-2 text-[12px] leading-snug text-gray-500">
                  공유 코드가 만료되었거나 없습니다. 생성자에게 새 코드를 요청해
                  주세요.
                </p>
              )}
            </div>
          ) : (
            <Button
              fullWidth
              disabled={wsBusy}
              className="!min-h-[44px] !text-[15px]"
              onClick={() => setCodeConsent("create")}
            >
              공유 코드 생성
            </Button>
          )}

          <div className="flex items-end gap-1.5">
            <div className="min-w-0 flex-1">
              <label className="mb-0.5 block text-[11px] font-semibold text-gray-500">
                공유 코드 입력
              </label>
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="동료에게 받은 코드"
                autoComplete="off"
                disabled={wsBusy}
                className="h-9 w-full rounded-lg border border-gray-200 bg-white px-2.5 text-[13px] font-semibold tracking-wide text-gray-900 outline-none focus:border-[#3182F6] disabled:bg-gray-50 disabled:text-gray-400"
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

          {wsMessage ? (
            <p
              className={[
                "text-[11px] font-semibold",
                wsMessage.includes("로그인") ||
                  wsMessage.includes("실패") ||
                  wsMessage.includes("네트워크") ||
                  wsMessage.includes("연결")
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
        open={leaveOpen}
        onClose={() => setLeaveOpen(false)}
        title="공유 공간 나가기"
        description="바로 나갈 수 없습니다. 이메일로 문의해 주시길 바랍니다. bek94900@gmail.com"
      >
        <Button fullWidth onClick={() => setLeaveOpen(false)}>
          확인
        </Button>
      </Modal>

      <Modal
        open={codeConsent !== null}
        onClose={() => {
          if (wsBusy) return;
          setCodeConsent(null);
        }}
        title={
          codeConsent === "reissue"
            ? "공유 코드를 다시 발급할까요?"
            : "팀 공유를 시작할까요?"
        }
        description="본인의 매물·고객 정보가 팀원과 공유될 수 있습니다. 악의적으로 팀원이 이용할 시 법적 문제가 될 수 있습니다. 그래도 진행하시겠습니까?"
      >
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="secondary"
            disabled={wsBusy}
            onClick={() => setCodeConsent(null)}
          >
            취소
          </Button>
          <Button disabled={wsBusy} onClick={() => confirmCodeConsent()}>
            {wsBusy
              ? "처리 중…"
              : codeConsent === "reissue"
                ? "동의하고 재발급"
                : "동의하고 생성"}
          </Button>
        </div>
      </Modal>

      <Modal
        open={nameOpen !== null}
        onClose={closeNameModal}
        title="팀이름"
        description="초대한 팀원과 함께 사용할 공간의 이름을 설정하세요."
        position="center"
      >
        <div className="space-y-3">
          <Input
            label="팀이름"
            value={nameDraft}
            onChange={(e) => {
              setNameDraft(e.target.value.slice(0, WORKSPACE_NAME_MAX));
              if (nameError) setNameError("");
            }}
            placeholder="예) 성내팀"
            autoComplete="off"
            hint={`${nameDraft.trim().length}/${WORKSPACE_NAME_MAX}`}
          />
          {nameError ? (
            <p className="text-[13px] font-semibold text-red-500">{nameError}</p>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="secondary"
              disabled={wsBusy}
              onClick={closeNameModal}
            >
              {nameOpen === "set" ? "나중에" : "취소"}
            </Button>
            <Button disabled={wsBusy} onClick={() => void handleRename()}>
              {wsBusy ? "저장 중…" : nameOpen === "set" ? "설정" : "저장"}
            </Button>
          </div>
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
