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
  /** 라벨 우측 안내 (예: 동일 고객 존재) */
  labelRight?: React.ReactNode;
  labelHint?: string;
  unitHint?: string;
}

export function PhoneInput({
  label,
  value,
  onChange,
  required,
  hint,
  placeholder = "010-1234-5678",
  invalid,
  labelRight,
  labelHint,
  unitHint,
}: PhoneInputProps) {
  return (
    <Input
      label={label}
      required={required}
      invalid={invalid}
      filledVariant="identity"
      labelRight={labelRight}
      labelHint={labelHint}
      unitHint={unitHint}
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
