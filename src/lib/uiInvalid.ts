/** 필수 미입력 — 입력칸 테두리 */
export const invalidInputClass =
  "border-red-400 bg-red-50/70 focus:border-red-400 focus:ring-red-100";
export const invalidLabelClass = "text-red-500";
export const invalidHintClass = "font-semibold text-red-400";
/** 필수 표시 * — 회원가입·고객·매물 등록 공통, 항상 붉은색 */
export const requiredStarClass = "ml-0.5 text-red-500";
export const invalidStarClass = requiredStarClass;

/** 값이 있는 입력칸 테두리 */
export const filledInputClass =
  "border-green-400 bg-green-50/70 focus:border-green-400 focus:ring-green-100";

/** 값이 있는 버튼형 칸 (날짜·선택 결과) */
export const filledControlClass =
  "border border-green-400 bg-green-50 text-gray-900 font-bold";

export const idleControlClass =
  "border border-gray-200 bg-gray-100 text-gray-700 font-bold";

export const invalidControlClass =
  "border border-red-400 bg-red-50 text-gray-900 font-bold";

/** 값이 들어간 구역 — 입력칸이 아니라 그 공간 */
export const filledSectionClass =
  "rounded-xl border border-green-400 bg-green-50/70 p-2";

export const invalidWrapClass = "border border-red-200 bg-red-50/70 p-2";

export function spaceClass(opts: { invalid?: boolean; filled?: boolean }) {
  if (opts.invalid) return invalidWrapClass;
  if (opts.filled) return filledSectionClass;
  return "";
}

/** 거래종류처럼 라벨+입력 전체를 감싸는 미입력·채움 박스 */
export function emptyRequiredClass(opts: {
  invalid?: boolean;
  filled?: boolean;
} = {}) {
  return ["space-y-1 rounded-xl", spaceClass(opts)].join(" ");
}

export function controlStatusClass(opts: {
  invalid?: boolean;
  filled?: boolean;
}) {
  if (opts.invalid) return invalidControlClass;
  if (opts.filled) return filledControlClass;
  return idleControlClass;
}
