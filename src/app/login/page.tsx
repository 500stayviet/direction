"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { loginUser, resetPasswordWithHint } from "@/lib/auth";
import { InstallAppGuide } from "@/components/InstallAppGuide";
import { markSignupWelcomePending } from "@/lib/signupWelcome";
import { isAutoLoginEnabled, setAutoLoginEnabled } from "@/lib/loginPrefs";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-[calc(100dvh-5rem)] items-center justify-center text-sm text-gray-400">
          불러오는 중...
        </main>
      }
    >
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [autoLogin, setAutoLogin] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const registered = searchParams.get("registered") === "1";
    const preset = searchParams.get("username")?.trim() ?? "";
    if (registered) {
      markSignupWelcomePending();
      setSuccess("회원가입이 완료되었습니다. 로그인해 주세요.");
    }
    if (preset) setUsername(preset);
    setAutoLogin(isAutoLoginEnabled());
  }, [searchParams]);

  const [findOpen, setFindOpen] = useState(false);
  const [findUsername, setFindUsername] = useState("");
  const [findHint, setFindHint] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [findError, setFindError] = useState("");
  const [findSuccess, setFindSuccess] = useState(false);
  const [findLoading, setFindLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      const result = await loginUser(username, password, { autoLogin });
      if (!result.ok) {
        setError(result.message);
        setLoading(false);
        return;
      }

      setAutoLoginEnabled(autoLogin);

      // 세션 백업 저장 후 홈으로 (하드 새로고침 없이 → 스플래시 재표시 방지)
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "로그인 중 오류가 났습니다.");
      setLoading(false);
    }
  };

  const openFind = () => {
    setFindUsername(username);
    setFindHint("");
    setNewPassword("");
    setNewPasswordConfirm("");
    setFindError("");
    setFindSuccess(false);
    setFindOpen(true);
  };

  const handleFind = async (e: FormEvent) => {
    e.preventDefault();
    setFindError("");
    setFindSuccess(false);

    const nextPassword = newPassword.normalize("NFKC").trim();
    const nextConfirm = newPasswordConfirm.normalize("NFKC").trim();
    if (nextPassword !== nextConfirm) {
      setFindError("새 비밀번호 확인이 일치하지 않습니다.");
      return;
    }

    setFindLoading(true);
    try {
      const result = await resetPasswordWithHint(
        findUsername,
        findHint,
        nextPassword
      );
      if (!result.ok) {
        setFindError(result.message);
        return;
      }
      // 자동 로그인 하지 않음 — 변경만 하고 로그인 칸에 넣어 둠 (멈춤 방지)
      setFindSuccess(true);
      setUsername(findUsername.trim().toLowerCase());
      setPassword(nextPassword);
    } catch (err) {
      setFindError(
        err instanceof Error ? err.message : "비밀번호 변경에 실패했습니다."
      );
    } finally {
      setFindLoading(false);
    }
  };

  return (
    <main className="py-6">
      <div className="mb-4 px-1">
        <p className="text-[13px] font-bold text-[#3182F6]">현장동선</p>
        <h1 className="mt-2 text-[28px] font-bold tracking-tight text-gray-900">
          로그인
        </h1>
        <p className="mt-1.5 text-[13px] leading-relaxed text-gray-500">
          가입한 아이디로 현장에 바로 접속하세요
        </p>
      </div>

      {success ? (
        <p className="mb-3 rounded-xl bg-gray-50 px-3.5 py-2.5 text-[13px] font-semibold text-gray-700">
          {success}
        </p>
      ) : null}
      <InstallAppGuide className="mb-3 shrink-0" />

      <form onSubmit={handleSubmit} className="space-y-3">
        <Card className="space-y-2.5">
          <Input
            label="아이디"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="아이디를 입력하세요"
            autoComplete="username"
            filledVariant="plain"
          />
          <Input
            label="비밀번호"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호를 입력하세요"
            autoComplete="current-password"
            filledVariant="plain"
          />

          <div className="flex items-center justify-between gap-3 px-0.5 pt-0.5">
            <label className="flex cursor-pointer items-center gap-1.5 text-[12px] font-medium text-gray-500">
              <input
                type="checkbox"
                checked={autoLogin}
                onChange={(e) => {
                  const on = e.target.checked;
                  setAutoLogin(on);
                  setAutoLoginEnabled(on);
                }}
                className="h-3.5 w-3.5 shrink-0 rounded border-gray-300 text-[#3182F6] accent-[#3182F6]"
              />
              자동로그인
            </label>
            <button
              type="button"
              onClick={openFind}
              className="text-[12px] font-semibold text-gray-500 underline-offset-2 hover:text-gray-700 hover:underline active:scale-95 transition-all duration-150"
            >
              비밀번호 변경
            </button>
          </div>

          {error && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">
              {error}
            </p>
          )}
        </Card>

        <Button type="submit" fullWidth size="lg" disabled={loading}>
          {loading ? "로그인 중..." : "로그인"}
        </Button>

        <div className="flex flex-wrap items-center gap-x-1.5 px-0.5 text-[13px]">
          <span className="text-gray-400">아직 계정이 없으신가요?</span>
          <Link
            href="/signup"
            className="font-bold text-[#3182F6] active:scale-95 transition-all duration-150"
          >
            회원가입하기
          </Link>
        </div>
        <p className="px-0.5 text-[12px] text-gray-400">
          <Link
            href="/terms"
            className="font-semibold text-gray-500 underline-offset-2 hover:text-[#3182F6] hover:underline"
          >
            이용약관 · 개인정보 · 광고 · 면책 안내
          </Link>
        </p>
      </form>

      <Modal
        open={findOpen}
        onClose={() => setFindOpen(false)}
        position="center"
        dense
        className="max-w-[340px] !rounded-[28px]"
        title={findSuccess ? "변경 완료" : "비밀번호 변경"}
      >
        {findSuccess ? (
          <div className="space-y-3">
            <div className="rounded-2xl bg-gray-50 px-4 py-3">
              <p className="text-[13px] font-semibold text-gray-800">
                새 비밀번호가 설정되었습니다
              </p>
              <p className="mt-1 text-[12px] text-gray-600">
                로그인 칸에 새 비밀번호를 넣어 두었어요.
              </p>
            </div>
            <Button fullWidth onClick={() => setFindOpen(false)}>
              로그인하기
            </Button>
          </div>
        ) : (
          <form onSubmit={handleFind} className="space-y-2.5">
            <Input
              label="아이디"
              required
              value={findUsername}
              onChange={(e) => setFindUsername(e.target.value)}
              placeholder="가입한 아이디"
              autoComplete="username"
              filledVariant="plain"
            />
            <Input
              label="비밀번호 힌트"
              required
              value={findHint}
              onChange={(e) => setFindHint(e.target.value)}
              placeholder="가입 시 입력한 힌트"
              autoComplete="off"
              filledVariant="plain"
            />
            <Input
              label="새 비밀번호"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="6자 이상"
              type="password"
              autoComplete="new-password"
              filledVariant="plain"
            />
            <Input
              label="새 비밀번호 확인"
              required
              value={newPasswordConfirm}
              onChange={(e) => setNewPasswordConfirm(e.target.value)}
              placeholder="다시 입력"
              type="password"
              autoComplete="new-password"
              filledVariant="plain"
            />
            {findError && (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-[13px] font-semibold text-red-600">
                {findError}
              </p>
            )}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setFindOpen(false)}
              >
                취소
              </Button>
              <Button type="submit" disabled={findLoading}>
                {findLoading ? "변경 중..." : "변경"}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </main>
  );
}
