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

/** 신규 폼 저장값 초기 — 하단 결과에는 넣지 않음 (박스는 강동구만 표시) */
export function defaultPreferredLocation(): {
  preferredGus: string[];
  preferredDongs: string[];
} {
  return { preferredGus: [], preferredDongs: [] };
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

/** 구·동이 모두 선택된 항목만 하단 결과로 사용 */
export function completedPreferredGus(
  preferredGus: string[],
  preferredDongs: string[]
): string[] {
  const grouped = groupDongsByGu(preferredDongs);
  return preferredGus.filter((gu) => (grouped[gu]?.length ?? 0) > 0);
}

/**
 * - 구 박스 기본 표시만 강동구 (하단 결과 X)
 * - 하단 결과는 구+동 선택완료 후에만
 * - 동 모달 맨 아래 「전체」
 */
export function PreferredLocationPicker({
  preferredGus,
  preferredDongs,
  onChange,
  invalid,
}: {
  preferredGus: string[];
  preferredDongs: string[];
  onChange: (next: {
    preferredGus: string[];
    preferredDongs: string[];
  }) => void;
  invalid?: boolean;
}) {
  const [guOpen, setGuOpen] = useState(false);
  const [dongOpen, setDongOpen] = useState(false);
  /** 박스에만 보이는 구 (저장 전) */
  const [boxGu, setBoxGu] = useState<string>(
    () => preferredGus[0] || DEFAULT_PREFERRED_GU
  );
  const [draftDongs, setDraftDongs] = useState<string[]>([]);

  const grouped = useMemo(
    () => groupDongsByGu(preferredDongs),
    [preferredDongs]
  );
  const resultGus = useMemo(
    () => completedPreferredGus(preferredGus, preferredDongs),
    [preferredGus, preferredDongs]
  );

  const boxDongNames = grouped[boxGu] ?? [];
  const dongButtonLabel =
    boxDongNames.length > 0 ? boxDongNames.join(", ") : "선택동";
  const dongList = SEOUL_DONG_BY_GU[boxGu] ?? [];

  const pickGu = (gu: string) => {
    setBoxGu(gu);
    setGuOpen(false);
  };

  const openDongModal = () => {
    const existing = (grouped[boxGu] ?? []).map((d) =>
      encodePreferredDong(boxGu, d)
    );
    setDraftDongs(existing);
    setDongOpen(true);
  };

  const toggleDong = (dong: string) => {
    const key = encodePreferredDong(boxGu, dong);
    setDraftDongs((prev) =>
      prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]
    );
  };

  const toggleAllDongs = () => {
    const allKeys = dongList.map((d) => encodePreferredDong(boxGu, d));
    const allSelected =
      allKeys.length > 0 && allKeys.every((k) => draftDongs.includes(k));
    setDraftDongs(allSelected ? [] : allKeys);
  };

  const allDraftSelected =
    dongList.length > 0 &&
    dongList.every((d) =>
      draftDongs.includes(encodePreferredDong(boxGu, d))
    );

  const confirmDongs = () => {
    if (draftDongs.length === 0) {
      // 동 미선택이면 해당 구 결과는 넣지 않음 (기존 해당 구 결과도 제거)
      const nextDongs = preferredDongs.filter(
        (raw) => !raw.startsWith(`${boxGu}${SEP}`)
      );
      const nextGus = preferredGus.filter((g) => g !== boxGu);
      onChange({ preferredGus: nextGus, preferredDongs: nextDongs });
      setDongOpen(false);
      return;
    }
    const others = preferredDongs.filter(
      (raw) => !raw.startsWith(`${boxGu}${SEP}`)
    );
    const nextDongs = [...others, ...draftDongs].sort();
    const nextGus = preferredGus.includes(boxGu)
      ? preferredGus
      : [...preferredGus, boxGu].sort();
    onChange({ preferredGus: nextGus, preferredDongs: nextDongs });
    setDongOpen(false);
  };

  const removeGu = (gu: string) => {
    onChange({
      preferredGus: preferredGus.filter((g) => g !== gu),
      preferredDongs: preferredDongs.filter(
        (raw) => !raw.startsWith(`${gu}${SEP}`)
      ),
    });
    if (boxGu === gu) setBoxGu(DEFAULT_PREFERRED_GU);
  };

  const boxClass = [
    "flex min-h-[48px] w-full items-center justify-center rounded-xl border bg-gray-50 px-3 active:scale-[0.99] transition-all duration-150",
    invalid ? "border-red-500 bg-red-50" : "border-gray-200",
  ].join(" ");

  return (
    <div className="space-y-1.5">
      <p
        className={[
          "text-[13px] font-semibold",
          invalid ? "text-red-600" : "text-gray-600",
        ].join(" ")}
      >
        선호위치
        <span className={invalid ? "ml-0.5 text-red-500" : "ml-0.5 text-[#3182F6]"}>
          *
        </span>
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setGuOpen(true)} className={boxClass}>
          <span className="truncate text-[15px] font-semibold text-gray-900">
            {boxGu}
          </span>
        </button>
        <button type="button" onClick={openDongModal} className={boxClass}>
          <span
            className={[
              "truncate text-[15px] font-semibold",
              boxDongNames.length > 0 ? "text-gray-900" : "text-gray-400",
            ].join(" ")}
          >
            {dongButtonLabel}
          </span>
        </button>
      </div>
      {invalid ? (
        <p className="text-[11px] font-semibold text-red-500">
          구와 동을 모두 선택해 주세요.
        </p>
      ) : (
        <p className="text-[11px] text-gray-400">
          구·동을 모두 고른 뒤 선택완료하면 아래에 반영됩니다.
        </p>
      )}

      {resultGus.length > 0 ? (
        <div className="space-y-1.5 rounded-xl bg-[#F7F8FA] px-2.5 py-2">
          {resultGus.map((gu) => {
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
                    setBoxGu(gu);
                    setDraftDongs(
                      dongs.map((d) => encodePreferredDong(gu, d))
                    );
                    setDongOpen(true);
                  }}
                >
                  <span className="font-bold">{gu}</span>
                  <span className="text-gray-600">
                    {" · "}
                    {dongs.join(", ")}
                  </span>
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
        description="구를 고른 뒤 동도 선택해야 결과에 반영됩니다."
        dense
        footer={
          <Button fullWidth variant="secondary" onClick={() => setGuOpen(false)}>
            닫기
          </Button>
        }
      >
        <div className="grid max-h-[55vh] grid-cols-3 gap-1.5 overflow-y-auto pb-1">
          {SEOUL_GU_LIST.map((gu) => {
            const inResult = resultGus.includes(gu);
            const current = gu === boxGu;
            return (
              <button
                key={gu}
                type="button"
                onClick={() => pickGu(gu)}
                className={[
                  "min-h-[44px] rounded-xl text-[13px] font-bold transition-all active:scale-95",
                  current || inResult
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
        title={`${boxGu} · 동 선택`}
        description="동을 고른 뒤 선택완료를 눌러 주세요"
        dense
        footer={
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => setDongOpen(false)}>
              취소
            </Button>
            <Button onClick={confirmDongs} disabled={draftDongs.length === 0}>
              선택완료
            </Button>
          </div>
        }
      >
        <div className="grid max-h-[55vh] grid-cols-3 gap-1.5 overflow-y-auto pb-1">
          {dongList.map((dong) => {
            const key = encodePreferredDong(boxGu, dong);
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
          <button
            type="button"
            onClick={toggleAllDongs}
            className={[
              "col-span-3 min-h-[44px] rounded-xl text-[14px] font-extrabold transition-all active:scale-95",
              allDraftSelected
                ? "bg-[#3182F6] text-white"
                : "bg-gray-800 text-white",
            ].join(" ")}
          >
            전체
          </button>
        </div>
      </Modal>
    </div>
  );
}
