"use client";

import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import {
  SEOUL_DONG_BY_GU,
  SEOUL_GU_LIST,
  composeJibunDetail,
  composeSeoulAddress,
  parseJibunDetail,
  parseSeoulAddress,
} from "@/lib/seoulRegions";
import { reselectHint, reselectHintClass } from "@/lib/choiceHint";
import {
  requiredStarClass,
  emptyRequiredClass,
  invalidHintClass,
  invalidLabelClass,
} from "@/lib/uiInvalid";

interface SeoulAddressFieldProps {
  value: string;
  onChange: (address: string) => void;
  onDongChange?: (dong: string) => void;
  required?: boolean;
  /** false면 동 필수 표시/검증 UI 제외. 기본 true */
  requireDong?: boolean;
  invalid?: boolean;
  /** 라벨 우측 경고 (동일 매물 등) */
  labelRight?: React.ReactNode;
}

export function SeoulAddressField({
  value,
  onChange,
  onDongChange,
  required,
  requireDong = true,
  invalid,
  labelRight,
}: SeoulAddressFieldProps) {
  const parsed = useMemo(() => parseSeoulAddress(value), [value]);
  const initialJibun = parseJibunDetail(parsed.detail);
  const [gu, setGu] = useState(parsed.gu);
  const [dong, setDong] = useState(parsed.dong);
  const [jibunMain, setJibunMain] = useState(initialJibun.main);
  const [jibunSub, setJibunSub] = useState(initialJibun.sub);
  const [guOpen, setGuOpen] = useState(false);
  const [dongOpen, setDongOpen] = useState(false);
  const [draftGu, setDraftGu] = useState("");

  useEffect(() => {
    const next = parseSeoulAddress(value);
    setGu(next.gu);
    setDong(next.dong || "");
    const jibun = parseJibunDetail(next.detail);
    setJibunMain(jibun.main);
    setJibunSub(jibun.sub);
  }, [value]);

  const hasSelection = requireDong ? Boolean(gu && dong) : Boolean(gu);
  const selectedLabel = dong ? `${gu} · ${dong}` : gu;
  const dongList = SEOUL_DONG_BY_GU[draftGu] ?? [];
  const addressInvalid = Boolean(invalid);

  const emitAddress = (
    nextGu: string,
    nextDong: string,
    nextMain: string,
    nextSub: string
  ) => {
    if (!nextGu) {
      onChange("");
      onDongChange?.("");
      return;
    }
    onChange(
      composeSeoulAddress(
        nextGu,
        nextDong,
        composeJibunDetail(nextMain, nextSub)
      )
    );
    onDongChange?.(nextDong);
  };

  const pickGu = (nextGu: string) => {
    setDraftGu(nextGu);
    setGuOpen(false);
    if (!requireDong) {
      setGu(nextGu);
      setDong("");
      emitAddress(nextGu, "", jibunMain, jibunSub);
      return;
    }
    setDongOpen(true);
  };

  const pickDong = (nextDong: string) => {
    const nextGu = draftGu;
    if (!nextGu) return;
    setGu(nextGu);
    setDong(nextDong);
    emitAddress(nextGu, nextDong, jibunMain, jibunSub);
    setDongOpen(false);
    setDraftGu("");
  };

  const closeDongModal = () => {
    setDongOpen(false);
    setDraftGu("");
    setGuOpen(true);
  };

  const openPicker = () => {
    setDraftGu(gu);
    setGuOpen(true);
  };

  return (
    <div
      className={
        addressInvalid
          ? emptyRequiredClass({ invalid: true })
          : "space-y-2"
      }
    >
      <div className="flex items-baseline justify-between gap-2">
        <p
          className={[
            "flex min-w-0 flex-wrap items-baseline gap-x-1.5 text-[13px] font-semibold",
            addressInvalid ? invalidLabelClass : "text-gray-600",
          ].join(" ")}
        >
          <span className="shrink-0">
            매물 주소
            {required && (
              <span className={requiredStarClass}>
                *
              </span>
            )}
          </span>
          <span className="text-[11px] font-bold text-red-500">
            도로명 주소 사용불가
          </span>
        </p>
        {!hasSelection && labelRight ? (
          <span className="shrink-0 text-[12px] font-bold text-red-500">
            {labelRight}
          </span>
        ) : null}
      </div>
      {addressInvalid && (
        <p className={`text-xs ${invalidHintClass}`}>미입력</p>
      )}
      {hasSelection ? (
        <p className={reselectHintClass}>
          {reselectHint("매물주소", selectedLabel)}
        </p>
      ) : null}

      {hasSelection ? (
        <button
          type="button"
          data-testid="property-address-chip"
          onClick={openPicker}
          className="flex min-h-[36px] w-full items-center justify-center rounded-xl bg-[#3182F6] px-4 text-[15px] font-bold text-white active:scale-95 transition-all duration-150"
        >
          {selectedLabel}
        </button>
      ) : (
        <button
          type="button"
          data-testid="property-address-select"
          onClick={openPicker}
          className="flex min-h-[36px] w-full items-center justify-center rounded-xl bg-gray-100 px-4 text-[15px] font-bold text-gray-700 active:scale-95 transition-all duration-150"
        >
          매물주소선택
        </button>
      )}

      <div className="space-y-1">
        <p className="text-[13px] font-semibold text-gray-600">
          나머지 주소 (지번)
        </p>
        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-1.5">
          <Input
            label="본번"
            required={required}
            invalid={false}
            inputMode="numeric"
            value={jibunMain}
            chipWhenFilled
            onChange={(e) => {
              const next = e.target.value.replace(/[^\d]/g, "");
              setJibunMain(next);
              if (hasSelection) emitAddress(gu, dong, next, jibunSub);
            }}
            placeholder="123"
          />
          <span className="flex h-[36px] items-center text-[18px] font-bold text-gray-400">
            -
          </span>
          <Input
            label="부번"
            inputMode="numeric"
            value={jibunSub}
            chipWhenFilled
            onChange={(e) => {
              const next = e.target.value.replace(/[^\d]/g, "");
              setJibunSub(next);
              if (hasSelection) emitAddress(gu, dong, jibunMain, next);
            }}
            placeholder="45"
          />
        </div>
      </div>

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
          {SEOUL_GU_LIST.map((item) => {
            const active = (draftGu || gu) === item;
            return (
              <button
                key={item}
                type="button"
                onClick={() => pickGu(item)}
                className={[
                  "min-h-[44px] rounded-xl text-[13px] font-bold transition-all active:scale-95",
                  active
                    ? "bg-[#3182F6] text-white"
                    : "bg-gray-100 text-gray-700",
                ].join(" ")}
              >
                {item}
              </button>
            );
          })}
        </div>
      </Modal>

      <Modal
        open={dongOpen}
        onClose={closeDongModal}
        title={`${draftGu} · 동 선택`}
        description="동을 누르면 바로 선택됩니다"
        position="center"
        dense
        footer={
          <Button fullWidth variant="secondary" onClick={closeDongModal}>
            취소
          </Button>
        }
      >
        <div className="grid max-h-[55vh] grid-cols-3 gap-1.5 overflow-y-auto pb-1">
          {dongList.map((item) => {
            const active = draftGu === gu && dong === item;
            return (
              <button
                key={item}
                type="button"
                onClick={() => pickDong(item)}
                className={[
                  "min-h-[44px] rounded-xl text-[13px] font-bold transition-all active:scale-95",
                  active
                    ? "bg-[#3182F6] text-white"
                    : "bg-gray-100 text-gray-700",
                ].join(" ")}
              >
                {item}
              </button>
            );
          })}
        </div>
      </Modal>
    </div>
  );
}
