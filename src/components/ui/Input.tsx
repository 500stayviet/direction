"use client";

import { InputHTMLAttributes, TextareaHTMLAttributes, forwardRef, useEffect, useRef, useState } from "react";
import {
  invalidHintClass,
  invalidInputClass,
  invalidLabelClass,
  requiredStarClass,
  emptyRequiredClass,
  filledInputClass,
  filledBoxClass,
  filledGreenBoxClass,
} from "@/lib/uiInvalid";
import { reselectHintClass } from "@/lib/choiceHint";

interface FieldProps {
  label: string;
  hint?: string;
  required?: boolean;
  invalid?: boolean;
  /**
   * invalid 표시 방식.
   * - wrap: 라벨+칸 전체 박스 + 아래「미입력」(기본, 고객·매물 폼)
   * - input: 입력칸 테두리만 + 라벨 우측 문구(invalidLabelRight)
   */
  invalidHighlight?: "wrap" | "input";
  /** invalidHighlight="input"일 때 라벨 바로 옆. 기본「필수 입력」 */
  invalidLabelRight?: React.ReactNode;
  /** 반영된 값 — 파란 칸, 흰 글자 */
  accent?: boolean;
  /** 라벨 옆 단위. 예: -만원- */
  unitHint?: string;
  /** 값 있으면 보증금처럼 파란 칸 · 흰 글자. 누르면 다시 수정 */
  chipWhenFilled?: boolean;
  /** 채워진 칸 색. 기본 파랑. 협력부동산은 green */
  chipTone?: "blue" | "green";
  /** 라벨 우측 안내. 매물유형 변경 안내와 같은 하늘색 */
  labelHint?: string;
  /** 입력칸 안쪽 끝 단위. 예: 만원 */
  suffix?: string;
  /** 채워진 칩에 보여줄 글. 없으면 value */
  chipValue?: string;
}

export function Field({
  label,
  hint,
  required,
  invalid,
  invalidHighlight = "wrap",
  invalidLabelRight,
  labelRight,
  unitHint,
  labelHint,
  children,
}: FieldProps & {
  children: React.ReactNode;
  labelRight?: React.ReactNode;
}) {
  const inputOnly = invalidHighlight === "input";
  const showWrap = Boolean(invalid && label && !inputOnly);
  const resolvedInvalidRight =
    invalidLabelRight === undefined ? "필수 입력" : invalidLabelRight;
  const besideLabelInvalid =
    invalid && inputOnly && resolvedInvalidRight != null && resolvedInvalidRight !== ""
      ? resolvedInvalidRight
      : null;
  /** input 모드 오류 문구는 라벨 바로 옆 — labelRight는 우측 끝 유지 */
  const farRight = besideLabelInvalid ? null : labelRight;

  return (
    <label
      className={[
        "block space-y-1",
        showWrap ? emptyRequiredClass({ invalid: true }) : "",
      ].join(" ")}
    >
      {label || besideLabelInvalid || farRight || unitHint || labelHint ? (
        <span className="flex items-baseline justify-between gap-2">
          {label || besideLabelInvalid ? (
            <span className="flex min-w-0 items-baseline gap-1.5">
              {label ? (
                <span
                  className={[
                    "shrink-0 text-[13px] font-semibold",
                    showWrap ? invalidLabelClass : "text-gray-600",
                  ].join(" ")}
                >
                  {label}
                  {required && (
                    <span className={requiredStarClass}>
                      *
                    </span>
                  )}
                </span>
              ) : null}
              {besideLabelInvalid ? (
                <span className="shrink-0 text-[12px] font-bold text-red-400">
                  {besideLabelInvalid}
                </span>
              ) : null}
            </span>
          ) : (
            <span />
          )}
          {unitHint || farRight || labelHint ? (
            <span className="flex min-w-0 flex-1 items-baseline justify-end gap-2">
              {unitHint ? (
                <span className="shrink-0 text-[11px] font-medium text-gray-500">
                  {unitHint}
                </span>
              ) : null}
              {farRight ? (
                <span className="shrink-0 text-[12px] font-bold text-red-400">
                  {farRight}
                </span>
              ) : labelHint ? (
                <span className={reselectHintClass}>{labelHint}</span>
              ) : null}
            </span>
          ) : null}
        </span>
      ) : null}
      {showWrap ? (
        <span className={`block text-xs ${invalidHintClass}`}>미입력</span>
      ) : null}
      {children}
      {hint && !invalid ? (
        <span className="block text-xs text-gray-400">{hint}</span>
      ) : null}
    </label>
  );
}

