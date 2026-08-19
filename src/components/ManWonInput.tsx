"use client";

import { useState } from "react";
import { Field, Input } from "@/components/ui/Input";
import { controlStatusClass } from "@/lib/uiInvalid";

/** 월세·관리비 — 숫자 + 「만원」(보증금·매매가 ManAmountInput 과 구분) */
export function ManWonInput({
  label,
  value,
  onChange,
  required,
  invalid,
  placeholder = "예) 50",
  allowEmpty = false,
}: {
  label: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  required?: boolean;
  invalid?: boolean;
  placeholder?: string;
  /** true면 빈 칸 허용(관리비). false면 0=미입력(월세) */
  allowEmpty?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const hasValue =
    value != null && Number.isFinite(value) && (allowEmpty ? true : value > 0);
  const showChip = hasValue && !focused && !invalid;

  if (showChip) {
    return (
      <Field label={label} required={required} invalid={invalid}>
        <button
          type="button"
          onClick={() => setFocused(true)}
          className={[
            "flex h-[36px] min-h-[36px] w-full items-center justify-center rounded-xl px-3.5 text-[16px] tabular-nums",
            controlStatusClass({ filled: true }),
            "active:scale-95 transition-all duration-150",
          ].join(" ")}
        >
          {value}만원
        </button>
      </Field>
    );
  }

  return (
    <Input
      label={label}
      required={required}
      invalid={invalid}
      type="text"
      inputMode="numeric"
      autoFocus={focused}
      value={hasValue ? value : ""}
      placeholder={placeholder}
      suffix="만원"
      suffixCompact
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={(e) => {
        const raw = e.target.value.replace(/[^\d]/g, "");
        if (raw === "") {
          onChange(allowEmpty ? undefined : 0);
          return;
        }
        const n = Number(raw);
        if (!Number.isFinite(n) || n < 0) return;
        onChange(n);
      }}
    />
  );
}
