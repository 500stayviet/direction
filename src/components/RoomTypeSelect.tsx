"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { displayRoomType, ROOM_TYPES } from "@/lib/constants";
import type { RoomType } from "@/lib/types";

interface RoomTypeSelectProps {
  label?: string;
  value: RoomType | string;
  onChange: (value: RoomType) => void;
  required?: boolean;
  hint?: string;
  invalid?: boolean;
}

function asRoomType(value: string): RoomType {
  if (value === "오피스") return "사무실";
  return (ROOM_TYPES.includes(value as RoomType) ? value : "원룸") as RoomType;
}

export function RoomTypeSelect({
  label = "유형",
  value,
  onChange,
  required,
  hint,
  invalid,
}: RoomTypeSelectProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<RoomType>(asRoomType(value));
  const shown = displayRoomType(value);

  const openPicker = () => {
    setDraft(asRoomType(value));
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
        onClick={openPicker}
        className={[
          "flex min-h-[48px] w-full items-center justify-between rounded-xl border px-3.5",
          "active:scale-[0.99] transition-all duration-150",
          invalid
            ? "border-red-500 bg-red-50"
            : "border-gray-200 bg-gray-50 focus:border-[#3182F6] focus:bg-white focus:ring-2 focus:ring-[#3182F6]/20",
        ].join(" ")}
      >
        <span className="text-[16px] font-semibold text-gray-900">
          {shown === "-" ? "원룸" : shown}
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
      {(invalid || hint) && (
        <p
          className={[
            "text-xs",
            invalid ? "font-semibold text-red-500" : "text-gray-400",
          ].join(" ")}
        >
          {invalid ? "미입력" : hint}
        </p>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        position="center"
        title="유형 선택"
        description="원룸 · 투룸 · 쓰리룸 · 상가 · 사무실"
      >
        <div className="grid grid-cols-3 gap-1.5">
          {ROOM_TYPES.map((type) => {
            const active = draft === type;
            return (
              <button
                key={type}
                type="button"
                onClick={() => setDraft(type)}
                className={[
                  "min-h-[48px] rounded-xl text-[15px] font-bold",
                  "active:scale-95 transition-all duration-150",
                  active
                    ? "bg-[#3182F6] text-white shadow-sm"
                    : "bg-gray-100 text-gray-600",
                ].join(" ")}
              >
                {type}
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
              onChange(draft);
              setOpen(false);
            }}
          >
            선택하기
          </Button>
        </div>
      </Modal>
    </div>
  );
}
