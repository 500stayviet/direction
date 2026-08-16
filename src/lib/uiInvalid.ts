/** 필수 미입력 — 기존 red-500보다 옅은 톤 */
export const invalidWrapClass = "border border-red-200 bg-red-50/70 p-2";
export const invalidInputClass =
  "border-red-300 bg-red-50/70 focus:border-red-300 focus:ring-red-100";
export const invalidLabelClass = "text-red-500";
export const invalidHintClass = "font-semibold text-red-400";
/** 필수 표시 * — 회원가입·고객·매물 등록 공통, 항상 붉은색 */
export const requiredStarClass = "ml-0.5 text-red-500";
export const invalidStarClass = requiredStarClass;

/** 값이 들어간 구역 — 입력칸이 아니라 그 공간 */
export const filledSectionClass =
  "rounded-xl border border-green-400 bg-green-50 p-2";

/** 선택 메모 — 필수 아님, 내용이 있을 때만 */
export const memoFilledSectionClass =
  "rounded-xl border border-amber-300 bg-amber-50 p-2";

export function spaceClass(opts: { invalid?: boolean; filled?: boolean }) {
  if (opts.filled) return filledSectionClass;
  if (opts.invalid) return invalidWrapClass;
  return "";
}

/** 거래종류처럼 라벨+입력 전체를 감싸는 미입력 박스 */
export function emptyRequiredClass(opts: {
  invalid?: boolean;
  filled?: boolean;
} = {}) {
  return ["space-y-1 rounded-xl", spaceClass(opts)].join(" ");
}
export const filledBoxClass =
  "!border-[#3182F6] !bg-[#3182F6] !text-white font-bold shadow-sm";
export const filledGreenBoxClass =
  "!border-emerald-500 !bg-emerald-500 !text-white font-bold shadow-sm";
export const filledBoxTextClass = "!text-white";
export const filledInputClass =
  "!border-[#3182F6] !bg-[#3182F6] !text-white font-bold caret-white placeholder:!text-white/70 focus:!border-[#3182F6] focus:!bg-[#3182F6] focus:!text-white focus:!ring-[#3182F6]/30 [-webkit-text-fill-color:white]";
