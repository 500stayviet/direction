"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import {
  BATHROOM_COUNT_OPTIONS,
  isRoomCountFixed,
  needsRoomBathCounts,
  roomCountOptionsForType,
} from "@/lib/constants";

type Props = {
  roomType?: string | null;
  roomCount?: number;
  bathroomCount?: number;
  onChange: (next: { roomCount: number; bathroomCount: number }) => void;
  invalidRoomCount?: boolean;
  filled?: boolean;
};

function CountPicker({
  label,
  required,
  invalid,
  valueLabel,
  placeholder = "선택",
  disabled,
  options,
  selected,
  onPick,
  filled,
}: {
  label: string;
  required?: boolean;
  invalid?: boolean;
  valueLabel: string;
  placeholder?: string;
  disabled?: boolean;
  options: readonly string[];
  selected: string;
  onPick: (value: string) => void;
  filled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const empty = !valueLabel;

  return (
    <div className="min-w-0 space-y-1">
      <p
        className={[
          "text-[13px] font-semibold",
          invalid ? "text-red-600" : "text-gray-600",
        ].join(" ")}
      >
        {label}
        {required ? (
          <span
            className={
              invalid ? "ml-0.5 text-red-500" : "ml-0.5 text-[#3182F6]"
            }
          >
            *
          </span>
        ) : null}
      </p>

      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) setOpen(true);
        }}
        className={[
          "flex min-h-[38px] w-full items-center justify-between rounded-xl border px-3.5",
          "transition-all duration-150",
          disabled
            ? filled && !empty
              ? "cursor-default"
              : "cursor-default border-gray-200 bg-gray-100"
            : "active:scale-[0.99]",
          invalid
            ? "border-red-500 bg-red-50"
            : filled && !empty
              ? "border-green-400 bg-white"
              : disabled
                ? ""
                : "border-gray-200 bg-gray-50",
        ].join(" ")}
      >
        <span
          className={[
            "truncate text-[16px] font-semibold",
            empty ? "text-gray-400" : "text-gray-900",
          ].join(" ")}
        >
          {empty ? placeholder : valueLabel}
        </span>
        {!disabled ? (
          <span
            className={[
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold",
              invalid ? "bg-red-100 text-red-600" : "bg-blue-50 text-[#3182F6]",
            ].join(" ")}
          >
            ▾
          </span>
        ) : (
          <span
            className={[
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold",
              filled
                ? "bg-green-100 text-green-700"
                : "bg-gray-200 text-gray-500",
            ].join(" ")}
          >
            —
          </span>
        )}
      </button>

      {invalid ? (
        <p className="text-xs font-semibold text-red-500">미입력</p>
      ) : null}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        position="center"
        dense
        title={`${label} 선택`}
        className="!max-w-[320px]"
      >
        <div
          className={[
            "grid gap-1.5",
            options.length <= 4 ? "grid-cols-4" : "grid-cols-5",
          ].join(" ")}
        >
          {options.map((opt) => {
            const active = selected === opt;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  onPick(opt);
                  setOpen(false);
                }}
                className={[
                  "min-h-[48px] rounded-xl text-[15px] font-bold",
                  "active:scale-95 transition-all duration-150",
                  active
                    ? "bg-[#3182F6] text-white shadow-sm"
                    : "bg-gray-100 text-gray-600",
                ].join(" ")}
              >
                {opt}개
              </button>
            );
          })}
        </div>
      </Modal>
    </div>
  );
}

export function RoomBathCountFields({
  roomType,
  roomCount,
  bathroomCount,
  onChange,
  invalidRoomCount,
  filled,
}: Props) {
  if (!needsRoomBathCounts(roomType)) return null;

  const fixedRooms = isRoomCountFixed(roomType);
  const roomOptions = roomCountOptionsForType(roomType);
  const minRooms = roomType === "3룸+" ? 3 : 1;
  const rooms = fixedRooms
    ? 2
    : roomCount && roomCount >= minRooms
      ? roomCount
      : 0;
  const baths = bathroomCount && bathroomCount > 0 ? bathroomCount : 1;

  return (
    <div className="grid grid-cols-2 gap-2">
      <CountPicker
        label="방 수"
        required
        disabled={fixedRooms}
        invalid={!fixedRooms && Boolean(invalidRoomCount)}
        valueLabel={rooms > 0 ? `${rooms}개` : ""}
        options={roomOptions}
        selected={rooms > 0 ? String(rooms) : ""}
        filled={filled}
        onPick={(v) =>
          onChange({
            roomCount: Number(v),
            bathroomCount: baths,
          })
        }
      />
      <CountPicker
        label="화장실 수"
        valueLabel={`${baths}개`}
        options={BATHROOM_COUNT_OPTIONS}
        selected={String(baths)}
        filled={filled}
        onPick={(v) =>
          onChange({
            roomCount: fixedRooms ? 2 : rooms > 0 ? rooms : minRooms,
            bathroomCount: Number(v),
          })
        }
      />
    </div>
  );
}
