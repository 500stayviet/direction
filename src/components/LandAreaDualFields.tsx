"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";
import {
  formatAreaDisplay,
  formatAreaWithUnit,
  m2ToPyeong,
  parseAreaInput,
  pyeongToM2,
} from "@/lib/landArea";

export function LandAreaDualFields({
  label,
  pyeong,
  onChange,
  pyeongPlaceholder = "예) 45.00 평",
  m2Placeholder = "예) 148.76 ㎡",
}: {
  label: string;
  pyeong?: number;
  onChange: (pyeong?: number) => void;
  pyeongPlaceholder?: string;
  m2Placeholder?: string;
}) {
  const [editing, setEditing] = useState<"pyeong" | "m2" | null>(null);
  const [draft, setDraft] = useState("");

  const m2 = pyeong == null ? undefined : pyeongToM2(pyeong);
  const editingPyeong = editing === "pyeong";
  const editingM2 = editing === "m2";

  const commit = (side: "pyeong" | "m2", raw: string) => {
    const n = parseAreaInput(raw);
    if (n == null) {
      onChange(undefined);
      return;
    }
    onChange(side === "pyeong" ? n : m2ToPyeong(n));
  };

  return (
    <div className="space-y-1">
      <p className="text-[13px] font-semibold text-gray-600">{label}</p>
      <div className="grid grid-cols-2 gap-2">
        <Input
          label=""
          aria-label={`${label} 평`}
          inputMode="decimal"
          placeholder={pyeongPlaceholder}
          value={
            editingPyeong
              ? draft
              : formatAreaWithUnit(pyeong, "평")
          }
          onFocus={() => {
            setEditing("pyeong");
            setDraft(formatAreaDisplay(pyeong));
          }}
          onChange={(e) => {
            const raw = e.target.value;
            setDraft(raw);
            commit("pyeong", raw);
          }}
          onBlur={() => {
            setEditing(null);
            setDraft("");
          }}
        />
        <Input
          label=""
          aria-label={`${label} ㎡`}
          inputMode="decimal"
          placeholder={m2Placeholder}
          value={
            editingM2 ? draft : formatAreaWithUnit(m2, "㎡")
          }
          onFocus={() => {
            setEditing("m2");
            setDraft(formatAreaDisplay(m2));
          }}
          onChange={(e) => {
            const raw = e.target.value;
            setDraft(raw);
            commit("m2", raw);
          }}
          onBlur={() => {
            setEditing(null);
            setDraft("");
          }}
        />
      </div>
    </div>
  );
}
