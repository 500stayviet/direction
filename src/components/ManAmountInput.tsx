"use client";

import { useState } from "react";
import { Field, Input } from "@/components/ui/Input";
import { formatManReadable } from "@/lib/format";
import { filledBoxClass } from "@/lib/uiInvalid";

/** 매매가·보증금 — 입력 후 파란 칸에 억/천·만원으로 표시 */
function manAmountChipLabel(value: number): string {
  const readable = formatManReadable(value);
  if (!readable) return "";
  if (readable.includes("만원") || readable.includes("억")) return readable;
  return `${readable}만원`;
}

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
            "flex min-h-[42px] w-full items-center justify-center rounded-xl px-3.5 text-[16px]",
            filledBoxClass,
            "active:scale-95 transition-all duration-150",
          ].join(" ")}
        >
          {manAmountChipLabel(value)}
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
      suffix="만원"
      type="number"
      inputMode="numeric"
      autoFocus={focused}
      value={value || ""}
      placeholder={placeholder}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={(e) => onChange(Number(e.target.value) || 0)}
    />
  );
}
