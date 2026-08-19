import type { Property } from "./types";

type DoorPasswordFields = Pick<
  Property,
  "notes" | "floorPassword" | "roomPassword" | "password"
>;

/** 매물에 남은 현관·호실 비밀번호를 메모 한 줄로 */
export function doorPasswordMemoText(property: DoorPasswordFields): string {
  const parts: string[] = [];
  const floor = property.floorPassword?.trim();
  const room = (property.roomPassword || property.password)?.trim();
  if (floor) parts.push(`현관 ${floor}`);
  if (room) parts.push(`호실 ${room}`);
  return parts.join(" · ");
}

export function propertyHasDoorPasswords(property: DoorPasswordFields): boolean {
  return Boolean(doorPasswordMemoText(property));
}

export function notesWithDoorPasswords(property: DoorPasswordFields): string {
  const extra = doorPasswordMemoText(property);
  const base = (property.notes ?? "").trim();
  if (!extra) return base;
  if (!base) return extra;
  if (base.includes(extra)) return base;
  return `${base}\n${extra}`;
}

/** 매물 저장용: 전용 칸을 비우고 메모로 옮긴다 */
export function foldDoorPasswordsIntoNotes<T extends DoorPasswordFields>(
  property: T
): T {
  if (!propertyHasDoorPasswords(property)) return property;
  return {
    ...property,
    notes: notesWithDoorPasswords(property),
    floorPassword: "",
    roomPassword: "",
    password: undefined,
  };
}
