/** 1평 = 400/121㎡ (법정) */
export const M2_PER_PYEONG = 400 / 121;

export function pyeongToM2(pyeong: number): number {
  return pyeong * M2_PER_PYEONG;
}

export function m2ToPyeong(m2: number): number {
  return m2 / M2_PER_PYEONG;
}

/** 정수면 45, 소수면 45.12 */
export function formatAreaDisplay(value: number | undefined | null): string {
  if (value == null || !Number.isFinite(value)) return "";
  const rounded = Math.round(value * 100) / 100;
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(2);
}

export function formatAreaWithUnit(
  value: number | undefined | null,
  unit: "평" | "㎡"
): string {
  const text = formatAreaDisplay(value);
  return text ? `${text}${unit}` : "";
}

export function parseAreaInput(raw: string): number | undefined {
  const text = raw
    .trim()
    .replace(/,/g, "")
    .replace(/평/g, "")
    .replace(/㎡/g, "")
    .replace(/m2/gi, "")
    .trim();
  if (!text || text === ".") return undefined;
  const n = Number(text);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return n;
}

export function formatLandAreaLine(pyeong: number | undefined | null): string {
  if (pyeong == null || !Number.isFinite(pyeong)) return "";
  return `${formatAreaWithUnit(pyeong, "평")} · ${formatAreaWithUnit(pyeongToM2(pyeong), "㎡")}`;
}
