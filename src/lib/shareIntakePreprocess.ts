import { isPropertyBlankFormText } from "@/lib/blankIntakeForm";
import { stripAgentShareFooter } from "@/lib/shareAgentFooter";

type SharePropertyFields = {
  dealType?: string;
  roomType?: string;
  roomCount?: string;
  bathroomCount?: string;
  money?: string;
  address?: string;
  roomNo?: string;
  moveIn?: string;
  maintenance?: string;
  options?: string;
  loan?: string;
  insurance?: string;
  parking?: string;
  elevator?: string;
  memo?: string;
  visitTime?: string;
  extraMemo?: string[];
};

function yesNoFromShare(value: string): string {
  const t = value.replace(/\s+/g, "");
  if (/^(유|있음|가능|필요|필)$/.test(t)) return "유";
  if (/^(무|없음|불가|불가능|불필요|불)$/.test(t)) return "무";
  if (/가능/.test(t)) return "유";
  if (/불가/.test(t)) return "무";
  return value.trim();
}

function parseShareType(value: string): { roomType?: string; dealType?: string } {
  const parts = value
    .split(/[·・]/)
    .map((s) => s.trim())
    .filter(Boolean);
  let roomType: string | undefined;
  let dealType: string | undefined;
  for (const part of parts) {
    if (/^(매매|전세|월세)$/.test(part)) {
      dealType = part;
    } else {
      roomType = part;
    }
  }
  return { roomType, dealType };
}

function parseShareRoomBath(value: string): {
  roomCount?: string;
  bathroomCount?: string;
} {
  const room = value.match(/방\s*(\d+)/);
  const bath = value.match(/화장실\s*(\d+)/);
  return {
    roomCount: room?.[1] ? `${room[1]}개` : undefined,
    bathroomCount: bath?.[1] ? `${bath[1]}개` : undefined,
  };
}

function normalizeShareMaintenance(value: string): string {
  const main = value.replace(/\s*\([^)]*\)\s*$/, "").trim();
  return main;
}

function mapShareLabel(label: string): string {
  return label.replace(/\s+/g, "").toLowerCase();
}

function parseSharePropertyBlock(block: string): SharePropertyFields {
  const fields: SharePropertyFields = {};
  const extras: string[] = [];
  const memoParts: string[] = [];

  const lines = block
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  for (const line of lines) {
    if (/^매물\s*안내$/i.test(line)) continue;
    if (/^■\s*\d+번\s*매물$/.test(line)) continue;

    const labeled = line.match(/^(.+?)\s*[:：]\s*(.+)$/);
    if (!labeled) {
      extras.push(line);
      continue;
    }

    const key = mapShareLabel(labeled[1]);
    const value = labeled[2].trim();
    if (!value || value === "-") continue;

    if (key === "주소") {
      fields.address = value;
      continue;
    }
    if (key === "호실") {
      fields.roomNo = value;
      continue;
    }
    if (key === "방문약속") {
      fields.visitTime = value;
      continue;
    }
    if (key === "유형") {
      const t = parseShareType(value);
      if (t.roomType) fields.roomType = t.roomType;
      if (t.dealType) fields.dealType = t.dealType;
      continue;
    }
    if (key === "방·화장실" || key === "방화장실") {
      const rb = parseShareRoomBath(value);
      if (rb.roomCount) fields.roomCount = rb.roomCount;
      if (rb.bathroomCount) fields.bathroomCount = rb.bathroomCount;
      continue;
    }
    if (key === "금액") {
      fields.money = value;
      continue;
    }
    if (key === "관리비") {
      fields.maintenance = value;
      continue;
    }
    if (key === "입주가능") {
      fields.moveIn = value;
      continue;
    }
    if (key === "대출") {
      fields.loan = yesNoFromShare(value);
      continue;
    }
    if (key === "보증보험" || key === "전세보증보험") {
      fields.insurance = yesNoFromShare(value);
      continue;
    }
    if (key === "주차" || key === "주차가능") {
      fields.parking = value;
      continue;
    }
    if (key === "엘리베이터" || key === "엘베" || key === "승강기") {
      fields.elevator = yesNoFromShare(value);
      continue;
    }
    if (key === "옵션") {
      fields.options = value;
      continue;
    }
    if (key === "메모") {
      memoParts.push(value);
      continue;
    }
    extras.push(line);
  }

  if (extras.length) fields.extraMemo = extras;
  if (memoParts.length) fields.memo = memoParts.join(" ");
  return fields;
}

