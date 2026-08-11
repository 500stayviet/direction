import type { ReactNode } from "react";
import { displayRoomType, normalizeRoomType } from "@/lib/constants";
import type { RoomType } from "@/lib/types";

function roomTypeChipClass(roomType?: RoomType | string, done?: boolean) {
  if (done) return "bg-gray-400";
  switch (normalizeRoomType(roomType) ?? roomType) {
    case "원룸":
      return "bg-sky-500";
    case "투룸":
      return "bg-emerald-500";
    case "3룸+":
      return "bg-orange-500";
    case "아파트":
      return "bg-rose-500";
    case "상가":
      return "bg-cyan-600";
    case "사무실":
      return "bg-teal-600";
    case "토지":
      return "bg-lime-700";
    case "건물":
      return "bg-slate-600";
    default:
      return "bg-gray-600";
  }
}

function dealTypeChipClass(dealType?: string | null, done?: boolean) {
  if (done) return "bg-gray-400";
  switch (dealType) {
    case "전세":
      return "bg-blue-600";
    case "월세":
      return "bg-amber-500";
    case "매매":
      return "bg-fuchsia-600";
    default:
      return "bg-[#3182F6]";
  }
}

/** 보증금·매가(만원) → 억 구간별 색 */
function depositChipClass(depositMan?: number | null, done?: boolean) {
  if (done) return "bg-gray-400";
  const n = Math.max(0, Math.round(depositMan ?? 0));
  const eok = Math.floor(n / 10000);
  if (eok <= 0) return "bg-stone-500";
  if (eok === 1) return "bg-yellow-600";
  if (eok === 2) return "bg-orange-600";
  if (eok === 3) return "bg-red-500";
  return "bg-red-800";
}

const chipBase =
  "inline-flex shrink-0 truncate rounded-lg px-2 py-0.5 text-[12px] font-extrabold text-white shadow-sm";

type ListEdgeChipsProps = {
  roomType?: RoomType | string | null;
  buildingKind?: string | null;
  dealType?: string | null;
  moneyLabel?: string | null;
  /** 보증금·매가(만원) — 금액 칩 색 구간용 */
  depositMan?: number | null;
  done?: boolean;
  right?: ReactNode;
  /** edge: 카드 테두리 위(기본) / inline: 카드 안 흐름 배치 */
  placement?: "edge" | "inline";
};

/** 매물유형 → 거래유형 → 금액 순, 각기 박스 */
export function ListEdgeChips({
  roomType,
  buildingKind,
  dealType,
  moneyLabel,
  depositMan,
  done,
  right,
  placement = "edge",
}: ListEdgeChipsProps) {
  const typeLabel = roomType
    ? displayRoomType(roomType, buildingKind)
    : null;
  const typeText = typeLabel && typeLabel !== "-" ? typeLabel : null;
  const dealText = dealType?.trim() || null;
  const moneyText =
    moneyLabel?.trim() && moneyLabel.trim() !== "-"
      ? moneyLabel.trim()
      : null;

  if (!typeText && !dealText && !moneyText && !right) return null;

  const chips = (
    <>
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
        {typeText ? (
          <p
            className={[
              chipBase,
              roomTypeChipClass(roomType ?? undefined, done),
            ].join(" ")}
          >
            {typeText}
          </p>
        ) : null}
        {dealText ? (
          <p
            className={[chipBase, dealTypeChipClass(dealType, done)].join(" ")}
          >
            {dealText}
          </p>
        ) : null}
        {moneyText ? (
          <p
            className={[
              chipBase,
              "min-w-0 shrink",
              depositChipClass(depositMan, done),
            ].join(" ")}
          >
            {moneyText}
          </p>
        ) : null}
      </div>
      {right ? (
        <div className="pointer-events-auto shrink-0 cursor-pointer">{right}</div>
      ) : null}
    </>
  );

  if (placement === "inline") {
    return (
      <div className="flex items-center gap-1 overflow-hidden">{chips}</div>
    );
  }

  return (
    <div className="pointer-events-none absolute inset-x-2 top-2 z-10 flex -translate-y-1/2 items-center gap-1">
      {chips}
    </div>
  );
}
