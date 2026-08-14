/** 필수 미입력 — 기존 red-500보다 옅은 톤 */
export const invalidWrapClass = "border border-red-200 bg-red-50/70 p-2";
export const invalidInputClass =
  "border-red-300 bg-red-50/70 focus:border-red-300 focus:ring-red-100";
export const invalidLabelClass = "text-red-500";
export const invalidHintClass = "font-semibold text-red-400";
export const invalidStarClass = "ml-0.5 text-red-400";

/** 값이 들어간 구역 — 입력칸이 아니라 그 공간 */
export const filledSectionClass =
  "rounded-xl border border-green-400 bg-green-50 p-2";

export function spaceClass(opts: { invalid?: boolean; filled?: boolean }) {
  if (opts.filled) return filledSectionClass;
  if (opts.invalid) return invalidWrapClass;
  return "";
}
export const filledBoxClass =
  "!border-[#3182F6] !bg-[#3182F6] !text-white font-bold shadow-sm";
export const filledBoxTextClass = "!text-white";
export const filledInputClass =
  "!border-[#3182F6] !bg-[#3182F6] !text-white font-bold caret-white placeholder:!text-white/70 focus:!border-[#3182F6] focus:!bg-[#3182F6] focus:!text-white focus:!ring-[#3182F6]/30 [-webkit-text-fill-color:white]";
