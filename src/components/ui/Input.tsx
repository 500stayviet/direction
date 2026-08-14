"use client";

import { InputHTMLAttributes, TextareaHTMLAttributes, forwardRef } from "react";
import {
  invalidHintClass,
  invalidInputClass,
  invalidLabelClass,
  invalidStarClass,
  filledInputClass,
} from "@/lib/uiInvalid";

interface FieldProps {
  label: string;
  hint?: string;
  required?: boolean;
  invalid?: boolean;
  /** 반영된 값 — 파란 칸, 흰 글자 */
  accent?: boolean;
}

export function Field({
  label,
  hint,
  required,
  invalid,
  labelRight,
  children,
}: FieldProps & {
  children: React.ReactNode;
  labelRight?: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      {label || labelRight ? (
        <span className="flex items-center justify-between gap-2">
          {label ? (
            <span
              className={[
                "text-[13px] font-semibold",
                invalid ? invalidLabelClass : "text-gray-600",
              ].join(" ")}
            >
              {label}
              {required && (
                <span
                  className={
                    invalid ? invalidStarClass : "ml-0.5 text-[#3182F6]"
                  }
                >
                  *
                </span>
              )}
            </span>
          ) : (
            <span />
          )}
          {labelRight ? (
            <span className="shrink-0 text-[12px] font-bold text-red-400">
              {labelRight}
            </span>
          ) : null}
        </span>
      ) : null}
      {children}
      {hint && (
        <span
          className={[
            "block text-xs",
            invalid ? invalidHintClass : "text-gray-400",
          ].join(" ")}
        >
          {hint}
        </span>
      )}
    </label>
  );
}

const inputClass =
  "w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-1.5 text-[16px] text-gray-900 outline-none transition focus:border-[#3182F6] focus:bg-white focus:ring-2 focus:ring-[#3182F6]/20";

const invalidClass = invalidInputClass;

export function Input({
  label,
  hint,
  required,
  invalid,
  labelRight,
  className = "",
  accent,
  ...props
}: FieldProps &
  InputHTMLAttributes<HTMLInputElement> & {
    labelRight?: React.ReactNode;
  }) {
  return (
    <Field
      label={label}
      hint={hint}
      required={required}
      invalid={invalid}
      labelRight={labelRight}
    >
      <input
        className={[
          inputClass,
          invalid ? invalidClass : accent ? filledInputClass : "",
          className,
        ].join(" ")}
        {...props}
      />
    </Field>
  );
}

export const TextArea = forwardRef<
  HTMLTextAreaElement,
  FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>
>(function TextArea(
  { label, hint, required, invalid, className = "", ...props },
  ref
) {
  return (
    <Field label={label} hint={hint} required={required} invalid={invalid}>
      <textarea
        ref={ref}
        className={[
          inputClass,
          "min-h-[56px] resize-none",
          invalid ? invalidClass : "",
          className,
        ].join(" ")}
        {...props}
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
        className={[inputClass, invalid ? invalidClass : "", className].join(
          " "
        )}
        {...props}
      >
        {children}
      </select>
    </Field>
  );
}
