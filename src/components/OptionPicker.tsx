"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { requiredStarClass, emptyRequiredClass, invalidHintClass, invalidLabelClass } from "@/lib/uiInvalid";

interface OptionPickerProps {
  label: string;
  value: string;
  options: readonly string[] | string[];
  onChange: (value: string) => void;
  required?: boolean;
  invalid?: boolean;
  disabled?: boolean;
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
  title,
  description,
  columns = 3,
}: OptionPickerProps) {
  const [open, setOpen] = useState(false);
  const pickLabel = `${label.replace(/\s+/g, "")}선택`;

  const openPicker = () => {
    if (disabled) return;
    setOpen(true);
  };

  return (
    <div
      className={
        invalid ? emptyRequiredClass({ invalid: true }) : "space-y-1"
      }
    >
      <p
        className={[
          "text-[13px] font-semibold",
          invalid ? invalidLabelClass : "text-gray-600",
        ].join(" ")}
      >
        {label}
        {required && (
          <span
            className={requiredStarClass}
          >
            *
          </span>
        )}
      </p>
      {invalid ? (
        <p className={`text-xs ${invalidHintClass}`}>미입력</p>
      ) : null}

      {value ? (
        <button
          type="button"
          disabled={disabled}
          onClick={openPicker}
          className={[
            "min-h-[36px] max-w-full rounded-xl px-4 text-[15px] font-bold",
            "bg-[#3182F6] text-white shadow-sm",
            "active:scale-95 transition-all duration-150",
            disabled ? "opacity-50" : "",
          ].join(" ")}
        >
          {value}
        </button>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={openPicker}
          className={[
            "min-h-[36px] rounded-xl px-4 text-[15px] font-bold",
            "transition-all duration-150",
            disabled
              ? "cursor-default bg-gray-100 text-gray-400"
              : "bg-gray-100 text-gray-700 active:scale-95",
          ].join(" ")}
        >
          {pickLabel}
        </button>
      )}

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
            columns === 2
              ? "grid grid-cols-2 gap-1.5"
              : "grid grid-cols-3 gap-1.5",
          ].join(" ")}
        >
          {options.map((option) => {
            const active = value === option;
            return (
              <button
                key={option}
                type="button"
                onClick={() => {
                  onChange(option);
                  setOpen(false);
                }}
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
        <Button
          variant="secondary"
          fullWidth
          className="mt-4"
          onClick={() => setOpen(false)}
        >
          취소
        </Button>
      </Modal>
    </div>
  );
}
