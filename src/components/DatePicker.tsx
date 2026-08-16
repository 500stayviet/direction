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
import { filledBoxClass, requiredStarClass, emptyRequiredClass, invalidHintClass, invalidLabelClass } from "@/lib/uiInvalid";

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

  const openPicker = () => {
    setOpen(true);
  };

  const wrapInvalid = Boolean(invalid && label);

  return (
    <div className={wrapInvalid ? emptyRequiredClass({ invalid: true }) : "space-y-1"}>
      {label ? (
        <p
          className={[
            "text-[13px] font-semibold",
            invalid ? invalidLabelClass : "text-gray-600",
          ].join(" ")}
        >
          {label}
          {required && (
            <span className={requiredStarClass}>
              *
            </span>
          )}
        </p>
      ) : null}
      {wrapInvalid ? (
        <p className={`text-xs ${invalidHintClass}`}>미입력</p>
      ) : hint ? (
        <p className="text-xs text-gray-400">{hint}</p>
      ) : null}
      <button
        type="button"
        onClick={openPicker}
        className={[
          "flex min-h-[36px] w-full items-center justify-center rounded-xl px-4 text-[15px] font-bold",
          "active:scale-95 transition-all duration-150",
          value
            ? filledBoxClass
            : "border border-gray-200 bg-gray-100 text-gray-700",
        ].join(" ")}
      >
        <span className="text-center leading-snug">
          {value ? formatDisplayDate(value) : placeholder}
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
