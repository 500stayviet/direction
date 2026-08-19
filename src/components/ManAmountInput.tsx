"use client";

import { useState } from "react";
import { Field, Input } from "@/components/ui/Input";
import { formatManReadable } from "@/lib/format";
import { controlStatusClass } from "@/lib/uiInvalid";

/** 매매가·보증금 — 입력 후 파란 칸에 억·만원으로 표시 */
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
  const [focused, setFocused] = useState(false);
  const showChip = value > 0 && !focused && !invalid;

  if (showChip) {
    return (
      <Field
        label={label}
        required={required}
        invalid={invalid}
        hint={hint}
        unitHint={unitHint}
      >
        <button
          type="button"
          onClick={() => setFocused(true)}
          className={[
            "flex h-[36px] min-h-[36px] w-full items-center justify-center rounded-xl px-3.5 text-[16px]",
            controlStatusClass({ filled: true }),
            "active:scale-95 transition-all duration-150",
          ].join(" ")}
        >
          {formatManReadable(value)}
        </button>
      </Field>
    );
  }

  return (
    <Input
      label={label}
      required={required}
      invalid={invalid}
      hint={hint}
      unitHint={unitHint}
      type="text"
      inputMode="numeric"
      autoFocus={focused}
      value={value || ""}
      placeholder={placeholder}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={(e) => {
        const raw = e.target.value.replace(/[^\d]/g, "");
        onChange(raw === "" ? 0 : Number(raw) || 0);
      }}
    />
  );
}
