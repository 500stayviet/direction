"use client";

import { formatPhoneInput, onlyDigits } from "@/lib/format";
import { Input } from "@/components/ui/Input";

interface CustomerSearchInputProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
}

/** 성함은 그대로, 숫자 입력 시 한국 전화번호 하이픈 자동 적용 */
export function CustomerSearchInput({
  label = "성함 / 전화번호 검색",
  value,
  onChange,
}: CustomerSearchInputProps) {
  const handleChange = (raw: string) => {
    const digits = onlyDigits(raw, 20);
    // 숫자만(또는 하이픈만 포함) 입력 중이면 전화번호 포맷
    if (digits.length > 0 && /^[\d\s-]+$/.test(raw)) {
      onChange(formatPhoneInput(raw));
      return;
    }
    onChange(raw);
  };

  return (
    <Input
      label={label}
      value={value}
      onChange={(e) => handleChange(e.target.value)}
      placeholder="홍길동 또는 01011111111"
      hint="- 없이 입력해도 검색돼요 · 숫자는 자동으로 - 붙음"
      inputMode="search"
      autoComplete="off"
    />
  );
}
