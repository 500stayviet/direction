"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

interface OptionPickerProps {
  label: string;
  value: string;
  options: readonly string[] | string[];
  onChange: (value: string) => void;
  required?: boolean;
  invalid?: boolean;
  disabled?: boolean;
  placeholder?: string;
  title?: string;
  description?: string;
  columns?: 2 | 3;
}

export function OptionPicker({
  label,
  value,
  options,
  onChange,
  required,
  invalid,
  disabled,
  placeholder = "선택",
  title,
  description,
  columns = 3,
}: OptionPickerProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);

  const openPicker = () => {
    if (disabled) return;
    setDraft(value);
    setOpen(true);
  };

  return (
    <div className="space-y-1">
      <p
        className={[
          "text-[13px] font-semibold",
          invalid ? "text-red-600" : "text-gray-600",
        ].join(" ")}
      >
        {label}
        {required && (
          <span
            className={invalid ? "ml-0.5 text-red-500" : "ml-0.5 text-[#3182F6]"}
          >
            *
          </span>
        )}
      </p>

      <button
        type="button"
        disabled={disabled}
        onClick={openPicker}
        className={[
          "flex min-h-[48px] w-full items-center justify-between rounded-xl border px-3.5",
          "active:scale-[0.99] transition-all duration-150",
          disabled ? "opacity-50" : "",
          invalid
            ? "border-red-500 bg-red-50"
            : "border-gray-200 bg-gray-50 focus:border-[#3182F6] focus:bg-white focus:ring-2 focus:ring-[#3182F6]/20",
        ].join(" ")}
      >
        <span
          className={[
            "text-[16px] font-semibold",
            value ? "text-gray-900" : "text-gray-400",
          ].join(" ")}
        >
          {value || placeholder}
        </span>
        <span
          className={[
            "flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold",
            invalid ? "bg-red-100 text-red-600" : "bg-blue-50 text-[#3182F6]",
          ].join(" ")}
        >
          ▾
        </span>
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        position="center"
        title={title ?? `${label} 선택`}
        description={description}
      >
        <div
          className={[
            "mt-1 max-h-[50vh] overflow-y-auto overscroll-contain",
            columns === 2 ? "grid grid-cols-2 gap-1.5" : "grid grid-cols-3 gap-1.5",
          ].join(" ")}
        >
          {options.map((option) => {
            const active = draft === option;
            return (
              <button
                key={option}
                type="button"
                onClick={() => setDraft(option)}
                className={[
                  "min-h-[48px] rounded-xl px-1 text-[15px] font-bold",
                  "active:scale-95 transition-all duration-150",
                  active
                    ? "bg-[#3182F6] text-white shadow-sm"
                    : "bg-gray-100 text-gray-600",
                ].join(" ")}
              >
                {option}
              </button>
            );
          })}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => setOpen(false)}>
            취소
          </Button>
          <Button
            onClick={() => {
              if (!draft) return;
              onChange(draft);
              setOpen(false);
            }}
            disabled={!draft}
          >
            선택하기
          </Button>
        </div>
      </Modal>
    </div>
  );
}
