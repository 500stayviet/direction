"use client";

import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/Input";
import { OptionPicker } from "@/components/OptionPicker";
import {
  SEOUL_DONG_BY_GU,
  SEOUL_GU_LIST,
  composeJibunDetail,
  composeSeoulAddress,
  parseJibunDetail,
  parseSeoulAddress,
} from "@/lib/seoulRegions";

interface SeoulAddressFieldProps {
  value: string;
  onChange: (address: string) => void;
  onDongChange?: (dong: string) => void;
  required?: boolean;
  /** false면 동 필수 표시/검증 UI 제외. 기본 true */
  requireDong?: boolean;
  invalid?: boolean;
}

const DEFAULT_GU = "강동구";
const DEFAULT_DONG = "성내동";

function defaultDongForGu(nextGu: string): string {
  return nextGu === DEFAULT_GU ? DEFAULT_DONG : "";
}

export function SeoulAddressField({
  value,
  onChange,
  onDongChange,
  required,
  requireDong = true,
  invalid,
}: SeoulAddressFieldProps) {
  const parsed = useMemo(() => parseSeoulAddress(value), [value]);
  const initialGu = parsed.gu || DEFAULT_GU;
  const initialJibun = parseJibunDetail(parsed.detail);
  const [gu, setGu] = useState(initialGu);
  const [dong, setDong] = useState(
    parsed.dong || defaultDongForGu(initialGu)
  );
  const [jibunMain, setJibunMain] = useState(initialJibun.main);
  const [jibunSub, setJibunSub] = useState(initialJibun.sub);

  // 외부 value가 바뀌면(매물 불러오기 등) 구·동·상세 동기화
  useEffect(() => {
    const next = parseSeoulAddress(value);
    if (next.gu) {
      setGu(next.gu);
      setDong(next.dong || defaultDongForGu(next.gu));
      const jibun = parseJibunDetail(next.detail);
      setJibunMain(jibun.main);
      setJibunSub(jibun.sub);
      return;
    }
    if (!value) {
      const nextGu = DEFAULT_GU;
      const nextDong = DEFAULT_DONG;
      setGu(nextGu);
      setDong(nextDong);
      setJibunMain("");
      setJibunSub("");
      onChange(composeSeoulAddress(nextGu, nextDong, ""));
      onDongChange?.(nextDong);
    } else {
      const jibun = parseJibunDetail(next.detail);
      setJibunMain(jibun.main);
      setJibunSub(jibun.sub);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const dongs = gu ? SEOUL_DONG_BY_GU[gu] ?? [] : [];

  const emitSelectAddress = (
    nextGu: string,
    nextDong: string,
    nextMain: string,
    nextSub: string
  ) => {
    if (!nextGu) {
      onChange("");
      return;
    }
    onChange(
      composeSeoulAddress(
        nextGu,
        nextDong,
        composeJibunDetail(nextMain, nextSub)
      )
    );
  };

  const guInvalid = Boolean(invalid && !gu);
  const dongInvalid = Boolean(invalid && requireDong && !dong);
  const mainInvalid = Boolean(invalid && !jibunMain.trim());
  const addressInvalid = Boolean(invalid);

  return (
    <div className="space-y-2">
      <p
        className={[
          "flex flex-wrap items-baseline gap-x-1.5 text-[13px] font-semibold",
          addressInvalid ? "text-red-600" : "text-gray-600",
        ].join(" ")}
      >
        <span>
          매물 주소
          {required && (
            <span
              className={
                addressInvalid ? "ml-0.5 text-red-500" : "ml-0.5 text-[#3182F6]"
              }
            >
              *
            </span>
          )}
        </span>
        <span className="text-[11px] font-bold text-red-500">
          도로명 주소 사용불가
        </span>
      </p>
      {addressInvalid && (
        <p className="text-xs font-semibold text-red-500">
          {requireDong
            ? "미입력 · 구·동·지번 본번을 입력해 주세요"
            : "미입력 · 구·지번 본번을 입력해 주세요"}
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <OptionPicker
          label="구"
          required={required}
          invalid={guInvalid || addressInvalid}
          value={gu}
          options={SEOUL_GU_LIST}
          placeholder="구 선택"
          title="구 선택"
          description="서울시 자치구"
          onChange={(nextGu) => {
            const nextDong = defaultDongForGu(nextGu);
            setGu(nextGu);
            setDong(nextDong);
            if (nextDong) onDongChange?.(nextDong);
            emitSelectAddress(nextGu, nextDong, jibunMain, jibunSub);
          }}
        />
        <OptionPicker
          label="동"
          required={required && requireDong}
          invalid={dongInvalid}
          value={dong}
          options={dongs}
          disabled={!gu}
          placeholder={gu ? "동 선택" : "구 먼저 선택"}
          title="동 선택"
          description={gu ? `${gu} 법정동` : "구를 먼저 선택해 주세요"}
          onChange={(nextDong) => {
            setDong(nextDong);
            onDongChange?.(nextDong);
            emitSelectAddress(gu, nextDong, jibunMain, jibunSub);
          }}
        />
      </div>
      <div className="space-y-1">
        <p className="text-[13px] font-semibold text-gray-600">
          나머지 주소 (지번)
        </p>
        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-1.5">
          <Input
            label="본번"
            required={required}
            invalid={mainInvalid}
            inputMode="numeric"
            value={jibunMain}
            onChange={(e) => {
              const next = e.target.value.replace(/[^\d]/g, "");
              setJibunMain(next);
              emitSelectAddress(gu, dong, next, jibunSub);
            }}
            placeholder="123"
          />
          <span className="mb-3 text-[18px] font-bold text-gray-400">-</span>
          <Input
            label="부번"
            inputMode="numeric"
            value={jibunSub}
            onChange={(e) => {
              const next = e.target.value.replace(/[^\d]/g, "");
              setJibunSub(next);
              emitSelectAddress(gu, dong, jibunMain, next);
            }}
            placeholder="45"
          />
        </div>
      </div>
    </div>
  );
}
