"use client";

import { InputHTMLAttributes, TextareaHTMLAttributes, forwardRef, useEffect, useRef } from "react";
import {
  invalidInputClass,
  invalidLabelClass,
  requiredStarClass,
  filledInputClass,
  filledIdentityInputClass,
  inputFocusClass,
} from "@/lib/uiInvalid";
import { reselectHintClass } from "@/lib/choiceHint";

interface FieldProps {
  label: string;
  hint?: string;
  required?: boolean;
  invalid?: boolean;
  /**
   * invalid 표시 방식.
   * - wrap: 라벨만 붉게 (고객·매물 폼, 테두리는 입력칸)
   * - input: 입력칸 테두리 + 라벨 우측 문구(invalidLabelRight)
   */
  invalidHighlight?: "wrap" | "input";
  /** invalidHighlight="input"일 때 라벨 바로 옆. 기본「필수 입력」 */
  invalidLabelRight?: React.ReactNode;
  /** 라벨 옆 단위. 예: -만원- */
  unitHint?: string;
  /** 라벨 우측 안내. 매물유형 변경 안내와 같은 하늘색 */
  labelHint?: string;
  /** 입력칸 안쪽 끝 단위. 예: 만원 */
  suffix?: string;
  /** suffix를 숫자에 붙여 표시 (예: 10만원). 기본 false면 값 있을 때 앞에 공백 */
  suffixCompact?: boolean;
  /** 라벨 바로 옆 작은 표시. 예: (약) */
  labelNote?: string;
  /** identity: 이름·전화 — 채워지면 짙은 초록, 가운데 */
  filledVariant?: "field" | "identity";
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
  labelNote,
  children,
}: FieldProps & {
  children: React.ReactNode;
  labelRight?: React.ReactNode;
}) {
  const inputOnly = invalidHighlight === "input";
  const resolvedInvalidRight =
    invalidLabelRight === undefined ? "필수 입력" : invalidLabelRight;
  const besideLabelInvalid =
    invalid && inputOnly && resolvedInvalidRight != null && resolvedInvalidRight !== ""
      ? resolvedInvalidRight
      : null;
  /** input 모드 오류 문구는 라벨 바로 옆 — labelRight는 우측 끝 유지 */
  const farRight = besideLabelInvalid ? null : labelRight;

  return (
    <label className="block space-y-1">
      {label || besideLabelInvalid || farRight || unitHint || labelHint || labelNote ? (
        <span className="flex items-baseline justify-between gap-2">
          {label || besideLabelInvalid ? (
            <span className="flex min-w-0 items-baseline gap-1.5">
              {label ? (
                <span
                  className={[
                    "shrink-0 text-[13px] font-semibold",
                    invalid ? invalidLabelClass : "text-gray-600",
                  ].join(" ")}
                >
                  {label}
                  {labelNote ? (
                    <span className="ml-1 text-[12px] font-medium text-gray-400">
                      {labelNote}
                    </span>
                  ) : null}
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

export function Input({
  label,
  hint,
  required,
  invalid,
  invalidHighlight = "wrap",
  invalidLabelRight,
  labelRight,
  unitHint,
  labelHint,
  prefix,
  suffix,
  suffixCompact = false,
  labelNote,
  filledVariant = "field",
  className = "",
  ...props
}: FieldProps &
  InputHTMLAttributes<HTMLInputElement> & {
    labelRight?: React.ReactNode;
    /** 입력칸 안쪽 앞 표시. 예: 지하 층수 - */
    prefix?: string;
  }) {
  const hasValue = String(props.value ?? "").trim().length > 0;
  const filledClass =
    filledVariant === "identity"
      ? filledIdentityInputClass
      : filledInputClass;
  const statusClass = invalid
    ? invalidInputClass
    : hasValue
      ? filledClass
      : "";
  const identityAlign =
    filledVariant === "identity" && hasValue ? "text-center" : "";
  const filledAlign =
    filledVariant !== "identity" && hasValue && !invalid ? "text-center" : "";
  const hideSpin = Boolean(prefix || suffix);
  const fieldFilledClass =
    filledVariant !== "identity" && hasValue && !invalid
      ? "input-field-filled"
      : "";

  const inputEl = (
    <input
      className={[
        inputClass,
        prefix ? "pl-7" : "",
        suffix ? "pr-11" : "",
        hideSpin
          ? "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          : "",
        identityAlign,
        filledAlign,
        statusClass,
        filledVariant === "identity" && hasValue && !invalid
          ? "input-identity-filled"
          : "",
        fieldFilledClass,
        invalid ? "" : inputFocusClass,
        className,
      ].join(" ")}
      {...props}
    />
  );

  const control =
    prefix || suffix ? (
      <span className="group relative block">
        {prefix ? (
          <span
            className={[
              "pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-[16px] font-bold tabular-nums",
              hasValue && !invalid
                ? "text-white group-focus-within:text-gray-700"
                : "text-gray-700",
            ].join(" ")}
          >
            {prefix}
          </span>
        ) : null}
        {inputEl}
        {suffix ? (
          <span
            className={[
              "pointer-events-none absolute inset-y-0 right-3 flex items-center font-medium",
              hasValue && !invalid
                ? "text-[16px] font-bold text-white group-focus-within:text-gray-900"
                : hasValue
                  ? "text-[16px] font-bold text-gray-900"
                  : "text-[13px] text-gray-400",
            ].join(" ")}
          >
            {hasValue
              ? suffixCompact
                ? suffix
                : ` ${suffix}`
              : suffix}
          </span>
        ) : null}
      </span>
    ) : (
      inputEl
    );

  return (
    <Field
      label={label}
      hint={hint}
      required={required}
      invalid={invalid}
      invalidHighlight={invalidHighlight}
      invalidLabelRight={invalidLabelRight}
      labelRight={labelRight}
      unitHint={unitHint}
      labelHint={labelHint}
      labelNote={labelNote}
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
  const hasValue = String(value ?? "").trim().length > 0;

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
          invalid ? invalidInputClass : hasValue ? filledInputClass : "",
          hasValue && !invalid ? "input-field-filled text-left" : "",
          invalid ? "" : inputFocusClass,
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
  value,
  ...props
}: FieldProps & React.SelectHTMLAttributes<HTMLSelectElement>) {
  const hasValue = String(value ?? "").trim().length > 0;
  return (
    <Field label={label} hint={hint} required={required} invalid={invalid}>
      <select
        value={value}
        className={[
          inputClass,
          invalid ? invalidInputClass : hasValue ? filledInputClass : "",
          hasValue && !invalid ? "input-field-filled" : "",
          invalid ? "" : inputFocusClass,
          className,
        ].join(" ")}
        {...props}
      >
        {children}
      </select>
    </Field>
  );
}
