"use client";

import { formatPhoneInput } from "@/lib/format";
import { Input } from "@/components/ui/Input";

interface PhoneInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  hint?: string;
  placeholder?: string;
  invalid?: boolean;
  /** 반영된 값 — 파란 칸, 흰 글자 */
  accent?: boolean;
  /** 비었을 때 빨간 안내. 기본 미입력 */
  invalidHint?: string;
  /** 라벨 우측 안내 (예: 동일 고객 존재) */
  labelRight?: React.ReactNode;
  chipWhenFilled?: boolean;
  chipTone?: "blue" | "green";
  labelHint?: string;
}

export function PhoneInput({
  label,
  value,
  onChange,
  required,
  hint,
  placeholder = "010-1234-5678",
  invalid,
  accent,
  labelRight,
  chipWhenFilled = true,
  chipTone = "blue",
  labelHint,
}: PhoneInputProps) {
  return (
    <Input
      label={label}
      required={required}
      invalid={invalid}
      accent={Boolean(accent)}
      chipWhenFilled={chipWhenFilled}
      chipTone={chipTone}
      labelRight={labelRight}
      labelHint={labelHint}
      type="text"
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck={false}
      name="realty-phone"
      data-lpignore="true"
      data-1p-ignore="true"
      value={formatPhoneInput(value)}
      onChange={(e) => onChange(formatPhoneInput(e.target.value))}
      placeholder={placeholder}
      hint={invalid ? undefined : hint || undefined}
    />
  );
}
