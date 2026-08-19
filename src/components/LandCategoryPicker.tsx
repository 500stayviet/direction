"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { LAND_CATEGORIES } from "@/lib/landCategories";
import { controlStatusClass } from "@/lib/uiInvalid";

export function LandSelectPicker({
  label,
  selectLabel,
  title,
  description,
  value,
  options,
  onChange,
}: {
  label: string;
  selectLabel: string;
  title: string;
  description?: string;
  value: string;
  options: readonly string[];
  onChange: (next: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const hasValue = Boolean(value.trim());

  return (
    <div className="space-y-1">
      <p className="text-[13px] font-semibold text-gray-600">{label}</p>
      {hasValue ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={[
            "flex min-h-[36px] w-full items-center justify-center rounded-xl px-4 text-[15px]",
            "active:scale-95 transition-all duration-150",
            controlStatusClass({ filled: true }),
          ].join(" ")}
        >
          {value}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={[
            "flex min-h-[36px] w-full items-center justify-center rounded-xl px-4 text-[15px] font-bold",
            controlStatusClass({ filled: false }),
            "active:scale-95 transition-all duration-150",
          ].join(" ")}
        >
          {selectLabel}
        </button>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        description={description}
        dense
        footer={
          <Button fullWidth variant="secondary" onClick={() => setOpen(false)}>
            닫기
          </Button>
        }
      >
        <div className="grid max-h-[55vh] grid-cols-3 gap-1.5 overflow-y-auto pb-1">
          {options.map((opt) => {
            const active = value === opt;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  onChange(opt);
                  setOpen(false);
                }}
                className={[
                  "min-h-[44px] rounded-xl px-1 text-[13px] font-bold transition-all active:scale-95",
                  active
                    ? "bg-[#3182F6] text-white"
                    : "bg-gray-100 text-gray-700",
                ].join(" ")}
              >
                {opt}
              </button>
            );
          })}
        </div>
      </Modal>
    </div>
  );
}

export function LandCategoryPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <LandSelectPicker
      label="지목"
      selectLabel="지목선택"
      title="지목 선택"
      description="지적 기준 지목을 선택하세요"
      value={value}
      options={LAND_CATEGORIES}
      onChange={onChange}
    />
  );
}
