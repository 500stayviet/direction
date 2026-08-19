/** 필수 미입력 — 입력칸 테두리 */
export const invalidInputClass =
  "border-red-400 bg-red-50/70 focus:border-red-400 focus:ring-red-100";
export const invalidLabelClass = "text-red-500";
export const invalidHintClass = "font-semibold text-red-400";
/** 필수 표시 * — 회원가입·고객·매물 등록 공통, 항상 붉은색 */
export const requiredStarClass = "ml-0.5 text-red-500";

/** 탭·포커스 — 검은 테두리 대신 파란 테두리 */
export const inputFocusClass =
  "outline-none focus:outline-none focus-visible:outline-none focus:!border-[#3182F6] focus:!bg-white focus:!text-gray-900 focus:!caret-gray-900 focus:!ring-2 focus:!ring-[#3182F6]/20";

/** 값이 있는 일반 입력칸 — 파란 칸 */
export const filledInputClass =
  "border-[#3182F6] bg-[#E8F3FF] text-gray-900";

/** 이름·전화 — 입력되면 파란 칸과 같이 짙은 초록, 가운데 */
export const filledIdentityInputClass =
  "border-[#03B26C] bg-[#03B26C] text-center font-bold !text-white caret-white";

/** 값이 있는 버튼형 칸 (날짜·선택 결과) — 선택된 것처럼 */
export const filledControlClass =
  "border border-[#3182F6] bg-[#3182F6] text-white font-bold";

export const idleControlClass =
  "border border-gray-200 bg-gray-100 text-gray-700 font-bold";

export const invalidControlClass =
  "border border-red-400 bg-red-50 text-gray-900 font-bold";

export function controlStatusClass(opts: {
  invalid?: boolean;
  filled?: boolean;
}) {
  if (opts.invalid) return invalidControlClass;
  if (opts.filled) return filledControlClass;
  return idleControlClass;
}
