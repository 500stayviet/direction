/** 팀 공유 항목 — 타인 등록 건 수정·삭제 전 경고 */

export type TeamOwnedKind = "고객" | "매물" | "네비";

export function isForeignTeamItem(
  ownerUserId: string | null | undefined,
  myUserId: string | null | undefined
): boolean {
  if (!ownerUserId || !myUserId) return false;
  return ownerUserId !== myUserId;
}

/** 팀원 공유 항목만 「공유자 이름」. 본인 등록은 이름만. */
export function teamSharerLabel(
  createdByName: string | null | undefined,
  createdBy: string | null | undefined,
  myUserId: string | null | undefined
): string {
  const name = createdByName?.trim() || "";
  if (!name) return "";
  if (isForeignTeamItem(createdBy, myUserId)) return `공유자 ${name}`;
  return name;
}

export function foreignTeamDeleteMessage(kind: TeamOwnedKind): string {
  return [
    `다른 팀원이 등록한 ${kind}입니다.`,
    "내 목록에서만 사라집니다. 올린 사람의 목록은 그대로입니다.",
    "상대가 공유를 껐다 다시 켜면 다시 보일 수 있습니다.",
    "",
    "내 목록에서 빼시겠습니까?",
  ].join("\n");
}

export function foreignTeamEditMessage(kind: TeamOwnedKind): string {
  return [
    `다른 팀원이 등록한 ${kind}입니다.`,
    "타인의 업무 정보를 수정합니다.",
    "본인 등록이 아닌 항목이니, 내용을 확인한 뒤 진행하세요.",
    "",
    "내용을 확인했고, 수정을 진행할까요?",
  ].join("\n");
}

export function confirmForeignTeamDelete(kind: TeamOwnedKind): boolean {
  if (typeof window === "undefined") return false;
  return window.confirm(foreignTeamDeleteMessage(kind));
}

export function confirmForeignTeamEdit(kind: TeamOwnedKind): boolean {
  if (typeof window === "undefined") return false;
  return window.confirm(foreignTeamEditMessage(kind));
}
