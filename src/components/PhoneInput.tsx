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
}

export function PhoneInput({
  label,
  value,
  onChange,
  required,
  hint,
  placeholder = "010-1234-5678",
  invalid,
}: PhoneInputProps) {
  return (
    <Input
      label={label}
      required={required}
      invalid={invalid}
      type="tel"
      inputMode="numeric"
      autoComplete="tel"
      value={formatPhoneInput(value)}
      onChange={(e) => onChange(formatPhoneInput(e.target.value))}
      placeholder={placeholder}
      hint={
        invalid
          ? "미입력"
          : hint === undefined
            ? "숫자만 입력해도 - 가 자동으로 붙어요"
            : hint || undefined
      }
    />
  );
}
