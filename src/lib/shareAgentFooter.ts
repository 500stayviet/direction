import { formatPhone } from "@/lib/format";
import type { User } from "@/lib/types";

/** 공유·양식 하단: 업장·담당·전화·제공 (값 없으면 라벨만) */
export function buildAgentShareFooterLines(
  agent: Pick<User, "shopName" | "name" | "phone"> | null | undefined
): string[] {
  const rawShop = (agent?.shopName || "").trim();
  const shop = !rawShop || rawShop === "현장동선" ? "" : rawShop;
  const agentName = (agent?.name || "").trim();
  const agentPhone =
    formatPhone(agent?.phone || "") || (agent?.phone || "").trim();

  const lines: string[] = [];
  lines.push("─".repeat(12));
  if (shop) {
    const hasLabel =
      shop.includes("부동산") || shop.includes("공인중개사사무소");
    lines.push(hasLabel ? shop : `${shop} 공인중개사사무소`);
  } else {
    lines.push("부동산");
  }
  lines.push(agentName ? `담당 ${agentName}` : "담당");
  lines.push(agentPhone ? agentPhone : "전화번호");
  lines.push("-제공-");
  lines.push("앱 현장동선");
  return lines;
}

/** 공유·양식 본문 — 업장 푸터(──── / -제공-) 이전만 */
export function stripAgentShareFooter(text: string): string {
  const cut = text.search(/[─-]{3,}/);
  if (cut >= 0) return text.slice(0, cut).trimEnd();
  const provided = text.search(/\s*-제공-\s*/);
  if (provided >= 0) return text.slice(0, provided).trimEnd();
  return text.trimEnd();
}
