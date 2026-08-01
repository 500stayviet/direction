"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { getListedProperties } from "@/lib/storage";
import { formatDepositRent } from "@/lib/format";
import type { ListedProperty } from "@/lib/types";

interface PropertyLoadPickerProps {
  onSelect: (property: ListedProperty) => void;
}

function matchesProperty(p: ListedProperty, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return (
    p.address.toLowerCase().includes(needle) ||
    p.roomNo.toLowerCase().includes(needle) ||
    (p.partnerAgency?.name ?? "").toLowerCase().includes(needle) ||
    (p.partnerAgency?.dong ?? "").toLowerCase().includes(needle)
  );
}

export function PropertyLoadPicker({ onSelect }: PropertyLoadPickerProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [all, setAll] = useState<ListedProperty[]>([]);

  useEffect(() => {
    if (open) {
      void getListedProperties().then(setAll);
      setQuery("");
    }
  }, [open]);

  const filtered = useMemo(() => {
    return all.filter((p) => matchesProperty(p, query)).slice(0, 10);
  }, [all, query]);

  const close = () => setOpen(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-dashed border-[#3182F6]/35 bg-blue-50/60 px-3.5 py-3 text-left active:scale-[0.99] transition-all duration-150"
      >
        <div className="min-w-0">
          <p className="text-[14px] font-bold text-[#3182F6]">
            내 매물 리스트에서 불러오기
          </p>
          <p className="mt-0.5 text-[12px] font-medium text-gray-500">
            눌러서 주소·호실·부동산 이름으로 찾기
          </p>
        </div>
        <span className="shrink-0 text-[18px] font-light text-[#3182F6]">›</span>
      </button>

      <Modal
        open={open}
        onClose={close}
        position="center"
        title="내 매물 리스트에서 불러오기"
        description="주소 · 호실 · 부동산 이름으로 검색하세요"
      >
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="찾기: 성내동, 1203호, OO부동산"
          className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-3 text-[15px] font-medium text-gray-900 outline-none transition focus:border-[#3182F6] focus:bg-white focus:ring-2 focus:ring-[#3182F6]/20"
        />

        <div className="mt-3 max-h-64 space-y-1.5 overflow-y-auto">
          {all.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-500">
              저장된 매물이 없습니다. 홈에서 매물을 먼저 등록해 주세요.
            </p>
          ) : filtered.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-500">
              검색 결과가 없습니다.
            </p>
          ) : (
            filtered.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  onSelect(p);
                  close();
                }}
                className="w-full rounded-xl border border-gray-100 bg-white px-3 py-2.5 text-left shadow-sm active:scale-[0.99] transition-all duration-150"
              >
                <p className="truncate text-[15px] font-bold text-gray-900">
                  {p.address || "주소 미입력"}
                </p>
                <p className="mt-0.5 truncate text-[12px] text-gray-500">
                  {p.roomNo || "호실 미입력"}
                  {p.partnerAgency?.name ? ` · ${p.partnerAgency.name}` : ""}
                </p>
                <p className="mt-1 truncate text-[12px] font-medium text-gray-600">
                  {p.roomType ?? "-"} · {p.dealType} ·{" "}
                  {formatDepositRent(p.dealType, p.deposit, p.monthlyRent)}
                </p>
              </button>
            ))
          )}
        </div>

        <Button fullWidth variant="secondary" className="mt-4" onClick={close}>
          닫기
        </Button>
      </Modal>
    </>
  );
}

/** 리스트 매물 → 일정 매물 슬롯에 복사 (슬롯 id 유지) */
export function applyListedToProperty(
  currentId: string,
  listed: ListedProperty
) {
  const { createdAt: _c, updatedAt: _u, ...rest } = listed;
  return {
    ...rest,
    id: currentId,
  };
}
