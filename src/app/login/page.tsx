"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { BrandIcon } from "@/components/BrandIcon";
import {
  hardRedirectHome,
  loginUser,
  resetPasswordWithHint,
} from "@/lib/auth";
import { seedDemoDataIfNeeded } from "@/lib/seedDemo";
import { InstallAppGuide } from "@/components/InstallAppGuide";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
    setLoading(true);
    try {
      const result = await loginUser(username, password);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      await seedDemoDataIfNeeded();
      hardRedirectHome();
    } finally {
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

    if (newPassword !== newPasswordConfirm) {
      setFindError("새 비밀번호 확인이 일치하지 않습니다.");
      return;
    }

    setFindLoading(true);
    try {
      const result = await resetPasswordWithHint(
        findUsername,
        findHint,
        newPassword
      );
      if (!result.ok) {
        setFindError(result.message);
        return;
      }
      setFindSuccess(true);
      setUsername(findUsername.trim());
      setPassword(newPassword);
      setShowPassword(true);
    } finally {
      setFindLoading(false);
    }
  };

  return (
    <main className="relative flex min-h-[calc(100dvh-5.5rem)] flex-col justify-center overflow-hidden py-4">
      <div
        className="pointer-events-none absolute -left-16 -top-10 h-56 w-56 rounded-full bg-[#3182F6]/10"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-20 bottom-24 h-48 w-48 rounded-full bg-[#3182F6]/[0.08]"
        aria-hidden
      />

      <div className="relative mb-4 px-1 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center overflow-hidden rounded-[18px] shadow-[0_10px_24px_rgba(49,130,246,0.35)]">
          <BrandIcon size={56} />
        </div>
        <p className="mt-3 text-[13px] font-bold tracking-tight text-[#3182F6]">
          현장동선
        </p>
        <h1 className="mt-1 text-[26px] font-bold tracking-tight text-gray-900">
          로그인
        </h1>
        <p className="mt-1.5 text-[13px] leading-relaxed text-gray-500">
          가입한 아이디로 현장에 바로 접속하세요
        </p>
      </div>

      <form onSubmit={handleSubmit} className="relative space-y-4">
        <div className="space-y-3 rounded-[24px] border border-gray-100 bg-white p-4 shadow-[0_8px_30px_rgba(15,23,42,0.06)]">
          <AuthField
            label="아이디"
            required
            value={username}
            onChange={setUsername}
            placeholder="아이디를 입력하세요"
            autoComplete="username"
            icon={<UserIcon />}
          />
          <AuthField
            label="비밀번호"
            required
            value={password}
            onChange={setPassword}
            placeholder="비밀번호를 입력하세요"
            autoComplete="current-password"
            type={showPassword ? "text" : "password"}
            icon={<LockIcon />}
            trailing={
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="rounded-lg px-2 py-1 text-[12px] font-bold text-[#3182F6] active:scale-95 transition-all duration-150"
              >
                {showPassword ? "숨김" : "보기"}
              </button>
            }
          />

          <div className="flex justify-end">
            <button
              type="button"
              onClick={openFind}
              className="text-[13px] font-semibold text-gray-500 underline-offset-2 hover:text-[#3182F6] hover:underline active:scale-95 transition-all duration-150"
            >
              비밀번호 찾기
            </button>
          </div>

          {error && (
            <p className="rounded-xl bg-red-50 px-3 py-2.5 text-[13px] font-semibold text-red-600">
              {error}
            </p>
          )}
        </div>

        <Button type="submit" fullWidth size="lg" disabled={loading}>
          {loading ? "로그인 중..." : "로그인"}
        </Button>

        <div className="flex flex-wrap items-center justify-center gap-x-1.5 pt-1 text-[13px]">
          <span className="text-gray-400">아직 계정이 없으신가요?</span>
          <Link
            href="/signup"
            className="font-bold text-[#3182F6] active:scale-95 transition-all duration-150"
          >
            회원가입하기
          </Link>
        </div>
        <p className="text-center text-[12px] text-gray-400">
          <Link
            href="/terms"
            className="font-semibold text-gray-500 underline-offset-2 hover:text-[#3182F6] hover:underline"
          >
            이용약관 · 면책 안내
          </Link>
        </p>
      </form>

      <InstallAppGuide className="relative mt-5" />

      <Modal
        open={findOpen}
        onClose={() => setFindOpen(false)}
        position="center"
        dense
        className="max-w-[340px] !rounded-[28px]"
        title="비밀번호 찾기"
      >
        <p className="-mt-1 mb-3 text-[13px] leading-relaxed text-gray-500">
          가입할 때 등록한{" "}
          <span className="font-bold text-gray-700">아이디</span>와{" "}
          <span className="font-bold text-gray-700">비밀번호 힌트</span>를
          확인한 뒤, 새 비밀번호를 설정합니다.
        </p>

        {findSuccess ? (
          <div className="space-y-3">
            <div className="rounded-2xl bg-blue-50 px-4 py-3 text-center">
              <p className="text-[13px] font-semibold text-[#3182F6]">
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
          <form onSubmit={handleFind} className="space-y-3">
            <AuthField
              label="아이디"
              required
              value={findUsername}
              onChange={setFindUsername}
              placeholder="가입한 아이디"
              autoComplete="username"
            />
            <AuthField
              label="비밀번호 힌트"
              required
              value={findHint}
              onChange={setFindHint}
              placeholder="가입 시 입력한 힌트"
              autoComplete="off"
            />
            <AuthField
              label="새 비밀번호"
              required
              value={newPassword}
              onChange={setNewPassword}
              placeholder="6자 이상"
              type="password"
              autoComplete="new-password"
            />
            <AuthField
              label="새 비밀번호 확인"
              required
              value={newPasswordConfirm}
              onChange={setNewPasswordConfirm}
              placeholder="다시 입력"
              type="password"
              autoComplete="new-password"
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

function AuthField({
  label,
  value,
  onChange,
  placeholder,
  required,
  type = "text",
  autoComplete,
  icon,
  trailing,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: string;
  autoComplete?: string;
  icon?: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[13px] font-semibold text-gray-600">
        {label}
        {required && <span className="ml-0.5 text-[#3182F6]">*</span>}
      </span>
      <div className="flex min-h-[52px] items-center gap-2 rounded-2xl border border-gray-200 bg-gray-50 px-3.5 transition focus-within:border-[#3182F6] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#3182F6]/20">
        {icon && (
          <span className="shrink-0 text-gray-400" aria-hidden>
            {icon}
          </span>
        )}
        <input
          className="min-w-0 flex-1 bg-transparent py-3 text-[16px] font-medium text-gray-900 outline-none placeholder:font-normal placeholder:text-gray-400"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          type={type}
          autoComplete={autoComplete}
        />
        {trailing}
      </div>
    </label>
  );
}

function UserIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="2" />
      <path
        d="M5 19c1.5-3.5 4-5 7-5s5.5 1.5 7 5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 11V8a5 5 0 0 1 10 0v3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <rect
        x="5"
        y="11"
        width="14"
        height="10"
        rx="2.5"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  );
}
