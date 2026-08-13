"use client";

interface ListSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  /** 접근성용 (화면에 라벨 표시 안 함) */
  "aria-label"?: string;
}

/** 리스트 상단 검색 — 라벨·카드 없이 한 줄로 압축 */
export function ListSearchInput({
  value,
  onChange,
  placeholder,
  "aria-label": ariaLabel,
}: ListSearchInputProps) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={ariaLabel ?? placeholder}
      inputMode="search"
      autoComplete="off"
      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-[15px] text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-[#3182F6] focus:ring-2 focus:ring-[#3182F6]/20"
    />
  );
}

/** @deprecated ListSearchInput 사용 */
export function CustomerSearchInput({
  value,
  onChange,
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <ListSearchInput
      value={value}
      onChange={onChange}
      placeholder="이름 · 전화 · 보증금"
      aria-label="고객 검색"
    />
  );
}
