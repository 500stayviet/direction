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

function composeDongHo(dong: string, ho: string): string {
  if (dong && ho) return `${dong}동 ${ho}호`;
  if (dong) return `${dong}동`;
  if (ho) return `${ho}호`;
  return "";
}

/**
 * 건물명 동 호실 칸 정규화.
 * 앞 건물명은 두고, 101-101 / 101/101 / 101 101호 → 101동 101호.
 * 숫자만이면 호. 이미 동·호가 있으면 중복으로 붙이지 않는다.
 */
export function formatRoomNoHo(roomNo: string): string {
  const text = (roomNo ?? "").trim().replace(/\s+/g, " ");
  if (!text) return "";

  const rest = text
    .replace(/(\d)\s*동(?:\s*동)+/g, "$1동")
    .replace(/(\d)\s*호(?:\s*호)+/g, "$1호");

  const rules: Array<{
    re: RegExp;
    parts: (m: RegExpMatchArray) => { dong: string; ho: string };
  }> = [
    {
      re: /(\d+)\s*동\s*[-/／]?\s*(\d+)\s*호?\s*$/,
      parts: (m) => ({ dong: m[1] ?? "", ho: m[2] ?? "" }),
    },
    {
      re: /(\d+)\s*[-/／−–—]\s*(\d+)\s*호?\s*$/,
      parts: (m) => ({ dong: m[1] ?? "", ho: m[2] ?? "" }),
    },
    {
      re: /(\d+)\s+(\d+)\s*호?\s*$/,
      parts: (m) => ({ dong: m[1] ?? "", ho: m[2] ?? "" }),
    },
    {
      re: /(\d+)\s*동\s*$/,
      parts: (m) => ({ dong: m[1] ?? "", ho: "" }),
    },
    {
      re: /(\d+)\s*호\s*$/,
      parts: (m) => ({ dong: "", ho: m[1] ?? "" }),
    },
    {
      re: /(\d+)\s*$/,
      parts: (m) => ({ dong: "", ho: m[1] ?? "" }),
    },
  ];

  for (const rule of rules) {
    const m = rest.match(rule.re);
    if (!m || m.index == null) continue;
    const prefix = rest.slice(0, m.index).trim();
    const room = composeDongHo(rule.parts(m).dong, rule.parts(m).ho);
    return [prefix, room].filter(Boolean).join(" ");
  }
  return rest;
}

export function formatPropertyPlaceLine(p: {
  buildingName?: string;
  roomNo?: string;
}): string {
  return [p.buildingName?.trim(), p.roomNo?.trim()].filter(Boolean).join(" ");
}
