"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { LAND_CATEGORIES } from "@/lib/landCategories";
import { controlStatusClass } from "@/lib/uiInvalid";

export function LandCategoryPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const hasValue = Boolean(value.trim());

  return (
    <div className="space-y-1">
      <p className="text-[13px] font-semibold text-gray-600">지목</p>
      {hasValue ? (
        <div
          className={[
            "flex min-h-[36px] w-full items-center gap-2 rounded-xl px-4 text-[15px]",
            controlStatusClass({ filled: true }),
          ].join(" ")}
        >
          <button
            type="button"
            className="min-w-0 flex-1 truncate text-left font-bold"
            onClick={() => setOpen(true)}
          >
            {value}
          </button>
          <button
            type="button"
            className="shrink-0 text-[11px] font-normal text-white/80"
            onClick={() => onChange("")}
          >
            삭제
          </button>
        </div>
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
          지목선택
        </button>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="지목 선택"
        description="지적 기준 지목을 선택하세요"
        dense
        footer={
          <Button fullWidth variant="secondary" onClick={() => setOpen(false)}>
            닫기
          </Button>
        }
      >
        <div className="grid max-h-[55vh] grid-cols-3 gap-1.5 overflow-y-auto pb-1">
          {LAND_CATEGORIES.map((cat) => {
            const active = value === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  onChange(cat);
                  setOpen(false);
                }}
                className={[
                  "min-h-[44px] rounded-xl text-[13px] font-bold transition-all active:scale-95",
                  active
                    ? "bg-[#3182F6] text-white"
                    : "bg-gray-100 text-gray-700",
                ].join(" ")}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </Modal>
    </div>
  );
}
