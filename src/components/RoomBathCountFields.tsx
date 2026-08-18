"use client";

import {
  bathroomCountOptionsForType,
  defaultRoomBathCounts,
  isRoomCountFixed,
  needsRoomBathCounts,
  roomCountOptionsForType,
} from "@/lib/constants";
import {
  emptyRequiredClass,
  invalidHintClass,
  invalidLabelClass,
  requiredStarClass,
  controlStatusClass,
} from "@/lib/uiInvalid";

type Props = {
  roomType?: string | null;
  roomCount?: number;
  bathroomCount?: number;
  onChange: (next: { roomCount: number; bathroomCount: number }) => void;
  invalidRoomCount?: boolean;
  /** true면 유형 모달 안에 숫자 칸을 바로 보여 줌 */
  embedded?: boolean;
  /** 폼의 방/화장실 버튼을 누르면 유형 모달을 염 */
  onEdit?: () => void;
};

function countsFor(roomType?: string | null, roomCount?: number, bathroomCount?: number) {
  const fixedRooms = isRoomCountFixed(roomType);
  const minRooms = roomType === "3룸+" ? 3 : 1;
  const defaults = roomType ? defaultRoomBathCounts(roomType) : null;
  const rooms = fixedRooms
    ? 2
    : roomCount && roomCount >= minRooms
      ? roomCount
      : defaults && needsRoomBathCounts(roomType)
        ? defaults.roomCount
        : 0;
  const baths =
    bathroomCount && bathroomCount > 0
      ? bathroomCount
      : defaults && needsRoomBathCounts(roomType)
        ? defaults.bathroomCount
        : 0;
  return {
    fixedRooms,
    roomOptions: roomCountOptionsForType(roomType),
    bathOptions: bathroomCountOptionsForType(roomType),
    rooms,
    baths,
  };
}

export function RoomBathCountGrids({
  roomType,
  roomCount,
  bathroomCount,
  onChange,
  invalidRoomCount,
}: Props) {
  if (!needsRoomBathCounts(roomType)) return null;
  const { fixedRooms, roomOptions, bathOptions, rooms, baths } = countsFor(
    roomType,
    roomCount,
    bathroomCount
  );

  return (
    <div className="mt-3 grid grid-cols-2 gap-2 border-t border-gray-100 pt-3">
      <div className="min-w-0 space-y-1">
        <p
          className={[
            "text-[13px] font-semibold",
            invalidRoomCount && !fixedRooms
              ? invalidLabelClass
              : "text-gray-600",
          ].join(" ")}
        >
          방 수
          <span className={requiredStarClass}>*</span>
        </p>
        <div className="grid grid-cols-3 gap-1.5" data-testid="room-count-options">
          {roomOptions.map((opt) => {
            const active = String(rooms) === opt;
            return (
              <button
                key={opt}
                type="button"
                disabled={fixedRooms}
                onClick={() =>
                  onChange({ roomCount: Number(opt), bathroomCount: baths })
                }
                className={[
                  "min-h-[40px] rounded-xl text-[14px] font-bold",
                  "active:scale-95 transition-all duration-150",
                  fixedRooms ? "cursor-default" : "",
                  active
                    ? "bg-[#3182F6] text-white shadow-sm"
                    : "bg-gray-100 text-gray-600",
                ].join(" ")}
              >
                {opt}개
              </button>
            );
          })}
        </div>
      </div>
      <div className="min-w-0 space-y-1">
        <p className="text-[13px] font-semibold text-gray-600">화장실 수</p>
        <div className="grid grid-cols-3 gap-1.5" data-testid="bathroom-count-options">
          {bathOptions.map((opt) => {
            const active = String(baths) === opt;
            return (
              <button
                key={opt}
                type="button"
                onClick={() =>
                  onChange({
                    roomCount: fixedRooms ? 2 : rooms,
                    bathroomCount: Number(opt),
                  })
                }
                className={[
                  "min-h-[40px] rounded-xl text-[14px] font-bold",
                  "active:scale-95 transition-all duration-150",
                  active
                    ? "bg-[#3182F6] text-white shadow-sm"
                    : "bg-gray-100 text-gray-600",
                ].join(" ")}
              >
                {opt}개
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CountButton({
  label,
  required,
  invalid,
  valueLabel,
  onClick,
}: {
  label: string;
  required?: boolean;
  invalid?: boolean;
  valueLabel: string;
  onClick: () => void;
}) {
  const empty = !valueLabel;
  return (
    <div
      className={[
        "min-w-0",
        invalid ? emptyRequiredClass({ invalid: true }) : "space-y-1",
      ].join(" ")}
    >
      <p
        className={[
          "text-[13px] font-semibold",
          invalid ? invalidLabelClass : "text-gray-600",
        ].join(" ")}
      >
        {label}
        {required ? (
          <span className={requiredStarClass}>
            *
          </span>
        ) : null}
      </p>
      {invalid ? (
        <p className={`text-xs ${invalidHintClass}`}>미입력</p>
      ) : null}
      <button
        type="button"
        onClick={onClick}
        className={[
          "flex min-h-[36px] w-full items-center justify-center rounded-xl px-3 text-[15px]",
          "transition-all duration-150 active:scale-95",
          empty
            ? controlStatusClass({ invalid, filled: false })
            : controlStatusClass({ filled: true }),
        ].join(" ")}
      >
        {empty ? `${label} 선택` : valueLabel}
      </button>
    </div>
  );
}

export function RoomBathCountFields({
  roomType,
  roomCount,
  bathroomCount,
  onChange,
  invalidRoomCount,
  embedded,
  onEdit,
}: Props) {
  if (!needsRoomBathCounts(roomType)) return null;

  if (embedded) {
    return (
      <RoomBathCountGrids
        roomType={roomType}
        roomCount={roomCount}
        bathroomCount={bathroomCount}
        invalidRoomCount={invalidRoomCount}
        onChange={onChange}
      />
    );
  }

  const { fixedRooms, rooms, baths } = countsFor(
    roomType,
    roomCount,
    bathroomCount
  );
  const openEdit = () => onEdit?.();

  return (
    <div className="grid grid-cols-2 gap-2">
      <CountButton
        label="방 수"
        required
        invalid={!fixedRooms && Boolean(invalidRoomCount)}
        valueLabel={rooms > 0 ? `${rooms}개` : ""}
        onClick={openEdit}
      />
      <CountButton
        label="화장실 수"
        valueLabel={baths > 0 ? `${baths}개` : ""}
        onClick={openEdit}
      />
    </div>
  );
}
