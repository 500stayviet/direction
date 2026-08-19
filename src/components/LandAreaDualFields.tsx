"use client";

import { useState } from "react";
import { Field, Input } from "@/components/ui/Input";
import {
  formatAreaChip,
  formatAreaDisplay,
  m2ToPyeong,
  parseAreaInput,
  pyeongToM2,
} from "@/lib/landArea";
import { controlStatusClass } from "@/lib/uiInvalid";

function AreaUnitInput({
  unit,
  value,
  onChange,
  placeholder,
  ariaLabel,
}: {
  unit: "평" | "㎡";
  value?: number;
  onChange: (value: number | undefined) => void;
  placeholder: string;
  ariaLabel: string;
}) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState("");
  const hasValue = value != null && Number.isFinite(value);
  const showChip = hasValue && !focused;

  if (showChip) {
    return (
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={() => {
          setFocused(true);
          setDraft(formatAreaDisplay(value));
        }}
        className={[
          "flex h-[36px] min-h-[36px] w-full items-center justify-center rounded-xl px-3.5 text-[16px] tabular-nums",
          controlStatusClass({ filled: true }),
          "active:scale-95 transition-all duration-150",
        ].join(" ")}
      >
        {formatAreaChip(value)}
        {unit}
      </button>
    );
  }

  return (
    <Input
      label=""
      aria-label={ariaLabel}
      inputMode="decimal"
      placeholder={placeholder}
      autoFocus={focused}
      value={focused ? draft : hasValue ? formatAreaDisplay(value) : ""}
      onFocus={() => {
        setFocused(true);
        setDraft(formatAreaDisplay(value));
      }}
      onBlur={() => {
        setFocused(false);
        setDraft("");
      }}
      onChange={(e) => {
        const raw = e.target.value;
        setDraft(raw);
        onChange(parseAreaInput(raw));
      }}
    />
  );
}

export function LandAreaDualFields({
  label,
  labelNote,
  pyeong,
  onChange,
  pyeongPlaceholder = "예) 45.00",
  m2Placeholder = "예) 148.76",
}: {
  label: string;
  labelNote?: string;
  pyeong?: number;
  onChange: (pyeong?: number) => void;
  pyeongPlaceholder?: string;
  m2Placeholder?: string;
}) {
  const m2 = pyeong == null ? undefined : pyeongToM2(pyeong);

  return (
    <Field
      label={label}
      labelNote={labelNote}
      invalid={false}
    >
      <div className="grid grid-cols-2 gap-2">
        <AreaUnitInput
          unit="평"
          ariaLabel={`${label} 평`}
          placeholder={pyeongPlaceholder}
          value={pyeong}
          onChange={onChange}
        />
        <AreaUnitInput
          unit="㎡"
          ariaLabel={`${label} ㎡`}
          placeholder={m2Placeholder}
          value={m2}
          onChange={(n) => onChange(n == null ? undefined : m2ToPyeong(n))}
        />
      </div>
    </Field>
  );
}
