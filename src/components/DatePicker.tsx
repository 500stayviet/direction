"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import {
  WEEKDAYS,
  addMonths,
  currentYear,
  formatDisplayDate,
  formatMonthTitle,
  getCalendarCells,
  parseISODate,
  todayISO,
} from "@/lib/date";

interface DatePickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  hint?: string;
  /** 기본: 오늘. 이 날짜 이전은 선택 불가 */
  minDate?: string;
  placeholder?: string;
  invalid?: boolean;
}

export function DatePicker({
  label,
  value,
  onChange,
  required,
  hint,
  minDate = todayISO(),
  placeholder = "년월일 선택",
  invalid,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const now = new Date();
  const [viewYear, setViewYear] = useState(currentYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (!open) return;
    // 선택된 날짜가 있으면 그 년월, 없으면 올해·이번 달 기준
    const base = parseISODate(value);
    setViewYear(base?.getFullYear() ?? currentYear());
    setViewMonth(base?.getMonth() ?? new Date().getMonth());
    setDraft(value);
  }, [open, value]);

  const cells = useMemo(
    () => getCalendarCells(viewYear, viewMonth),
    [viewYear, viewMonth]
  );

  const canGoPrev = useMemo(() => {
    const min = parseISODate(minDate);
    if (!min) return true;
    const prevMonthEnd = new Date(viewYear, viewMonth, 0);
    return prevMonthEnd >= min;
  }, [minDate, viewYear, viewMonth]);

  const confirm = () => {
    if (!draft) return;
    onChange(draft);
    setOpen(false);
  };

  return (
    <div className="space-y-1">
      {label ? (
        <p
          className={[
            "text-[13px] font-semibold",
            invalid ? "text-red-600" : "text-gray-600",
          ].join(" ")}
        >
          {label}
          {required && (
            <span className={invalid ? "ml-0.5 text-red-500" : "ml-0.5 text-[#3182F6]"}>
              *
            </span>
          )}
        </p>
      ) : null}
      {invalid ? (
        <p className="text-xs font-semibold text-red-500">미입력</p>
      ) : hint ? (
        <p className="text-xs text-gray-400">{hint}</p>
      ) : null}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={[
          "flex min-h-[38px] w-full items-center justify-between rounded-xl border px-3.5",
          "active:scale-[0.99] transition-all duration-150",
          invalid
            ? "border-red-500 bg-red-50 text-gray-900"
            : value
              ? "border-gray-200 bg-white text-gray-900"
              : "border-gray-200 bg-gray-50 text-gray-400",
        ].join(" ")}
      >
        <span className="text-[16px] font-semibold">
          {value ? formatDisplayDate(value) : placeholder}
        </span>
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-[#3182F6]">
          <CalendarIcon />
        </span>
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={label || "날짜 선택"}
        description={`${currentYear()}년 기준으로 오늘부터 선택해요`}
      >
        <div className="rounded-2xl bg-gray-50 p-3">
          <div className="mb-3 flex items-center justify-between px-1">
            <button
              type="button"
              disabled={!canGoPrev}
              onClick={() => {
                const next = addMonths(viewYear, viewMonth, -1);
                setViewYear(next.year);
                setViewMonth(next.monthIndex);
              }}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-gray-700 shadow-sm disabled:opacity-30 active:scale-95 transition-all duration-150"
              aria-label="이전 달"
            >
              ‹
            </button>
            <p className="text-[17px] font-bold text-gray-900">
              {formatMonthTitle(viewYear, viewMonth)}
            </p>
            <button
              type="button"
              onClick={() => {
                const next = addMonths(viewYear, viewMonth, 1);
                setViewYear(next.year);
                setViewMonth(next.monthIndex);
              }}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-gray-700 shadow-sm active:scale-95 transition-all duration-150"
              aria-label="다음 달"
            >
              ›
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7">
            {WEEKDAYS.map((d) => (
              <div
                key={d}
                className={[
                  "py-2 text-center text-[12px] font-semibold",
                  d === "일"
                    ? "text-red-400"
                    : d === "토"
                      ? "text-[#3182F6]"
                      : "text-gray-400",
                ].join(" ")}
              >
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-y-1">
            {cells.map((cell, idx) => {
              if (!cell.iso || cell.day == null) {
                return <div key={`empty-${idx}`} className="h-11" />;
              }
              const disabled = cell.iso < minDate;
              const selected = draft === cell.iso;
              const weekday = idx % 7;

              return (
                <button
                  key={cell.iso}
                  type="button"
                  disabled={disabled}
                  onClick={() => setDraft(cell.iso!)}
                  className={[
                    "mx-auto flex h-11 w-11 items-center justify-center rounded-full text-[15px] font-semibold",
                    "active:scale-95 transition-all duration-150",
                    disabled
                      ? "text-gray-300"
                      : selected
                        ? "bg-[#3182F6] text-white shadow-sm"
                        : cell.isToday
                          ? "bg-blue-50 text-[#3182F6]"
                          : weekday === 0
                            ? "text-red-500"
                            : weekday === 6
                              ? "text-[#3182F6]"
                              : "text-gray-800",
                  ].join(" ")}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => setOpen(false)}>
            취소
          </Button>
          <Button onClick={confirm} disabled={!draft || draft < minDate}>
            선택하기
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="3"
        y="5"
        width="18"
        height="16"
        rx="3"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M3 10h18"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M8 3v4M16 3v4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