function rebuildSharePropertyMessage(fields: SharePropertyFields): string {
  const parts: string[] = [];
  if (fields.dealType) parts.push(fields.dealType);
  if (fields.roomType) parts.push(fields.roomType);

  const isOneRoom = /원룸/.test((fields.roomType ?? "").replace(/\s+/g, ""));
  if (!isOneRoom && fields.roomCount) {
    const n = fields.roomCount.replace(/\s+/g, "");
    parts.push(/방/.test(n) ? fields.roomCount : `방 ${fields.roomCount}`);
  }
  if (!isOneRoom && fields.bathroomCount) {
    const n = fields.bathroomCount.replace(/\s+/g, "");
    parts.push(
      /화장|화/.test(n) ? fields.bathroomCount : `화장실 ${fields.bathroomCount}`
    );
  }

  if (fields.money) parts.push(fields.money);

  const addressBits = [fields.address, fields.roomNo ? `호실 ${fields.roomNo}` : ""]
    .filter(Boolean)
    .join(" ");
  if (addressBits) parts.push(addressBits);

  if (fields.moveIn) parts.push(fields.moveIn);
  if (fields.maintenance) {
    parts.push(`관리비 ${normalizeShareMaintenance(fields.maintenance)}`);
  }
  if (fields.options) parts.push(fields.options);
  if (fields.loan) parts.push(`대출 ${yesNoFromShare(fields.loan)}`);
  if (fields.insurance) {
    parts.push(`전세보증보험 ${yesNoFromShare(fields.insurance)}`);
  }
  if (fields.parking) {
    const p = fields.parking.trim();
    if (/^유\b|^무\b/.test(p)) {
      parts.push(`주차 ${p}`);
    } else {
      parts.push(`주차 ${yesNoFromShare(p.split(/[·・]/)[0] ?? p)}`);
    }
  }
  if (fields.elevator) {
    parts.push(`엘리베이터 ${yesNoFromShare(fields.elevator)}`);
  }

  const memoBits = [
    fields.visitTime ? `방문 약속 ${fields.visitTime}` : "",
    fields.memo ?? "",
    ...(fields.extraMemo ?? []),
  ].filter(Boolean);
  if (memoBits.length) parts.push(`메모: ${memoBits.join(" · ")}`);

  return parts.join("\n").trim();
}

function splitSharePropertyBlocks(body: string): string[] {
  const normalized = body.replace(/\r\n/g, "\n").trim();
  const blocks = normalized
    .split(/(?=■\s*\d+번\s*매물)/)
    .map((b) => b.trim())
    .filter((b) => /주소\s*[:：]/.test(b));
  if (blocks.length > 0) return blocks;
  if (/매물\s*안내/i.test(normalized) && /주소\s*[:：]/.test(normalized)) {
    return [normalized];
  }
  return [];
}

/** 앱 「공유하기」 매물 안내 문구인지 (등록 양식과 구분) */
export function isPropertyShareText(raw: string): boolean {
  if (isPropertyBlankFormText(raw)) return false;
  if (/^\s*매물\s*안내\b/im.test(raw)) return true;
  return /■\s*\d+번\s*매물/.test(raw) && /주소\s*[:：]/.test(raw);
}

/**
 * 공유 매물 안내 → parseIntakeText가 읽기 쉬운 짧은 메시지.
 * 양식·공유가 아니면 null. 여러 매물이면 **1번만** 반영.
 */
export function preprocessPropertyShareText(raw: string): string | null {
  if (!isPropertyShareText(raw)) return null;
  const body = stripAgentShareFooter(raw);
  const blocks = splitSharePropertyBlocks(body);
  if (blocks.length === 0) return null;

  const fields = parseSharePropertyBlock(blocks[0]!);
  const rebuilt = rebuildSharePropertyMessage(fields);
  return rebuilt || "";
}
