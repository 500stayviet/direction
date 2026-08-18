"use client";

import { Input } from "@/components/ui/Input";

export function ManAmountInput({
  label,
  value,
  onChange,
  required,
  invalid,
  placeholder,
  hint,
  unitHint,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  required?: boolean;
  invalid?: boolean;
  placeholder?: string;
  hint?: string;
  unitHint?: string;
}) {
  return (
    <Input
      label={label}
      required={required}
      invalid={invalid}
      hint={hint}
      unitHint={unitHint}
      suffix="만원"
      type="number"
      inputMode="numeric"
      value={value || ""}
      placeholder={placeholder}
      onChange={(e) => onChange(Number(e.target.value) || 0)}
    />
  );
}