const controlSurfaceClass =
  "w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 text-[16px] text-gray-900 outline-none transition placeholder:text-[13px] placeholder:font-medium placeholder:text-gray-400 focus:border-[#3182F6] focus:bg-white focus:ring-2 focus:ring-[#3182F6]/20";

const inputClass = `${controlSurfaceClass} h-[36px] min-h-[36px] py-0 leading-[34px]`;

const filledChipClass =
  "flex min-h-[36px] w-full items-center justify-center rounded-xl px-3.5 text-[15px] font-bold";

export function Input({
  label,
  hint,
  required,
  invalid,
  invalidHighlight = "wrap",
  invalidLabelRight,
  labelRight,
  unitHint,
  chipWhenFilled,
  chipTone = "blue",
  labelHint,
  suffix,
  chipValue,
  className = "",
  accent,
  onFocus,
  onBlur,
  ...props
}: FieldProps &
  InputHTMLAttributes<HTMLInputElement> & {
    labelRight?: React.ReactNode;
  }) {
  const [focused, setFocused] = useState(false);
  const hasValue = String(props.value ?? "").trim().length > 0;
  const showChip = Boolean(chipWhenFilled && hasValue && !focused && !invalid);
  const fieldInvalidProps = {
    invalid,
    invalidHighlight,
    invalidLabelRight,
  };
  const controlInvalidClass =
    invalid && invalidHighlight === "input" ? invalidInputClass : "";

  const inputEl = (
    <input
      className={[
        inputClass,
        suffix
          ? "pr-11 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          : "",
        controlInvalidClass,
        accent && !invalid ? filledInputClass : "",
        className,
      ].join(" ")}
      {...props}
      autoFocus={focused}
      onFocus={(e) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        onBlur?.(e);
      }}
    />
  );

  const control = suffix ? (
    <span className="relative block">
      {inputEl}
      <span
        className={[
          "pointer-events-none absolute inset-y-0 right-3 flex items-center text-[13px] font-medium",
          accent && !invalid ? "text-white/80" : "text-gray-400",
        ].join(" ")}
      >
        {suffix}
      </span>
    </span>
  ) : (
    inputEl
  );

  if (showChip) {
    return (
      <Field
        label={label}
        hint={hint}
        required={required}
        labelRight={labelRight}
        unitHint={unitHint}
        labelHint={labelHint}
        {...fieldInvalidProps}
      >
        <button
          type="button"
          onClick={() => setFocused(true)}
          className={[
            filledChipClass,
            chipTone === "green" ? filledGreenBoxClass : filledBoxClass,
            "active:scale-95 transition-all duration-150",
          ].join(" ")}
        >
          {chipValue ??
            (suffix
              ? `${String(props.value).trim()}${suffix}`
              : String(props.value))}
        </button>
      </Field>
    );
  }

  return (
    <Field
      label={label}
      hint={hint}
      required={required}
      labelRight={labelRight}
      unitHint={unitHint}
      labelHint={labelHint}
      {...fieldInvalidProps}
    >
      {control}
    </Field>
  );
}

const NOTE_AREA_MIN_PX = 96;
const NOTE_AREA_MAX_PX = 280;

export const TextArea = forwardRef<
  HTMLTextAreaElement,
  FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>
>(function TextArea(
  { label, hint, required, invalid, className = "", value, onChange, ...props },
  ref
) {
  const innerRef = useRef<HTMLTextAreaElement | null>(null);

  const resize = () => {
    const el = innerRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(
      Math.max(el.scrollHeight, NOTE_AREA_MIN_PX),
      NOTE_AREA_MAX_PX
    )}px`;
  };

  useEffect(() => {
    resize();
  }, [value]);

  const setRefs = (node: HTMLTextAreaElement | null) => {
    innerRef.current = node;
    if (typeof ref === "function") ref(node);
    else if (ref) ref.current = node;
    if (node) resize();
  };

  return (
    <Field label={label} hint={hint} required={required} invalid={invalid}>
      <textarea
        {...props}
        ref={setRefs}
        value={value}
        onChange={onChange}
        className={[
          controlSurfaceClass,
          "min-h-[96px] resize-none overflow-y-auto py-1.5 leading-snug",
          invalid ? invalidInputClass : "",
          className,
        ].join(" ")}
      />
    </Field>
  );
});

export function Select({
  label,
  hint,
  required,
  invalid,
  className = "",
  children,
  ...props
}: FieldProps & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <Field label={label} hint={hint} required={required} invalid={invalid}>
      <select
        className={[inputClass, invalid ? invalidInputClass : "", className].join(
          " "
        )}
        {...props}
      >
        {children}
      </select>
    </Field>
  );
}
