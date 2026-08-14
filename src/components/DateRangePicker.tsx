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
import { filledBoxClass } from "@/lib/uiInvalid";

interface DateRangePickerProps {
  label?: string;
  from: string;
  to: string;
  onChange: (next: { from: string; to: string }) => void;
  required?: boolean;
  minDate?: string;
  /** true면 종료일 없이도 완료 가능 */
  optionalTo?: boolean;
  invalid?: boolean;
  /** 반영된 값 — 파란 칸 */
  accent?: boolean;
}

type Step = "from" | "to";

export function DateRangePicker({
  label,
  from,
  to,
  onChange,
  required,
  minDate = todayISO(),
  optionalTo = false,
  invalid,
  accent,
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("from");
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);
  const now = new Date();
  const [viewYear, setViewYear] = useState(currentYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());

  useEffect(() => {
    if (!open) return;
    setDraftFrom(from);
    setDraftTo(to);
    setStep("from");
    const base = parseISODate(from) ?? new Date();
    setViewYear(base.getFullYear());
    setViewMonth(base.getMonth());
  }, [open, from, to]);

  const activeMin = step === "to" ? draftFrom || minDate : minDate;

  const cells = useMemo(
    () => getCalendarCells(viewYear, viewMonth),
    [viewYear, viewMonth]
  );

  const canGoPrev = useMemo(() => {
    const min = parseISODate(activeMin);
    if (!min) return true;
    const prevMonthEnd = new Date(viewYear, viewMonth, 0);
    return prevMonthEnd >= min;
  }, [activeMin, viewYear, viewMonth]);

  const finish = (nextFrom: string, nextTo: string) => {
    if (!nextFrom) return;
    if (nextTo && nextTo < nextFrom) return;
    if (!optionalTo && !nextTo) return;
    onChange({ from: nextFrom, to: nextTo });
    setOpen(false);
  };

  const selectDay = (iso: string) => {
    if (step === "from") {
      const nextTo = draftTo && draftTo >= iso ? draftTo : "";
      setDraftFrom(iso);
      setDraftTo(nextTo);
      setStep("to");
      const base = parseISODate(iso);
      if (base) {
        setViewYear(base.getFullYear());
        setViewMonth(base.getMonth());
      }
      return;
    }
    setDraftTo(iso);
    finish(draftFrom, iso);
  };

  const confirm = () => {
    finish(draftFrom, draftTo);
  };

  const canConfirm = optionalTo
    ? !!draftFrom && (!draftTo || draftTo >= draftFrom)
    : !!draftFrom && !!draftTo && draftTo >= draftFrom;

  const selected = step === "from" ? draftFrom : draftTo;

  const summary = (() => {
    if (!from && !to) return "";
    if (from && to) {
      if (from === to) return formatDisplayDate(from);
      return `${formatDisplayDate(from)} ~ ${formatDisplayDate(to)}`;
    }
    if (from) return optionalTo ? `${formatDisplayDate(from)} ~` : formatDisplayDate(from);
    return "";
  })();

  return (
    <div className="space-y-1">
      {label ? (
        <p
          className={[
            "text-[13px] font-semibold",
            invalid ? "text-red-500" : "text-gray-600",
          ].join(" ")}
        >
          {label}
          {required && (
            <span className={invalid ? "ml-0.5 text-red-400" : "ml-0.5 text-[#3182F6]"}>
              *
            </span>
          )}
        </p>
      ) : null}
      {invalid ? (
        <p className="text-xs font-semibold text-red-400">미입력</p>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen(true)}
        className={[
          "flex min-h-[38px] w-full items-center justify-between rounded-xl border px-3.5",
          "active:scale-[0.99] transition-all duration-150",
          invalid
            ? "border-red-300 bg-red-50/70 text-gray-900"
            : accent && summary
              ? filledBoxClass
              : summary
                ? "border-gray-200 bg-white text-gray-900"
                : "border-gray-200 bg-gray-50 text-gray-400",
        ].join(" ")}
      >
        <span className="truncate text-left text-[16px] font-semibold">
          {summary || "날짜 선택"}
        </span>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#3182F6]">
          <CalendarIcon />
        </span>
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={step === "from" ? "부터 선택" : "까지 선택"}
        description={
          step === "from"
            ? optionalTo
              ? "시작일을 고른 뒤, 종료일은 필요할 때만 선택하세요"
              : "시작일을 고르면 바로 종료일을 선택해요"
            : optionalTo
              ? `시작일 ${draftFrom ? formatDisplayDate(draftFrom) : ""} · 종료일은 선택 사항`
              : `시작일 ${draftFrom ? formatDisplayDate(draftFrom) : ""} 이후`
        }
      >
        <div className="mb-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setStep("from")}
            className={[
              "rounded-2xl px-3 py-3 text-left active:scale-95 transition-all duration-150",
              step === "from" ? "bg-[#3182F6] text-white" : "bg-gray-100 text-gray-700",
            ].join(" ")}
          >
            <p className="text-[11px] opacity-80">부터</p>
            <p className="mt-0.5 text-sm font-bold truncate">
              {draftFrom ? formatDisplayDate(draftFrom) : "선택"}
            </p>
          </button>
          <button
            type="button"
            onClick={() => {
              if (!draftFrom) return;
              setStep("to");
            }}
            className={[
              "rounded-2xl px-3 py-3 text-left active:scale-95 transition-all duration-150",
              step === "to" ? "bg-[#3182F6] text-white" : "bg-gray-100 text-gray-700",
              !draftFrom ? "opacity-40" : "",
            ].join(" ")}
          >
            <p className="text-[11px] opacity-80">
              까지{optionalTo ? " (선택)" : ""}
            </p>
            <p className="mt-0.5 text-sm font-bold truncate">
              {draftTo ? formatDisplayDate(draftTo) : optionalTo ? "생략 가능" : "선택"}
            </p>
          </button>
        </div>

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
              const disabled = cell.iso < activeMin;
              const isSelected = selected === cell.iso;
              const inRange =
                !!draftFrom &&
                !!draftTo &&
                cell.iso >= draftFrom &&
                cell.iso <= draftTo;
              const weekday = idx % 7;

              return (
                <button
                  key={cell.iso}
                  type="button"
                  disabled={disabled}
                  onClick={() => selectDay(cell.iso!)}
                  className={[
                    "mx-auto flex h-11 w-11 items-center justify-center rounded-full text-[15px] font-semibold",
                    "active:scale-95 transition-all duration-150",
                    disabled
                      ? "text-gray-300"
                      : isSelected
                        ? "bg-[#3182F6] text-white shadow-sm"
                        : inRange
                          ? "bg-blue-50 text-[#3182F6]"
                          : cell.isToday
                            ? "ring-1 ring-[#3182F6] text-[#3182F6]"
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

        <div className="mt-4 space-y-2">
          {optionalTo && step === "to" && draftFrom && (
            <Button
              variant="outline"
              fullWidth
              onClick={() => finish(draftFrom, "")}
            >
              시작일만으로 완료
            </Button>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                if (step === "to") setStep("from");
                else setOpen(false);
              }}
            >
              {step === "to" ? "이전" : "취소"}
            </Button>
            <Button onClick={confirm} disabled={!canConfirm}>
              선택 완료
            </Button>
          </div>
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
