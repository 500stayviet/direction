"use client";

import { useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { SEOUL_DONG_BY_GU, SEOUL_GU_LIST } from "@/lib/seoulRegions";
import {
  PREFERRED_DONG_SEP as SEP,
  completedPreferredGus,
  encodedDongsForGu,
  encodePreferredDong,
  groupDongsByGu,
} from "@/lib/preferredLocation";
import {
  emptyRequiredClass,
  invalidHintClass,
  invalidLabelClass,
  requiredStarClass,
} from "@/lib/uiInvalid";
import { addPreferredHint, reselectHintClass } from "@/lib/choiceHint";

/** 구·동 다중 선택. 고르기 전에는 빈 칸을 두지 않음. */
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
  const [boxGu, setBoxGu] = useState("");
  const [draftDongs, setDraftDongs] = useState<string[]>([]);
  const [editingGu, setEditingGu] = useState("");

  const grouped = useMemo(
    () => groupDongsByGu(preferredDongs),
    [preferredDongs]
  );
  const resultGus = useMemo(
    () => completedPreferredGus(preferredGus, preferredDongs),
    [preferredGus, preferredDongs]
  );

  const activeGu = boxGu;
  const dongList = SEOUL_DONG_BY_GU[activeGu] ?? [];
  const hasSelection = resultGus.length > 0;
  const savedDongs = grouped[activeGu] ?? [];

  const openPicker = () => {
    setEditingGu("");
    setGuOpen(true);
  };

  const pickGu = (gu: string) => {
    setBoxGu(gu);
    setDraftDongs(
      editingGu === gu ? encodedDongsForGu(gu, grouped[gu] ?? []) : []
    );
    setGuOpen(false);
    setDongOpen(true);
  };

  const closeDongModal = () => {
    setDongOpen(false);
    setBoxGu("");
    if (editingGu) {
      setEditingGu("");
      return;
    }
    setGuOpen(true);
  };

  const toggleDong = (dong: string) => {
    if (editingGu !== activeGu && savedDongs.includes(dong)) return;
    const key = encodePreferredDong(activeGu, dong);
    setDraftDongs((prev) =>
      prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]
    );
  };

  const toggleAllDongs = () => {
    const allKeys = dongList.map((d) => encodePreferredDong(activeGu, d));
    const allSelected =
      allKeys.length > 0 && allKeys.every((k) => draftDongs.includes(k));
    setDraftDongs(allSelected ? [] : allKeys);
  };

  const allDraftSelected =
    dongList.length > 0 &&
    dongList.every((d) =>
      draftDongs.includes(encodePreferredDong(activeGu, d))
    );

  const confirmDongs = () => {
    const gu = activeGu;
    if (!gu) return;
    const others = preferredDongs.filter(
      (raw) => !raw.startsWith(`${gu}${SEP}`)
    );
    const merged =
      editingGu === gu
        ? draftDongs
        : [
            ...new Set([
              ...encodedDongsForGu(gu, savedDongs),
              ...draftDongs,
            ]),
          ];
    if (merged.length === 0) return;
    const nextDongs = [...others, ...merged].sort();
    const nextGus = preferredGus.includes(gu)
      ? preferredGus
      : [...preferredGus, gu].sort();
    onChange({ preferredGus: nextGus, preferredDongs: nextDongs });
    setDongOpen(false);
    setBoxGu("");
    setEditingGu("");
  };

  const removeGu = (gu: string) => {
    const nextDongs = preferredDongs.filter(
      (raw) => !raw.startsWith(`${gu}${SEP}`)
    );
    onChange({
      preferredGus: preferredGus.filter((g) => g !== gu),
      preferredDongs: nextDongs,
    });
  };

  const labelClass = [
    "text-[13px] font-semibold",
    invalid ? invalidLabelClass : "text-gray-600",
  ].join(" ");
  const star = (
    <span className={requiredStarClass}>
      *
    </span>
  );

  return (
    <div
      className={
        invalid ? emptyRequiredClass({ invalid: true }) : "space-y-1.5"
      }
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className={`shrink-0 ${labelClass}`}>
          선호지역
          {star}
        </p>
        {hasSelection ? (
          <p className={reselectHintClass}>
            {addPreferredHint}
          </p>
        ) : null}
      </div>
      {invalid ? (
        <p className={`text-xs ${invalidHintClass}`}>미입력</p>
      ) : null}

      {hasSelection
        ? resultGus.map((gu) => {
            const dongs = grouped[gu] ?? [];
            return (
              <div
                key={gu}
                className="flex min-h-[36px] w-full items-center gap-2 rounded-xl bg-[#3182F6] px-4 text-[15px] font-bold text-white"
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 truncate text-left"
                  onClick={() => {
                    setEditingGu(gu);
                    setBoxGu(gu);
                    setDraftDongs(encodedDongsForGu(gu, dongs));
                    setDongOpen(true);
                  }}
                >
                  {gu}
                  {dongs.length > 0 ? ` · ${dongs.join(", ")}` : ""}
                </button>
                <button
                  type="button"
                  className="shrink-0 text-[11px] font-normal text-red-400"
                  onClick={() => removeGu(gu)}
                >
                  삭제
                </button>
              </div>
            );
          })
        : null}

      <button
        type="button"
        data-testid={
          hasSelection ? "preferred-region-add" : "preferred-region-label"
        }
        onClick={openPicker}
        className={[
          "flex min-h-[36px] w-full items-center justify-center rounded-xl px-4 text-[15px] font-bold",
          "bg-gray-100 text-gray-700",
          "active:scale-95 transition-all duration-150",
        ].join(" ")}
      >
        {hasSelection ? "+ 선호지역 (구) 추가" : "선호지역선택"}
      </button>

      <Modal
        open={guOpen}
        onClose={() => setGuOpen(false)}
        title="구 선택"
        description="구를 고른 뒤 동을 선택합니다."
        position="center"
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
            return (
              <button
                key={gu}
                type="button"
                onClick={() => pickGu(gu)}
                className={[
                  "min-h-[44px] rounded-xl text-[13px] font-bold transition-all active:scale-95",
                  inResult
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
        onClose={closeDongModal}
        title={`${activeGu} · 동 선택`}
        description="원하는 동을 모두 고른 뒤, 아래 선택완료를 눌러 주세요"
        position="center"
        dense
        footer={
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={closeDongModal}>
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
            const key = encodePreferredDong(activeGu, dong);
            const kept =
              editingGu !== activeGu && savedDongs.includes(dong);
            const active = draftDongs.includes(key) || kept;
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
              "min-h-[44px] rounded-xl text-[13px] font-bold transition-all active:scale-95",
              allDraftSelected
                ? "bg-[#3182F6] text-white"
                : "bg-gray-100 text-gray-700",
            ].join(" ")}
          >
            전체
          </button>
        </div>
      </Modal>
    </div>
  );
}
