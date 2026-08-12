"use client";

import { Input } from "@/components/ui/Input";

interface CustomerSearchInputProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
}

/** 성함 · 전화번호 · 보증금·매매가·월세 검색 */
export function CustomerSearchInput({
  label = "성함, 전화번호, 보증금 매매가 월세로 검색",
  value,
  onChange,
}: CustomerSearchInputProps) {
  return (
    <Input
      label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="홍길동 · 010… · 5000"
      inputMode="search"
      autoComplete="off"
    />
  );
}
