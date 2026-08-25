/** 1평 = 400/121㎡ (법정) */
export const M2_PER_PYEONG = 400 / 121;

export function pyeongToM2(pyeong: number): number {
  return pyeong * M2_PER_PYEONG;
}

export function m2ToPyeong(m2: number): number {
  return m2 / M2_PER_PYEONG;
}

/** 화면은 소수점 둘째 자리. 45.10 */
export function formatAreaDisplay(value: number | undefined | null): string {
  if (value == null || !Number.isFinite(value)) return "";
  return (Math.round(value * 100) / 100).toFixed(2);
}

/** 칩·입력용 — 10.00 → 10, 45.10 유지 */
export function formatAreaChip(value: number | undefined | null): string {
  const text = formatAreaDisplay(value);
  if (!text) return "";
  return text.replace(/(\.\d*[1-9])0+$/, "$1").replace(/\.0+$/, "");
}

export function formatAreaWithUnit(
  value: number | undefined | null,
  unit: "평" | "㎡"
): string {
  const text = formatAreaDisplay(value);
  return text ? `${text} ${unit}` : "";
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

const INTAKE_AREA_YAK = "(?:약\\s*)?";
const INTAKE_M2_UNIT = "(?:㎡|m2|m²)";

/** 메시지·대화 intake — 「25평」「약 25평형」「82㎡」「약148m2」 등을 평으로 */
export function parseIntakeAreaFromText(text: string): number | undefined {
  type Hit = { index: number; pyeong: number };
  const hits: Hit[] = [];

  const pushPyeong = (index: number | undefined, raw: string) => {
    if (index == null) return;
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) hits.push({ index, pyeong: n });
  };

  const pyDirect = new RegExp(
    `${INTAKE_AREA_YAK}(\\d+(?:\\.\\d+)?)\\s*평(?:형)?`,
    "gi"
  );
  for (const m of text.matchAll(pyDirect)) {
    pushPyeong(m.index, m[1] ?? "");
  }

  const pyLabeled = new RegExp(
    `${INTAKE_AREA_YAK}평(?:형)?\\s*(\\d+(?:\\.\\d+)?)`,
    "gi"
  );
  for (const m of text.matchAll(pyLabeled)) {
    pushPyeong(m.index, m[1] ?? "");
  }

  const m2Direct = new RegExp(
    `${INTAKE_AREA_YAK}(\\d+(?:\\.\\d+)?)\\s*${INTAKE_M2_UNIT}`,
    "gi"
  );
  for (const m of text.matchAll(m2Direct)) {
    if (m.index == null) continue;
    const n = Number(m[1]);
    if (!Number.isFinite(n) || n <= 0) continue;
    hits.push({ index: m.index, pyeong: m2ToPyeong(n) });
  }

  const m2Labeled = new RegExp(
    `${INTAKE_AREA_YAK}${INTAKE_M2_UNIT}\\s*(\\d+(?:\\.\\d+)?)`,
    "gi"
  );
  for (const m of text.matchAll(m2Labeled)) {
    if (m.index == null) continue;
    const n = Number(m[1]);
    if (!Number.isFinite(n) || n <= 0) continue;
    hits.push({ index: m.index, pyeong: m2ToPyeong(n) });
  }

  if (hits.length === 0) return undefined;
  hits.sort((a, b) => a.index - b.index);
  return hits[0].pyeong;
}

const INTAKE_AREA_CONSUME_RES = [
  new RegExp(`${INTAKE_AREA_YAK}\\d+(?:\\.\\d+)?\\s*평(?:형)?`, "i"),
  new RegExp(`${INTAKE_AREA_YAK}평(?:형)?\\s*\\d+(?:\\.\\d+)?`, "i"),
  new RegExp(`${INTAKE_AREA_YAK}\\d+(?:\\.\\d+)?\\s*${INTAKE_M2_UNIT}`, "i"),
  new RegExp(`${INTAKE_AREA_YAK}${INTAKE_M2_UNIT}\\s*\\d+(?:\\.\\d+)?`, "i"),
];

/** 대화 intake — 면적 표현 뒤 남은 글 */
export function consumeIntakeAreaPrefix(text: string): string {
  let earliest: { index: number; len: number } | null = null;
  for (const re of INTAKE_AREA_CONSUME_RES) {
    const m = text.match(re);
    if (!m || m.index == null) continue;
    if (!earliest || m.index < earliest.index) {
      earliest = { index: m.index, len: m[0].length };
    }
  }
  if (!earliest) return text;
  return text.slice(earliest.index + earliest.len).replace(/^\s+/, "");
}

function intakeAreaNumberPattern(value: number): string {
  const fixed = formatAreaDisplay(value);
  const chip = formatAreaChip(value);
  const nums = new Set<string>([
    String(value),
    fixed,
    chip,
    fixed.replace(/\.?0+$/, ""),
  ]);
  return [...nums]
    .filter(Boolean)
    .map((n) => n.replace(".", "\\."))
    .join("|");
}

/** intake로 채운 면적 문구를 메모에서 제거 */
export function stripIntakeAreaPhrases(
  text: string,
  areaPyeong?: number
): string {
  let next = text;
  if (areaPyeong != null && areaPyeong > 0) {
    const py = intakeAreaNumberPattern(areaPyeong);
    const m2 = intakeAreaNumberPattern(pyeongToM2(areaPyeong));
    next = next.replace(
      new RegExp(`${INTAKE_AREA_YAK}(?:${py})\\s*평(?:형)?`, "gi"),
      " "
    );
    next = next.replace(
      new RegExp(`${INTAKE_AREA_YAK}평(?:형)?\\s*(?:${py})`, "gi"),
      " "
    );
    next = next.replace(
      new RegExp(`${INTAKE_AREA_YAK}(?:${m2})\\s*${INTAKE_M2_UNIT}`, "gi"),
      " "
    );
    next = next.replace(
      new RegExp(`${INTAKE_AREA_YAK}${INTAKE_M2_UNIT}\\s*(?:${m2})`, "gi"),
      " "
    );
  }
  next = next.replace(
    new RegExp(`${INTAKE_AREA_YAK}\\d+(?:\\.\\d+)?\\s*평(?:형)?`, "gi"),
    " "
  );
  next = next.replace(
    new RegExp(`${INTAKE_AREA_YAK}평(?:형)?\\s*\\d+(?:\\.\\d+)?`, "gi"),
    " "
  );
  next = next.replace(
    new RegExp(`${INTAKE_AREA_YAK}\\d+(?:\\.\\d+)?\\s*${INTAKE_M2_UNIT}`, "gi"),
    " "
  );
  next = next.replace(
    new RegExp(`${INTAKE_AREA_YAK}${INTAKE_M2_UNIT}\\s*\\d+(?:\\.\\d+)?`, "gi"),
    " "
  );
  next = next.replace(/\b평형\b/g, " ");
  return next.replace(/[^\S\n]+/g, " ").trim();
}

export function formatLandAreaLine(pyeong: number | undefined | null): string {
  if (pyeong == null || !Number.isFinite(pyeong)) return "";
  return `${formatAreaWithUnit(pyeong, "평")} · ${formatAreaWithUnit(pyeongToM2(pyeong), "㎡")}`;
}
