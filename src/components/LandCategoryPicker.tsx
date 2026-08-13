"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { LAND_CATEGORIES } from "@/lib/landCategories";

export function LandCategoryPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-1">
      <p className="text-[13px] font-semibold text-gray-600">지목</p>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={[
          "flex min-h-[48px] w-full items-center justify-between rounded-xl border px-3.5",
          "border-gray-200 bg-gray-50 active:scale-[0.99] transition-all duration-150",
          value ? "border-[#3182F6]/55" : "",
        ].join(" ")}
      >
        <span
          className={[
            "text-[15px] font-semibold",
            value ? "text-gray-900" : "text-gray-400",
          ].join(" ")}
        >
          {value || "지목 선택"}
        </span>
        <span className="text-[12px] font-bold text-[#3182F6]">선택</span>
      </button>
      {value ? (
        <button
          type="button"
          className="text-[12px] font-semibold text-gray-400"
          onClick={() => onChange("")}
        >
          지목 지우기
        </button>
      ) : null}

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
