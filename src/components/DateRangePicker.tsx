"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  placeholder?: string;
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
  placeholder = "날짜 선택",
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("from");
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);
  const now = new Date();
  const [viewYear, setViewYear] = useState(currentYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const toClickReadyAt = useRef(0);

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
    const end = nextTo || nextFrom;
    if (end < nextFrom) return;
    onChange({ from: nextFrom, to: end });
    setOpen(false);
  };

  const selectDay = (iso: string) => {
    if (step === "from") {
      if (draftFrom === iso) {
        setDraftFrom("");
        setDraftTo("");
        return;
      }
      setDraftFrom(iso);
      setDraftTo("");
      setStep("to");
      toClickReadyAt.current = Date.now() + 450;
      const base = parseISODate(iso);
      if (base) {
        setViewYear(base.getFullYear());
        setViewMonth(base.getMonth());
      }
      return;
    }
    if (Date.now() < toClickReadyAt.current) return;
    if (iso === draftFrom) {
      finish(draftFrom, draftFrom);
      return;
    }
    if (draftTo === iso) {
      setDraftTo("");
      return;
    }
    setDraftTo(iso);
  };

  const confirm = () => {
    finish(draftFrom, draftTo);
  };

  const canConfirm = !!draftFrom && (!draftTo || draftTo >= draftFrom);

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
      ) : null}

      <button
        type="button"
        onClick={openPicker}
        className={[
          "flex min-h-[36px] w-full items-center justify-center rounded-xl px-4 text-[15px] font-bold",
          "active:scale-95 transition-all duration-150",
          summary
            ? filledBoxClass
            : "border border-gray-200 bg-gray-100 text-gray-700",
        ].join(" ")}
      >
        <span className="text-center leading-snug">
          {summary || placeholder}
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
              : "시작일을 고른 뒤, 같은 날을 누르면 단일 · 다른 날을 누르면 기간입니다"
            : optionalTo
              ? `시작일 ${draftFrom ? formatDisplayDate(draftFrom) : ""} · 종료일은 선택 사항`
              : `시작일 ${draftFrom ? formatDisplayDate(draftFrom) : ""} · 같은 날이면 단일, 다른 날이면 까지`
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
              const isFrom = cell.iso === draftFrom;
              const isCurrent = selected === cell.iso;
              const inRange =
                !!draftFrom &&
                !!draftTo &&
                cell.iso > draftFrom &&
                cell.iso < draftTo;
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
                      : isCurrent
                        ? "bg-[#3182F6] text-white shadow-sm"
                        : isFrom
                          ? "bg-sky-400 text-sky-950 font-bold shadow-sm"
                          : inRange
                            ? "bg-sky-200 text-sky-800"
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
