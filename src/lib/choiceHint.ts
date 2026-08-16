/** 고른 값을 다시 눌러 수정할 때 쓰는 안내 */
export function reselectHint(label: string, value: string) {
  const name = label.replace(/\s+/g, "");
  return `${name} 변경희망 시 "${value}"${objectParticle(value)} 다시 누르세요`;
}

export const addPreferredHint =
  '선호지역 추가희망 시 +"선호지역 (구) 추가"를 누르세요';

export const reselectHintClass =
  "min-w-0 flex-1 text-right text-[11px] font-medium leading-snug text-sky-400";

function objectParticle(value: string): "을" | "를" {
  const ch = [...value].filter((c) => /[가-힣]/.test(c)).pop();
  if (!ch) return "를";
  const code = ch.charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) return "를";
  return code % 28 === 0 ? "를" : "을";
}
