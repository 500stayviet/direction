/** 선호위치 구·동 인코딩/표시 (UI 비의존) */

const SEP = "|";

export function encodePreferredDong(gu: string, dong: string) {
  return `${gu}${SEP}${dong}`;
}

export const DEFAULT_PREFERRED_GU = "강동구";

/** 신규 폼 저장값 초기 — 하단 결과에는 넣지 않음 (박스는 강동구만 표시) */
export function defaultPreferredLocation(): {
  preferredGus: string[];
  preferredDongs: string[];
} {
  return { preferredGus: [], preferredDongs: [] };
}

export function parsePreferredDong(
  raw: string
): { gu: string; dong: string } | null {
  const i = String(raw ?? "").indexOf(SEP);
  if (i <= 0) return null;
  const gu = raw.slice(0, i).trim();
  const dong = raw.slice(i + 1).trim();
  if (!gu || !dong) return null;
  return { gu, dong };
}

export function groupDongsByGu(encoded: string[]): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const raw of encoded) {
    const parsed = parsePreferredDong(raw);
    if (!parsed) continue;
    if (!map[parsed.gu]) map[parsed.gu] = [];
    if (!map[parsed.gu].includes(parsed.dong)) {
      map[parsed.gu].push(parsed.dong);
    }
  }
  return map;
}

/** 구·동이 모두 선택된 항목만 사용 (동만 있어도 구 복원) */
export function completedPreferredGus(
  preferredGus: string[],
  preferredDongs: string[]
): string[] {
  const grouped = groupDongsByGu(preferredDongs);
  const fromDongs = Object.keys(grouped);
  if (fromDongs.length === 0) return [];
  const ordered = preferredGus.filter((gu) => (grouped[gu]?.length ?? 0) > 0);
  for (const gu of fromDongs.sort()) {
    if (!ordered.includes(gu)) ordered.push(gu);
  }
  return ordered;
}

export function preferredLocationRows(customer: {
  preferredGus?: string[];
  preferredDongs?: string[] | string;
}): { gu: string; dongsLabel: string }[] {
  const raw = customer.preferredDongs;
  const dongs = Array.isArray(raw)
    ? raw.map((x) => String(x ?? "").trim()).filter(Boolean)
    : typeof raw === "string" && raw.trim()
      ? [raw.trim()]
      : [];
  if (dongs.length === 0) return [];

  const byGu = groupDongsByGu(dongs);
  const gusFromData = Object.keys(byGu);
  if (gusFromData.length === 0) return [];

  const preferredGus = Array.isArray(customer.preferredGus)
    ? customer.preferredGus
    : [];
  const gus =
    preferredGus.length > 0
      ? preferredGus.filter((gu) => byGu[gu]?.length)
      : gusFromData.sort();
  const finalGus = gus.length > 0 ? gus : gusFromData.sort();

  return finalGus.map((gu) => ({
    gu,
    dongsLabel: (byGu[gu] ?? []).join(", "),
  }));
}

export function formatPreferredLocationLabel(customer: {
  preferredGus?: string[];
  preferredDongs?: string[] | string;
}): string {
  return preferredLocationRows(customer)
    .map((row) =>
      row.dongsLabel ? `${row.gu} ${row.dongsLabel}` : row.gu
    )
    .join(" · ");
}

export { SEP as PREFERRED_DONG_SEP };
