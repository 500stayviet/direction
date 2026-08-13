"use client";

import { useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { SEOUL_DONG_BY_GU, SEOUL_GU_LIST } from "@/lib/seoulRegions";
import {
  PREFERRED_DONG_SEP as SEP,
  DEFAULT_PREFERRED_GU,
  completedPreferredGus,
  encodePreferredDong,
  groupDongsByGu,
} from "@/lib/preferredLocation";

/** 구·동 다중 선택. 구 박스 기본 표시만 강동구(저장 전). */
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
  /** 빈 문자열이면 박스에 「선택구」 */
  const [boxGu, setBoxGu] = useState<string>(() =>
    preferredDongs.length > 0 ? "" : DEFAULT_PREFERRED_GU
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

  const activeGu = boxGu || DEFAULT_PREFERRED_GU;
  const dongList = SEOUL_DONG_BY_GU[activeGu] ?? [];

  const pickGu = (gu: string) => {
    setBoxGu(gu);
    setGuOpen(false);
  };

  const openDongModal = () => {
    const gu = boxGu || DEFAULT_PREFERRED_GU;
    if (!boxGu) setBoxGu(gu);
    setDraftDongs(
      (grouped[gu] ?? []).map((d) => encodePreferredDong(gu, d))
    );
    setDongOpen(true);
  };

  const closeDongModal = () => {
    setDongOpen(false);
    if (resultGus.length > 0) setBoxGu("");
  };

  const toggleDong = (dong: string) => {
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
    if (draftDongs.length === 0) return;
    const gu = activeGu;
    const others = preferredDongs.filter(
      (raw) => !raw.startsWith(`${gu}${SEP}`)
    );
    const nextDongs = [...others, ...draftDongs].sort();
    const nextGus = preferredGus.includes(gu)
      ? preferredGus
      : [...preferredGus, gu].sort();
    onChange({ preferredGus: nextGus, preferredDongs: nextDongs });
    setDongOpen(false);
    setBoxGu("");
  };

  const removeGu = (gu: string) => {
    const nextDongs = preferredDongs.filter(
      (raw) => !raw.startsWith(`${gu}${SEP}`)
    );
    onChange({
      preferredGus: preferredGus.filter((g) => g !== gu),
      preferredDongs: nextDongs,
    });
    setBoxGu(nextDongs.length > 0 ? "" : DEFAULT_PREFERRED_GU);
  };

  const fieldBoxClass = (complete: boolean) =>
    [
      "flex min-h-[48px] w-full items-center justify-between rounded-xl border px-3.5",
      "active:scale-[0.99] transition-all duration-150",
      invalid
        ? "border-red-500 bg-red-50"
        : complete
          ? "border-[#3182F6]/55 bg-gray-50"
          : "border-gray-200 bg-gray-50",
    ].join(" ");

  const chevronClass = [
    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold",
    invalid ? "bg-red-100 text-red-600" : "bg-blue-50 text-[#3182F6]",
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
        <div className="space-y-1">
          <p
            className={[
              "text-[13px] font-semibold",
              invalid ? "text-red-600" : "text-gray-600",
            ].join(" ")}
          >
            구
            <span
              className={
                invalid ? "ml-0.5 text-red-500" : "ml-0.5 text-[#3182F6]"
              }
            >
              *
            </span>
          </p>
          <button
            type="button"
            onClick={() => setGuOpen(true)}
            className={fieldBoxClass(Boolean(boxGu))}
          >
            <span
              className={[
                "truncate text-[16px] font-semibold",
                boxGu ? "text-gray-900" : "text-gray-400",
              ].join(" ")}
            >
              {boxGu || "선택구"}
            </span>
            <span className={chevronClass}>▾</span>
          </button>
        </div>
        <div className="space-y-1">
          <p
            className={[
              "text-[13px] font-semibold",
              invalid ? "text-red-600" : "text-gray-600",
            ].join(" ")}
          >
            동
            <span
              className={
                invalid ? "ml-0.5 text-red-500" : "ml-0.5 text-[#3182F6]"
              }
            >
              *
            </span>
          </p>
          <button
            type="button"
            onClick={openDongModal}
            className={fieldBoxClass(false)}
          >
            <span className="truncate text-[16px] font-semibold text-gray-400">
              선택동
            </span>
            <span className={chevronClass}>▾</span>
          </button>
        </div>
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
            const current = Boolean(boxGu) && gu === boxGu;
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
        onClose={closeDongModal}
        title={`${activeGu} · 동 선택`}
        description="동을 고른 뒤 선택완료를 눌러 주세요"
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
