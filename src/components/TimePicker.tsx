"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type UIEvent,
} from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

type Period = "오전" | "오후";

interface TimePickerProps {
  label?: string;
  value: string; // HH:mm (24h)
  onChange: (value: string) => void;
  required?: boolean;
  hint?: string;
  placeholder?: string;
  /** 트리거 표시: ampm=오전 2:30, hhmm=14:30 */
  timeFormat?: "ampm" | "hhmm";
  /** 24시 기준 최소 시 (포함). 기본 8 (오전 8시) */
  minHour?: number;
  /** 24시 기준 최대 시 (포함). 기본 23 (오후 11시) */
  maxHour?: number;
}

const ITEM_H = 48;
const VISIBLE = 3;
const PAD_H = ((VISIBLE - 1) / 2) * ITEM_H;

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function to24(period: Period, hour12: number): number {
  if (period === "오전") {
    if (hour12 === 12) return 0;
    return hour12;
  }
  if (hour12 === 12) return 12;
  return hour12 + 12;
}

function from24(h24: number): { period: Period; hour12: number } {
  if (h24 === 0) return { period: "오전", hour12: 12 };
  if (h24 < 12) return { period: "오전", hour12: h24 };
  if (h24 === 12) return { period: "오후", hour12: 12 };
  return { period: "오후", hour12: h24 - 12 };
}

function parseTime(value: string): { h: number; m: number } {
  const [hs, ms] = (value || "").split(":");
  const h = Number(hs);
  const m = Number(ms);
  return {
    h: Number.isFinite(h) ? h : NaN,
    m: Number.isFinite(m) ? m : 0,
  };
}

const MINUTES = [0, 10, 20, 30, 40, 50];
const HOUR12_OPTIONS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

/** 예: 13:00 → 오후 1시 / 13:30 → 오후 1시 30분 */
export function formatDisplayTime(value: string): string {
  if (!value) return "";
  const { h, m } = parseTime(value);
  if (!Number.isFinite(h)) return "";
  const { period, hour12 } = from24(h);
  if (!m) return `${period} ${hour12}시`;
  return `${period} ${hour12}시 ${m}분`;
}

export function formatHHmm(value: string): string {
  if (!value) return "";
  const { h, m } = parseTime(value);
  if (!Number.isFinite(h)) return "";
  return `${pad(h)}:${pad(m)}`;
}

/** 선택 가능: 오전 8~11시, 오후 1~11시 (정오 12시 제외) */
function isAllowedHour24(h: number, minHour: number, maxHour: number) {
  if (!Number.isFinite(h)) return false;
  if (h < minHour || h > maxHour) return false;
  if (h === 12) return false;
  return true;
}

function clampHour24(h: number, minHour: number, maxHour: number) {
  if (!Number.isFinite(h) || h < minHour) return minHour;
  if (h === 12) return 13;
  if (h > maxHour) return maxHour;
  return h;
}

