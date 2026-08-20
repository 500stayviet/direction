"use client";

import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { formatDisplayTime } from "@/components/TimePicker";
import type { Property } from "@/lib/types";

type SchedulePropertySwapModalProps = {
  open: boolean;
  onClose: () => void;
  properties: Property[];
  fromIndex: number;
  onSelect: (toIndex: number) => void;
};

function propertyLine(p: Property): string {
  const address = p.address?.trim() || "주소 미입력";
  const room = p.roomNo?.trim();
  return room ? `${address} ${room}` : address;
}

/** 방문 일정 매물끼리 자리(시간 슬롯) 맞바꾸기 */
export function SchedulePropertySwapModal({
  open,
  onClose,
  properties,
  fromIndex,
  onSelect,
}: SchedulePropertySwapModalProps) {
  const from = properties[fromIndex];
  const canSwap = properties.length > 1;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="매물 순서 변경"
      description={
        canSwap
          ? from
            ? `${fromIndex + 1}번 매물을 어느 자리와 바꿀까요? 물건예약시간은 자리에 그대로 남고, 매물만 바뀝니다.`
            : undefined
          : undefined
      }
      position="bottom"
      dense
      showClose
    >
      {!canSwap ? (
        <div className="space-y-3">
          <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-5 text-center">
            <p className="text-[15px] font-extrabold text-gray-900">
              순서 변경 가능한 매물이 없습니다
            </p>
            <p className="mt-1.5 text-[13px] font-medium text-gray-500">
              매물을 2개 이상 등록하면 자리를 바꿀 수 있어요.
            </p>
          </div>
          <Button type="button" fullWidth onClick={onClose}>
            확인
          </Button>
        </div>
      ) : (
        <div className="max-h-[50vh] space-y-2 overflow-y-auto">
          {properties.map((p, i) => {
            const current = i === fromIndex;
            const time = p.arriveTime?.trim()
              ? formatDisplayTime(p.arriveTime)
              : "시간 미정";
            return (
              <button
                key={p.id}
                type="button"
                disabled={current}
                onClick={() => {
                  onSelect(i);
                  onClose();
                }}
                className={[
                  "flex w-full items-start gap-3 rounded-2xl border px-3.5 py-3 text-left transition-all active:scale-[0.99]",
                  current
                    ? "cursor-default border-gray-100 bg-gray-50 opacity-60"
                    : "border-[#3182F6]/25 bg-white hover:border-[#3182F6] hover:bg-blue-50/40",
                ].join(" ")}
              >
                <span
                  className={[
                    "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-[13px] font-extrabold",
                    current
                      ? "bg-gray-200 text-gray-500"
                      : "bg-[#3182F6] text-white",
                  ].join(" ")}
                >
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-[14px] font-extrabold text-gray-900">
                      {i + 1}번 자리
                    </p>
                    <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[11px] font-bold text-gray-600">
                      {time}
                    </span>
                    {current ? (
                      <span className="rounded-md bg-gray-200 px-1.5 py-0.5 text-[11px] font-bold text-gray-500">
                        현재
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 truncate text-[13px] font-semibold text-gray-600">
                    {propertyLine(p)}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
