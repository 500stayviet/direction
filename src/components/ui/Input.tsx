"use client";

import { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

interface FieldProps {
  label: string;
  hint?: string;
  required?: boolean;
  invalid?: boolean;
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
                invalid ? "text-red-600" : "text-gray-600",
              ].join(" ")}
            >
              {label}
              {required && (
                <span
                  className={
                    invalid ? "ml-0.5 text-red-500" : "ml-0.5 text-[#3182F6]"
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
            <span className="shrink-0 text-[12px] font-bold text-red-500">
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
            invalid ? "font-semibold text-red-500" : "text-gray-400",
          ].join(" ")}
        >
          {hint}
        </span>
      )}
    </label>
  );
}

const inputClass =
  "w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-3 text-[16px] text-gray-900 outline-none transition focus:border-[#3182F6] focus:bg-white focus:ring-2 focus:ring-[#3182F6]/20";

const invalidClass =
  "border-red-500 bg-red-50 focus:border-red-500 focus:ring-red-200";

export function Input({
  label,
  hint,
  required,
  invalid,
  labelRight,
  className = "",
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
        className={[inputClass, invalid ? invalidClass : "", className].join(
          " "
        )}
        {...props}
      />
    </Field>
  );
}

export function TextArea({
  label,
  hint,
  required,
  invalid,
  className = "",
  ...props
}: FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <Field label={label} hint={hint} required={required} invalid={invalid}>
      <textarea
        className={[
          inputClass,
          "min-h-[80px] resize-none",
          invalid ? invalidClass : "",
          className,
        ].join(" ")}
        {...props}
      />
    </Field>
  );
}

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