function WheelColumn<T extends string | number>({
  options,
  value,
  onChange,
  labelOf,
  active,
  variant = "number",
}: {
  options: readonly T[];
  value: T;
  onChange: (next: T) => void;
  labelOf: (item: T) => string;
  active: boolean;
  /** number: 시·분 / period: 오전·오후 */
  variant?: "number" | "period";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ignore = useRef(false);

  const scrollToValue = useCallback(
    (next: T, behavior: ScrollBehavior = "auto") => {
      const el = ref.current;
      if (!el) return;
      const idx = options.indexOf(next);
      if (idx < 0) return;
      ignore.current = true;
      el.scrollTo({ top: idx * ITEM_H, behavior });
      window.setTimeout(() => {
        ignore.current = false;
      }, behavior === "smooth" ? 280 : 40);
    },
    [options]
  );

  useEffect(() => {
    if (!active) return;
    scrollToValue(value, "auto");
  }, [active, value, options, scrollToValue]);

  const commit = () => {
    const el = ref.current;
    if (!el || ignore.current) return;
    const idx = Math.round(el.scrollTop / ITEM_H);
    const clamped = Math.min(options.length - 1, Math.max(0, idx));
    const next = options[clamped];
    el.scrollTo({ top: clamped * ITEM_H, behavior: "smooth" });
    if (next !== undefined && next !== value) onChange(next);
  };

  const onScroll = (_e: UIEvent<HTMLDivElement>) => {
    if (ignore.current) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(commit, 80);
  };

  return (
    <div
      className="relative flex-1 overflow-hidden"
      style={{ height: ITEM_H * VISIBLE }}
    >
      <div
        ref={ref}
        onScroll={onScroll}
        className="h-full overflow-y-auto overscroll-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ scrollSnapType: "y mandatory" }}
      >
        <div style={{ height: PAD_H }} aria-hidden />
        {options.map((item) => {
          const selected = item === value;
          const fontSize =
            variant === "period"
              ? selected
                ? 28
                : 22
              : selected
                ? 44
                : 32;
          return (
            <button
              key={String(item)}
              type="button"
              onClick={() => {
                onChange(item);
                scrollToValue(item, "smooth");
              }}
              className={[
                "flex w-full items-center justify-center tabular-nums snap-center leading-none tracking-tight",
                "transition-all duration-150",
                selected
                  ? "font-extrabold text-[#3182F6]"
                  : "font-bold text-gray-300",
              ].join(" ")}
              style={{ height: ITEM_H, fontSize }}
            >
              {labelOf(item)}
            </button>
          );
        })}
        <div style={{ height: PAD_H }} aria-hidden />
      </div>
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-white to-transparent"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-white to-transparent"
        aria-hidden
      />
    </div>
  );
}

export function TimePicker({
  label = "방문 시간",
  value,
  onChange,
  required,
  hint,
  placeholder,
  timeFormat = "ampm",
  minHour = 8,
  maxHour = 23,
}: TimePickerProps) {
  const [open, setOpen] = useState(false);

  const initial24 = clampHour24(parseTime(value).h, minHour, maxHour);
  const initial = from24(initial24);
  const [period, setPeriod] = useState<Period>(initial.period);
  const [hour12, setHour12] = useState(initial.hour12);
  const [minute, setMinute] = useState(() => {
    const m = parseTime(value).m;
    return MINUTES.includes(m) ? m : 0;
  });

  const availableHours = useMemo(() => {
    return HOUR12_OPTIONS.filter((h12) => {
      const h24 = to24(period, h12);
      return isAllowedHour24(h24, minHour, maxHour);
    });
  }, [period, minHour, maxHour]);

  const availablePeriods = useMemo(() => {
    const periods: Period[] = [];
    const hasAm = HOUR12_OPTIONS.some((h12) =>
      isAllowedHour24(to24("오전", h12), minHour, maxHour)
    );
    const hasPm = HOUR12_OPTIONS.some((h12) =>
      isAllowedHour24(to24("오후", h12), minHour, maxHour)
    );
    if (hasAm) periods.push("오전");
    if (hasPm) periods.push("오후");
    return periods;
  }, [minHour, maxHour]);

  useEffect(() => {
    if (!open) return;
    const t = parseTime(value);
    const h24 = clampHour24(t.h, minHour, maxHour);
    const next = from24(h24);
    setPeriod(next.period);
    setHour12(next.hour12);
    setMinute(
      MINUTES.includes(t.m) ? t.m : Math.min(50, Math.round(t.m / 10) * 10)
    );
  }, [open, value, minHour, maxHour]);

  useEffect(() => {
    if (!availableHours.includes(hour12) && availableHours.length > 0) {
      setHour12(availableHours[0]);
    }
  }, [availableHours, hour12]);

  const hour24 = to24(period, hour12);
  const display =
    timeFormat === "hhmm"
      ? formatHHmm(value)
      : value
        ? formatDisplayTime(value)
        : "";
  const emptyPlaceholder =
    placeholder ?? (timeFormat === "hhmm" ? "00:00" : "시간을 선택하세요");

  const confirm = () => {
    const h24 = to24(period, hour12);
    onChange(`${pad(h24)}:${pad(minute)}`);
    setOpen(false);
  };

  return (
    <div className="space-y-1">
      {timeFormat === "hhmm" ? (
        <div className="space-y-1">
          <p className="text-[13px] font-semibold text-gray-600">
            {label}
            {required && <span className="ml-0.5 text-[#3182F6]">*</span>}
          </p>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={[
              "inline-flex items-center gap-2 rounded-xl border px-2.5 py-1.5",
              "active:scale-[0.98] transition-all duration-150",
              value
                ? "border-gray-200 bg-white text-gray-900"
                : "border-gray-200 bg-gray-50 text-gray-400",
            ].join(" ")}
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-[#3182F6]">
              <ClockIcon />
            </span>
            <span className="text-[18px] font-extrabold tabular-nums tracking-wide">
              {display || emptyPlaceholder}
            </span>
          </button>
        </div>
      ) : (
        <>
          <p className="text-[13px] font-semibold text-gray-600">
            {label}
            {required && <span className="ml-0.5 text-[#3182F6]">*</span>}
          </p>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={[
              "flex min-h-[48px] w-full items-center gap-3 rounded-xl border px-3.5",
              "active:scale-[0.99] transition-all duration-150",
              value
                ? "border-gray-200 bg-white text-gray-900"
                : "border-gray-200 bg-gray-50 text-gray-400",
            ].join(" ")}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#3182F6]">
              <ClockIcon />
            </span>
            <span className="min-w-0 flex-1 text-left text-[16px] font-semibold">
              {display || emptyPlaceholder}
            </span>
          </button>
        </>
      )}
      {hint && <p className="text-xs text-gray-400">{hint}</p>}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        position="center"
        dense
        className="max-w-[280px] !p-2.5 !rounded-2xl"
      >
        <div className="relative rounded-xl bg-gray-50">
          <div
            className="pointer-events-none absolute inset-x-1 top-1/2 z-10 h-[48px] -translate-y-1/2 rounded-lg border-y-2 border-[#3182F6]/40 bg-[#3182F6]/10"
            aria-hidden
          />
          <div className="relative z-0 flex items-stretch gap-0 px-0.5">
            {availablePeriods.length > 1 && (
              <div className="min-w-[4.5rem] flex-[1.15]">
                <WheelColumn
                  options={availablePeriods}
                  value={period}
                  onChange={setPeriod}
                  labelOf={(p) => p}
                  active={open}
                  variant="period"
                />
              </div>
            )}
            <div className="min-w-[3rem] flex-1">
              <WheelColumn
                options={availableHours}
                value={
                  availableHours.includes(hour12)
                    ? hour12
                    : (availableHours[0] ?? 12)
                }
                onChange={setHour12}
                labelOf={(h) => `${h}`}
                active={open}
              />
            </div>
            <div
              className="flex w-3 shrink-0 items-center justify-center font-extrabold leading-none text-gray-400"
              style={{ fontSize: 32 }}
            >
              :
            </div>
            <div className="min-w-[3.25rem] flex-1">
              <WheelColumn
                options={MINUTES}
                value={minute}
                onChange={setMinute}
                labelOf={(m) => pad(m)}
                active={open}
              />
            </div>
          </div>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-1.5">
          <Button
            variant="secondary"
            className="!min-h-[44px] !py-2 !text-[14px]"
            onClick={() => setOpen(false)}
          >
            취소
          </Button>
          <Button
            className="!min-h-[44px] !py-2 !text-[14px]"
            onClick={confirm}
            disabled={!isAllowedHour24(hour24, minHour, maxHour)}
          >
            선택하기
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function ClockIcon({ small }: { small?: boolean }) {
  const size = small ? 14 : 18;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path
        d="M12 7v5l3 2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
