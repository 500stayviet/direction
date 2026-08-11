"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { PhoneInput } from "@/components/PhoneInput";
import { StickyActionBar } from "@/components/StickyActionBar";
import { getCurrentUser, updateProfile } from "@/lib/auth";
import type { User } from "@/lib/types";

export default function AccountEditPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [shopName, setShopName] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [passwordHint, setPasswordHint] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
      setShopName(u.shopName === "현장동선" ? "" : u.shopName);
      setName(u.name === u.username ? "" : u.name);
      setPhone(u.phone ?? "");
      setPasswordHint(u.passwordHint ?? "");
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await updateProfile({
        shopName,
        name,
        phone,
        passwordHint,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.replace("/account");
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <main className="py-20 text-center text-gray-500">불러오는 중...</main>
    );
  }

  return (
    <main>
      <PageHeader title="내정보수정" backHref="/account" />

      <form id="account-edit-form" onSubmit={handleSubmit} className="pb-4">
        <Card className="space-y-2.5">
          <p className="rounded-xl bg-[#E8F3FF] px-3 py-2.5 text-[12px] font-medium leading-relaxed text-[#1B64DA]">
            업장명·이름·전화번호는 매물 공유 시 고객에게 안내되는 연락
            정보예요. 아이디는 변경할 수 없습니다.
          </p>
          <Input label="아이디" value={user.username} disabled />
          <Input
            label="업장명"
            value={shopName}
            onChange={(e) => setShopName(e.target.value)}
            placeholder="예: 천호동 (선택)"
            hint="「부동산」「공인중개사사무소」가 없으면 저장 시 공인중개사사무소가 붙습니다"
          />
          <Input
            label="이름"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="홍길동 (선택)"
          />
          <PhoneInput
            label="전화번호"
            value={phone}
            onChange={setPhone}
            hint="선택 입력 · 매물 공유 시 사용"
          />
          <Input
            label="비밀번호 힌트"
            required
            value={passwordHint}
            onChange={(e) => setPasswordHint(e.target.value)}
            placeholder="비밀번호를 떠올릴 힌트"
            autoComplete="off"
          />
          {error ? (
            <p className="text-[13px] font-semibold text-red-500">{error}</p>
          ) : null}
        </Card>
      </form>

      <StickyActionBar>
        <Button
          type="submit"
          form="account-edit-form"
          fullWidth
          size="lg"
          disabled={loading}
        >
          {loading ? "저장 중…" : "변경사항 저장"}
        </Button>
      </StickyActionBar>
    </main>
  );
}
