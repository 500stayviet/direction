"use client";

import { useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { SEOUL_DONG_BY_GU, SEOUL_GU_LIST } from "@/lib/seoulRegions";

const SEP = "|";

export function encodePreferredDong(gu: string, dong: string) {
  return `${gu}${SEP}${dong}`;
}

export const DEFAULT_PREFERRED_GU = "강동구";

export function defaultPreferredLocation(): {
  preferredGus: string[];
  preferredDongs: string[];
} {
  return {
    preferredGus: [DEFAULT_PREFERRED_GU],
    preferredDongs: [],
  };
}

export function parsePreferredDong(
  raw: string
): { gu: string; dong: string } | null {
  const i = raw.indexOf(SEP);
  if (i <= 0) return null;
  return { gu: raw.slice(0, i), dong: raw.slice(i + 1) };
}

function groupDongsByGu(encoded: string[]): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const raw of encoded) {
    const parsed = parsePreferredDong(raw);
    if (!parsed) continue;
    if (!map[parsed.gu]) map[parsed.gu] = [];
    if (!map[parsed.gu].includes(parsed.dong)) {
      map[parsed.gu].push(parsed.dong);
    }
  }
  return map;
}

/**
 * 매물등록과 같이 구·동을 각각 모달로 고른다.
 * - 구 기본값: 강동구 (표시)
 * - 동: 「선택동」표시 → 누르면 모달 (다수 선택)
 */
