/** 매물 동·호실 문자열을 건물동 / 호수로 나눈다 */
export function splitPropertyRoomNo(roomNo: string): { dong: string; ho: string } {
  const text = (roomNo ?? "").trim();
  if (!text) return { dong: "", ho: "" };
  const dongHo = text.match(/^(\d+)\s*동(?:\s*(\d+)\s*호)?$/);
  if (dongHo) return { dong: dongHo[1] ?? "", ho: dongHo[2] ?? "" };
  const dongRest = text.match(/^(\d+)\s*동\s+(.+)$/);
  if (dongRest) {
    return {
      dong: dongRest[1] ?? "",
      ho: (dongRest[2] ?? "").replace(/\s*호$/, "").trim(),
    };
  }
  const hoOnly = text.match(/^(\d+)\s*호$/);
  if (hoOnly) return { dong: "", ho: hoOnly[1] ?? "" };
  return { dong: "", ho: text.replace(/\s*호$/, "").trim() };
}

export function composePropertyRoomNo(dong: string, ho: string): string {
  const d = dong.replace(/\D/g, "");
  const hRaw = ho.trim().replace(/\s*호$/, "");
  const hDigits = hRaw.replace(/\D/g, "");
  const h = hDigits && hDigits === hRaw.replace(/\s/g, "") ? hDigits : hRaw;
  if (d && h) return `${d}동 ${h}${/\d$/.test(h) ? "호" : ""}`;
  if (d) return `${d}동`;
  if (h) return /\d$/.test(h) ? `${h}호` : h;
  return "";
}

/** 동·호실이 숫자만이면 호를 붙인다. 예: 1203 → 1203호 */
export function formatRoomNoHo(roomNo: string): string {
  const text = (roomNo ?? "").trim();
  if (/^\d+$/.test(text)) return `${text}호`;
  return text;
}

export function formatPropertyPlaceLine(p: {
  buildingName?: string;
  roomNo?: string;
}): string {
  return [p.buildingName?.trim(), p.roomNo?.trim()].filter(Boolean).join(" ");
}
