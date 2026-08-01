"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { PhoneInput } from "@/components/PhoneInput";
import { BrandIcon } from "@/components/BrandIcon";
import { hardRedirectHome, registerUser } from "@/lib/auth";
import { seedDemoDataIfNeeded } from "@/lib/seedDemo";

export default function SignupPage() {
  const [shopName, setShopName] = useState("");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [phone, setPhone] = useState("");
  const [passwordHint, setPasswordHint] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!agreed) {
      setError("이용약관 및 면책 안내에 동의해 주세요.");
      return;
    }
    const result = registerUser({
      shopName,
      name,
      username,
      password,
      passwordConfirm,
      phone,
      passwordHint,
    });
    if (!result.ok) {
      setError(result.message);
      return;
    }
    seedDemoDataIfNeeded();
    hardRedirectHome();
  };

  return (
    <main className="py-6 pb-10">
      <div className="mb-6 px-1">
        <div className="mb-3 flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl shadow-[0_8px_20px_rgba(49,130,246,0.3)]">
          <BrandIcon size={48} />
        </div>
        <p className="text-[13px] font-bold text-[#3182F6]">현장동선</p>
        <h1 className="mt-2 text-[28px] font-bold tracking-tight text-gray-900">
          회원가입
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          아이디·비밀번호·확인·힌트만 필수예요. 나머지는 선택입니다.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <Card className="space-y-2.5">
          <Input
            label="업장명"
            value={shopName}
            onChange={(e) => setShopName(e.target.value)}
            placeholder="성내동 ○○부동산 (선택)"
          />
          <Input
            label="이름"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="홍길동 (선택)"
          />
          <Input
            label="아이디"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="4자 이상"
            autoComplete="username"
          />
          <Input
            label="비밀번호"
            required
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="4자 이상"
            autoComplete="new-password"
          />
          <Input
            label="비밀번호 확인"
            required
            type="password"
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            placeholder="비밀번호 다시 입력"
            autoComplete="new-password"
          />
          <PhoneInput
            label="전화번호"
            value={phone}
            onChange={setPhone}
            hint="선택 입력"
          />
          <Input
            label="비밀번호 힌트"
            required
            value={passwordHint}
            onChange={(e) => setPasswordHint(e.target.value)}
            placeholder="본인만 알아볼 수 있는 힌트"
            hint="비밀번호 찾을 때 쓰는 힌트예요. 잊지 마세요."
          />
          {error && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">
              {error}
            </p>
          )}
        </Card>

        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-gray-100 bg-white px-3.5 py-3 active:scale-[0.99] transition-all duration-150">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-1 h-5 w-5 shrink-0 rounded border-gray-300 text-[#3182F6] accent-[#3182F6]"
          />
          <span className="text-[13px] leading-relaxed text-gray-600">
            <Link
              href="/terms"
              className="font-bold text-[#3182F6] underline-offset-2 hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              이용약관 · 개인정보 · 면책 안내
            </Link>
            에 동의합니다.
            <span className="mt-1 block text-[12px] text-gray-400">
              무료 편의 도구이며, 필요한 분만 자발적으로 이용합니다.
            </span>
          </span>
        </label>

        <Button type="submit" fullWidth size="lg" disabled={!agreed}>
          가입하고 시작하기
        </Button>
        <Link href="/login">
          <Button type="button" variant="secondary" fullWidth className="mt-2">
            이미 계정이 있어요
          </Button>
        </Link>
      </form>
    </main>
  );
}