export function PreferredLocationPicker({
  preferredGus,
  preferredDongs,
  onChange,
}: {
  preferredGus: string[];
  preferredDongs: string[];
  onChange: (next: {
    preferredGus: string[];
    preferredDongs: string[];
  }) => void;
}) {
  const [guOpen, setGuOpen] = useState(false);
  const [dongOpen, setDongOpen] = useState(false);
  const [activeGu, setActiveGu] = useState<string>(
    () => preferredGus[0] || DEFAULT_PREFERRED_GU
  );
  const [draftDongs, setDraftDongs] = useState<string[]>([]);

  const grouped = useMemo(
    () => groupDongsByGu(preferredDongs),
    [preferredDongs]
  );

  const displayGu =
    activeGu || preferredGus[0] || DEFAULT_PREFERRED_GU;
  const activeDongNames = grouped[displayGu] ?? [];
  const dongButtonLabel =
    activeDongNames.length > 0 ? activeDongNames.join(", ") : "선택동";
  const dongList = SEOUL_DONG_BY_GU[displayGu] ?? [];

  const pickGu = (gu: string) => {
    const nextGus = preferredGus.includes(gu)
      ? preferredGus
      : [...preferredGus, gu].sort();
    onChange({ preferredGus: nextGus, preferredDongs });
    setActiveGu(gu);
    setGuOpen(false);
  };

  const openDongModal = () => {
    const gu = displayGu;
    if (!preferredGus.includes(gu)) {
      onChange({
        preferredGus: [...preferredGus, gu].sort(),
        preferredDongs,
      });
    }
    setActiveGu(gu);
    const existing = (grouped[gu] ?? []).map((d) =>
      encodePreferredDong(gu, d)
    );
    setDraftDongs(existing);
    setDongOpen(true);
  };

  const toggleDong = (dong: string) => {
    const gu = activeGu || displayGu;
    const key = encodePreferredDong(gu, dong);
    setDraftDongs((prev) =>
      prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]
    );
  };

  const confirmDongs = () => {
    const gu = activeGu || displayGu;
    const others = preferredDongs.filter(
      (raw) => !raw.startsWith(`${gu}${SEP}`)
    );
    const nextDongs = [...others, ...draftDongs].sort();
    const nextGus = preferredGus.includes(gu)
      ? preferredGus
      : [...preferredGus, gu].sort();
    onChange({ preferredGus: nextGus, preferredDongs: nextDongs });
    setDongOpen(false);
  };

  const removeGu = (gu: string) => {
    const nextGus = preferredGus.filter((g) => g !== gu);
    const nextDongs = preferredDongs.filter(
      (raw) => !raw.startsWith(`${gu}${SEP}`)
    );
    if (nextGus.length === 0) {
      onChange(defaultPreferredLocation());
      setActiveGu(DEFAULT_PREFERRED_GU);
      return;
    }
    onChange({ preferredGus: nextGus, preferredDongs: nextDongs });
    if (activeGu === gu) setActiveGu(nextGus[0] || DEFAULT_PREFERRED_GU);
  };

  return (
    <div className="space-y-1.5">
      <p className="text-[13px] font-semibold text-gray-600">선호위치</p>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setGuOpen(true)}
          className="flex min-h-[48px] w-full items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-3 active:scale-[0.99] transition-all duration-150"
        >
          <span className="truncate text-[15px] font-semibold text-gray-900">
            {displayGu}
          </span>
          <span className="shrink-0 text-[12px] font-bold text-[#3182F6]">
            선택
          </span>
        </button>
        <button
          type="button"
          onClick={openDongModal}
          className="flex min-h-[48px] w-full items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-3 active:scale-[0.99] transition-all duration-150"
        >
          <span
            className={[
              "truncate text-[15px] font-semibold",
              activeDongNames.length > 0 ? "text-gray-900" : "text-gray-400",
            ].join(" ")}
          >
            {dongButtonLabel}
          </span>
          <span className="shrink-0 text-[12px] font-bold text-[#3182F6]">
            선택
          </span>
        </button>
      </div>
      <p className="text-[11px] text-gray-400">
        구는 기본 강동구입니다. 선택동을 눌러 동을 여러 개 고를 수 있습니다.
      </p>

      {preferredGus.length > 0 ? (
        <div className="space-y-1.5 rounded-xl bg-[#F7F8FA] px-2.5 py-2">
          {preferredGus.map((gu) => {
            const dongs = grouped[gu] ?? [];
            return (
              <div
                key={gu}
                className="flex items-center gap-2 rounded-lg bg-white px-2.5 py-2"
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left text-[13px] leading-snug text-gray-800"
                  onClick={() => {
                    setActiveGu(gu);
                    const existing = (grouped[gu] ?? []).map((d) =>
                      encodePreferredDong(gu, d)
                    );
                    setDraftDongs(existing);
                    setDongOpen(true);
                  }}
                >
                  <span className="font-bold">{gu}</span>
                  {dongs.length > 0 ? (
                    <span className="text-gray-600">
                      {" · "}
                      {dongs.join(", ")}
                    </span>
                  ) : (
                    <span className="text-gray-400"> · 선택동</span>
                  )}
                </button>
                <button
                  type="button"
                  className="shrink-0 text-[12px] font-bold text-red-500"
                  onClick={() => removeGu(gu)}
                >
                  삭제
                </button>
              </div>
            );
          })}
        </div>
      ) : null}

      <Modal
        open={guOpen}
        onClose={() => setGuOpen(false)}
        title="구 선택"
        description="한 번 고르면 바로 저장됩니다. 다른 구는 다시 선택하세요."
        dense
        footer={
          <Button fullWidth variant="secondary" onClick={() => setGuOpen(false)}>
            닫기
          </Button>
        }
      >
        <div className="grid max-h-[55vh] grid-cols-3 gap-1.5 overflow-y-auto pb-1">
          {SEOUL_GU_LIST.map((gu) => {
            const saved = preferredGus.includes(gu);
            const current = gu === displayGu;
            return (
              <button
                key={gu}
                type="button"
                onClick={() => pickGu(gu)}
                className={[
                  "min-h-[44px] rounded-xl text-[13px] font-bold transition-all active:scale-95",
                  current || saved
                    ? "bg-[#3182F6] text-white"
                    : "bg-gray-100 text-gray-700",
                ].join(" ")}
              >
                {gu}
              </button>
            );
          })}
        </div>
      </Modal>

      <Modal
        open={dongOpen}
        onClose={() => setDongOpen(false)}
        title={`${activeGu || displayGu} · 동 선택`}
        description="여러 동을 고른 뒤 선택완료를 눌러 주세요"
        dense
        footer={
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => setDongOpen(false)}>
              취소
            </Button>
            <Button onClick={confirmDongs}>선택완료</Button>
          </div>
        }
      >
        <div className="grid max-h-[55vh] grid-cols-3 gap-1.5 overflow-y-auto pb-1">
          {dongList.map((dong) => {
            const gu = activeGu || displayGu;
            const key = encodePreferredDong(gu, dong);
            const active = draftDongs.includes(key);
            return (
              <button
                key={dong}
                type="button"
                onClick={() => toggleDong(dong)}
                className={[
                  "min-h-[44px] rounded-xl text-[13px] font-bold transition-all active:scale-95",
                  active
                    ? "bg-[#3182F6] text-white"
                    : "bg-gray-100 text-gray-700",
                ].join(" ")}
              >
                {dong}
              </button>
            );
          })}
        </div>
      </Modal>
    </div>
  );
}
