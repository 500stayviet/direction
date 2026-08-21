/** 알람 라벨 — 클라·서버 공용 (DOM 없음) */

export function formatOwnMatchBadgeLabel(count: number): string {
  return count > 1 ? `매칭 ${count}` : "매칭";
}

export function formatSiteMatchBadgeLabel(count: number): string {
  return count > 1 ? `사이트내 ${count}` : "사이트내";
}

export function formatShareBadgeLabel(): string {
  return "팀공유";
}

export function formatDocumentTitleAlertSuffix(total: number): string {
  if (total <= 0) return "";
  return `(${total}) `;
}

export function formatAlertBannerText(input: {
  matchOwn: number;
  matchPartner: number;
  share: number;
}): string {
  const parts: string[] = [];
  const matchTotal = input.matchOwn + input.matchPartner;
  if (matchTotal > 0) {
    parts.push(
      input.matchPartner > 0
        ? `새 매칭 ${matchTotal}건`
        : `조건 매칭 ${matchTotal}건`
    );
  }
  if (input.share > 0) {
    parts.push(`팀 공유 ${input.share}건`);
  }
  if (parts.length === 0) return "";
  return `${parts.join(" · ")} — 확인하기`;
}
