"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { reselectHint, reselectHintClass } from "@/lib/choiceHint";
import {
  invalidHintClass,
  invalidLabelClass,
  requiredStarClass,
  controlStatusClass,
} from "@/lib/uiInvalid";

interface ModalChoiceProps<T extends string> {
  label: string;
  required?: boolean;
  value?: T | "";
  options: readonly T[] | T[];
  onChange: (value: T) => void;
  columns?: 1 | 2 | 3 | 4;
  invalid?: boolean;
  position?: "bottom" | "center";
  keepOpen?: (value: T) => boolean;
  extra?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** true면 작은 라벨/* 숨김. 바깥 큰 제목을 쓸 때 */
  hideLabel?: boolean;
  /** 라벨 옆 예) 안내 */
  hint?: string;
}

export function ModalChoice<T extends string>({
  label,
  required,
  value,
  options,
  onChange,
  columns = 3,
  invalid,
  position = "center",
  keepOpen,
  extra,
  open: openProp,
  onOpenChange,
  hideLabel,
  hint,
}: ModalChoiceProps<T>) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const selected = value || "";
  const pickLabel = `${label.replace(/\s+/g, "")}선택`;
  const open = openProp ?? uncontrolledOpen;
  const setOpen = (next: boolean) => {
    onOpenChange?.(next);
    if (openProp === undefined) setUncontrolledOpen(next);
  };
  const [draft, setDraft] = useState(selected);

  useEffect(() => {
    if (open) setDraft(selected);
  }, [open, selected]);

  const openPicker = () => setOpen(true);
  const showExtra = Boolean(draft && keepOpen?.(draft as T));

  return (
    <div className="space-y-1">
      {hideLabel ? null : (
      <div className="flex items-baseline justify-between gap-2">
        <p
          className={[
            "shrink-0 text-[13px] font-semibold",
            invalid ? invalidLabelClass : "text-gray-600",
          ].join(" ")}
        >
          {label}
          {required ? (
            <span className={requiredStarClass}>
              *
            </span>
          ) : null}
        </p>
        {selected ? (
          <p className={reselectHintClass}>{reselectHint(label, selected)}</p>
        ) : hint ? (
          <p className="min-w-0 text-right text-[11px] font-medium leading-snug text-gray-400">
            {hint}
          </p>
        ) : null}
      </div>
      )}
      {hideLabel || !invalid ? null : (
        <p className={`text-xs ${invalidHintClass}`}>미입력</p>
      )}
      {selected ? (
        <button
          type="button"
          onClick={openPicker}
          className={[
            "flex min-h-[36px] w-full items-center justify-center rounded-xl px-4 text-[15px]",
            "active:scale-95 transition-all duration-150",
            controlStatusClass({ filled: true }),
          ].join(" ")}
        >
          {selected}
        </button>
      ) : (
        <button
          type="button"
          onClick={openPicker}
          className={[
            "flex min-h-[36px] w-full items-center justify-center rounded-xl px-4 text-[15px]",
            "active:scale-95 transition-all duration-150",
            controlStatusClass({ invalid: Boolean(invalid), filled: false }),
          ].join(" ")}
        >
          {pickLabel}
        </button>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`${label} 선택`}
        position={position}
        dense
        footer={
          showExtra ? (
            <Button fullWidth onClick={() => setOpen(false)}>
              선택완료
            </Button>
          ) : null
        }
      >
        <div
          className={
            columns === 1
              ? "grid grid-cols-1 gap-1.5"
              : columns === 2
                ? "grid grid-cols-2 gap-1.5"
                : columns === 4
                  ? "grid grid-cols-4 gap-1.5"
                  : "grid grid-cols-3 gap-1.5"
          }
        >
          {options.map((option) => {
            const active = draft === option;
            return (
              <button
                key={option}
                type="button"
                onClick={() => {
                  setDraft(option);
                  onChange(option);
                  if (!keepOpen?.(option)) setOpen(false);
                }}
                className={[
                  "min-h-[44px] rounded-xl px-2 text-[13px] font-bold",
                  "active:scale-95 transition-all duration-150",
                  columns === 1 ? "text-[15px]" : "",
                  active
                    ? "bg-[#3182F6] text-white shadow-sm"
                    : "bg-gray-100 text-gray-700",
                ].join(" ")}
              >
                {option}
              </button>
            );
          })}
        </div>
        {showExtra ? extra : null}
      </Modal>
    </div>
  );
}
