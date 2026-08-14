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
import {
  filledBoxClass,
  filledBoxTextClass,
} from "@/lib/uiInvalid";

function fieldBoxClass(complete: boolean, fieldInvalid = false) {
  return [
    "flex min-h-[38px] w-full items-center justify-between rounded-xl border px-3.5",
    "active:scale-[0.99] transition-all duration-150",
    fieldInvalid
      ? "border-red-500 bg-red-50"
      : complete
        ? filledBoxClass
        : "border-gray-200 bg-gray-50",
  ].join(" ");
}

function chevronClass(fieldInvalid: boolean) {
  return [
    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold",
    fieldInvalid ? "bg-red-100 text-red-600" : "bg-blue-50 text-[#3182F6]",
  ].join(" ");
}

/** 구·동 다중 선택. 강동구는 동 목록 기본값일 뿐, 고르기 전에는 칸에 넣지 않음. */
export function PreferredLocationPicker({
  preferredGus,
  preferredDongs,
  onChange,
  invalid,
  accent,
}: {
  preferredGus: string[];
  preferredDongs: string[];
  onChange: (next: {
    preferredGus: string[];
    preferredDongs: string[];
  }) => void;
  invalid?: boolean;
  /** 메시지·대화·사진으로 반영된 뒤에만 파란 박스 */
  accent?: boolean;
}) {
  const [guOpen, setGuOpen] = useState(false);
  const [dongOpen, setDongOpen] = useState(false);
  /** 빈 문자열이면 박스에 「선택구」. 기본 강동구는 표시만, 고른 값은 아님 */
  const [boxGu, setBoxGu] = useState<string>(() =>
    preferredDongs.length > 0 ? "" : DEFAULT_PREFERRED_GU
  );
  const [guPicked, setGuPicked] = useState(false);
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
  const shownGu = boxGu || resultGus[0] || "";
  const shownDongs = shownGu ? grouped[shownGu] ?? [] : [];
  const guSelected = guPicked || resultGus.length > 0;
  const displayGu = guSelected ? shownGu : "";
  const guMissing = Boolean(invalid && !guSelected);
  const dongMissing = Boolean(invalid && shownDongs.length === 0);
  const guFilled = Boolean(accent && resultGus.length > 0);
  const dongFilled = Boolean(accent && shownDongs.length > 0);

  const pickGu = (gu: string) => {
    setBoxGu(gu);
    setGuPicked(true);
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
    if (nextDongs.length === 0) setGuPicked(false);
  };

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
              guMissing ? "text-red-600" : "text-gray-600",
            ].join(" ")}
          >
            구
            <span
              className={
                guMissing ? "ml-0.5 text-red-500" : "ml-0.5 text-[#3182F6]"
              }
            >
              *
            </span>
          </p>
          <button
            type="button"
            onClick={() => setGuOpen(true)}
            className={fieldBoxClass(guFilled, guMissing)}
          >
            <span
              className={[
                "truncate text-[16px] font-semibold",
                guFilled
                  ? filledBoxTextClass
                  : displayGu
                    ? "text-gray-900"
                    : "text-gray-400",
              ].join(" ")}
            >
              {displayGu || "선택구"}
            </span>
            <span className={chevronClass(guMissing)}>▾</span>
          </button>
        </div>
        <div className="space-y-1">
          <p
            className={[
              "text-[13px] font-semibold",
              dongMissing ? "text-red-600" : "text-gray-600",
            ].join(" ")}
          >
            동
            <span
              className={
                dongMissing ? "ml-0.5 text-red-500" : "ml-0.5 text-[#3182F6]"
              }
            >
              *
            </span>
          </p>
          <button
            type="button"
            onClick={openDongModal}
            className={fieldBoxClass(dongFilled, dongMissing)}
          >
            <span
              className={[
                "truncate text-[16px] font-semibold",
                dongFilled
                  ? filledBoxTextClass
                  : shownDongs.length > 0
                    ? "text-gray-900"
                    : "text-gray-400",
              ].join(" ")}
            >
              {shownDongs.length > 0 ? shownDongs.join(", ") : "선택동"}
            </span>
            <span className={chevronClass(dongMissing)}>▾</span>
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
            const current = guPicked && gu === boxGu;
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
        description="원하는 동을 모두 고른 뒤, 아래 선택완료를 눌러 주세요"
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
