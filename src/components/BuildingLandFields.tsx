"use client";

import { Input } from "@/components/ui/Input";
import { OptionToggle } from "@/components/OptionToggle";
import {
  BUILDING_KINDS,
  EMPTY_BATHROOM_COUNTS,
  EMPTY_UNIT_COUNTS,
  RESIDENTIAL_UNIT_KEYS,
} from "@/lib/constants";
import type {
  BuildingBathroomCounts,
  BuildingKind,
  BuildingRoomAreas,
  BuildingTypeRent,
  BuildingTypeRents,
  BuildingUnitCounts,
  BuildingUnitKey,
  Property,
  RentInputMode,
  ResidentialUnitKey,
} from "@/lib/types";

function CountStepper({
  label,
  value,
  onChange,
  min = 0,
  max = 99,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className="rounded-xl bg-gray-50 px-2 py-2">
      <p className="text-center text-[12px] font-semibold text-gray-600">
        {label}
      </p>
      <div className="mt-1.5 flex items-center gap-1">
        <button
          type="button"
          aria-label={`${label} 감소`}
          onClick={() => onChange(Math.max(min, (value || 0) - 1))}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-lg font-bold text-gray-600 ring-1 ring-gray-200 active:scale-95"
        >
          −
        </button>
        <span className="min-w-0 flex-1 text-center text-[16px] font-extrabold tabular-nums text-gray-900">
          {value || 0}
        </span>
        <button
          type="button"
          aria-label={`${label} 증가`}
          onClick={() => onChange(Math.min(max, (value || 0) + 1))}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-lg font-bold text-[#3182F6] ring-1 ring-gray-200 active:scale-95"
        >
          +
        </button>
      </div>
    </div>
  );
}

function sumTypeRents(rents: BuildingTypeRents | undefined): {
  deposit: number;
  monthlyRent: number;
} {
  let deposit = 0;
  let monthlyRent = 0;
  if (!rents) return { deposit, monthlyRent };
  for (const key of Object.keys(rents) as BuildingUnitKey[]) {
    const row = rents[key];
    if (!row) continue;
    deposit += Number(row.deposit) || 0;
    monthlyRent += Number(row.monthlyRent) || 0;
  }
  return { deposit, monthlyRent };
}

interface BuildingLandFieldsProps {
  property: Property;
  onChange: (patch: Partial<Property>) => void;
  invalidBuildingKind?: boolean;
}

/** 토지 · 건물 전용 입력 (기존 카드/토글 톤 유지) */
export function BuildingLandFields({
  property,
  onChange,
  invalidBuildingKind,
}: BuildingLandFieldsProps) {
  const roomType = property.roomType;
  const unitCounts: BuildingUnitCounts = {
    ...EMPTY_UNIT_COUNTS,
    ...property.unitCounts,
  };
  const bathroomCounts: BuildingBathroomCounts = {
    ...EMPTY_BATHROOM_COUNTS,
    ...property.bathroomCounts,
  };
  const roomAreas: BuildingRoomAreas = { ...property.roomAreas };
  const commercialAreas = [...(property.commercialAreas ?? [])];
  const rentMode: RentInputMode = property.rentInputMode ?? "합계";
  const typeRents: BuildingTypeRents = { ...property.typeRents };

  const setUnitCount = (key: BuildingUnitKey, n: number) => {
    const next = { ...unitCounts, [key]: n };
    const patch: Partial<Property> = { unitCounts: next };
    if (key === "상가") {
      const areas = [...commercialAreas];
      while (areas.length < n) areas.push(0);
      patch.commercialAreas = areas.slice(0, n);
    }
    onChange(patch);
  };

  const setBathroom = (key: ResidentialUnitKey, n: number) => {
    onChange({ bathroomCounts: { ...bathroomCounts, [key]: n } });
  };

  const setRoomArea = (key: ResidentialUnitKey, raw: string) => {
    const next = { ...roomAreas };
    if (raw === "") delete next[key];
    else next[key] = Number(raw) || 0;
    onChange({ roomAreas: next });
  };

  const setCommercialArea = (index: number, raw: string) => {
    const areas = [...commercialAreas];
    while (areas.length <= index) areas.push(0);
    areas[index] = raw === "" ? 0 : Number(raw) || 0;
    onChange({ commercialAreas: areas });
  };

  const setTypeRent = (
    key: BuildingUnitKey,
    field: keyof BuildingTypeRent,
    raw: string
  ) => {
    const prev = typeRents[key] ?? { deposit: 0, monthlyRent: 0 };
    const nextRents: BuildingTypeRents = {
      ...typeRents,
      [key]: {
        ...prev,
        [field]: raw === "" ? 0 : Number(raw) || 0,
      },
    };
    const totals = sumTypeRents(nextRents);
    onChange({
      typeRents: nextRents,
      deposit: totals.deposit,
      monthlyRent: totals.monthlyRent,
    });
  };

  const setRentMode = (mode: RentInputMode) => {
    if (mode === "상세") {
      const totals = sumTypeRents(typeRents);
      onChange({
        rentInputMode: mode,
        deposit: totals.deposit || property.deposit,
        monthlyRent: totals.monthlyRent || property.monthlyRent,
      });
      return;
    }
    onChange({ rentInputMode: mode });
  };

  if (roomType === "토지") {
    return (
      <div className="space-y-2 border-t border-gray-100 pt-3">
        <p className="text-sm font-bold text-gray-800">토지 정보</p>
        <div className="grid grid-cols-2 gap-2">
          <Input
            label="대지면적 (㎡)"
            type="number"
            inputMode="decimal"
            value={property.landArea ?? ""}
            onChange={(e) =>
              onChange({
                landArea:
                  e.target.value === "" ? undefined : Number(e.target.value) || 0,
              })
            }
            placeholder="150"
            hint="평 ≈ ÷3.3"
          />
          <Input
            label="용도"
            value={property.landUse ?? ""}
            onChange={(e) => onChange({ landUse: e.target.value })}
            placeholder="주거용 / 상업용 등"
          />
        </div>
        <p className="rounded-xl bg-gray-50 px-3 py-2 text-[12px] font-medium leading-snug text-gray-500">
          건폐율·용적률·현황·향은 아래 추가내용에 적어 주세요.
        </p>
      </div>
    );
  }

  if (roomType !== "건물") return null;

  const activeResidential = RESIDENTIAL_UNIT_KEYS.filter(
    (k) => (unitCounts[k] || 0) > 0
  );
  const shopCount = unitCounts.상가 || 0;

  return (
    <div className="space-y-3 border-t border-gray-100 pt-3">
      <p className="text-sm font-bold text-gray-800">건물 정보</p>

      <OptionToggle
        label="건물 종류"
        required
        invalid={invalidBuildingKind}
        value={(property.buildingKind ?? ("—" as BuildingKind))}
        options={BUILDING_KINDS}
        columns={3}
        onChange={(buildingKind) =>
          onChange({ buildingKind: buildingKind as BuildingKind })
        }
      />

      <div className="grid grid-cols-2 gap-2">
        <Input
          label="지하 층"
          type="number"
          inputMode="numeric"
          value={property.floorsBasement ?? ""}
          onChange={(e) =>
            onChange({
              floorsBasement:
                e.target.value === "" ? undefined : Number(e.target.value) || 0,
            })
          }
          placeholder="1"
        />
        <Input
          label="지상 층"
          type="number"
          inputMode="numeric"
          value={property.floorsAbove ?? ""}
          onChange={(e) =>
            onChange({
              floorsAbove:
                e.target.value === "" ? undefined : Number(e.target.value) || 0,
            })
          }
          placeholder="4"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Input
          label="토지면적 (㎡)"
          type="number"
          inputMode="decimal"
          value={property.landArea ?? ""}
          onChange={(e) =>
            onChange({
              landArea:
                e.target.value === "" ? undefined : Number(e.target.value) || 0,
            })
          }
          placeholder="200"
        />
        <Input
          label="건축면적 (㎡)"
          type="number"
          inputMode="decimal"
          value={property.buildingArea ?? ""}
          onChange={(e) =>
            onChange({
              buildingArea:
                e.target.value === "" ? undefined : Number(e.target.value) || 0,
            })
          }
          placeholder="120"
        />
      </div>

      <div className="space-y-1.5">
        <p className="text-[13px] font-semibold text-gray-600">
          방 · 상가 호수
        </p>
        <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
          {RESIDENTIAL_UNIT_KEYS.map((key) => (
            <CountStepper
              key={key}
              label={key}
              value={unitCounts[key] || 0}
              onChange={(n) => setUnitCount(key, n)}
            />
          ))}
          <CountStepper
            label="상가"
            value={shopCount}
            onChange={(n) => setUnitCount("상가", n)}
          />
        </div>
      </div>

      {activeResidential.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[13px] font-semibold text-gray-600">
            화장실 개수 (호실당)
          </p>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {activeResidential.map((key) => (
              <CountStepper
                key={key}
                label={key}
                value={bathroomCounts[key] ?? 1}
                min={0}
                max={5}
                onChange={(n) => setBathroom(key, n)}
              />
            ))}
          </div>
        </div>
      )}

      {(activeResidential.length > 0 || shopCount > 0) && (
        <div className="space-y-2">
          <p className="text-[13px] font-semibold text-gray-600">
            실사용면적 (㎡)
          </p>
          {activeResidential.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {activeResidential.map((key) => (
                <Input
                  key={key}
                  label={`${key} 실사용`}
                  type="number"
                  inputMode="decimal"
                  value={roomAreas[key] ?? ""}
                  onChange={(e) => setRoomArea(key, e.target.value)}
                  placeholder="28"
                />
              ))}
            </div>
          )}
          {shopCount > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {Array.from({ length: shopCount }, (_, i) => (
                <Input
                  key={`shop-area-${i}`}
                  label={`상가 ${i + 1} 실사용`}
                  type="number"
                  inputMode="decimal"
                  value={commercialAreas[i] || ""}
                  onChange={(e) => setCommercialArea(i, e.target.value)}
                  placeholder="33"
                />
              ))}
            </div>
          )}
        </div>
      )}

      <OptionToggle
        label="임대료 입력"
        value={rentMode}
        options={["합계", "상세"] as const}
        columns={2}
        onChange={setRentMode}
      />
      {rentMode === "상세" && (
        <div className="space-y-2">
          <p className="text-[12px] font-medium text-gray-400">
            유형별 보증·월세(만원) · 합계는 자동 반영
          </p>
          {([...RESIDENTIAL_UNIT_KEYS, "상가"] as BuildingUnitKey[])
            .filter((k) => (unitCounts[k] || 0) > 0)
            .map((key) => (
              <div key={key} className="grid grid-cols-2 gap-2">
                <Input
                  label={`${key} 보증 합`}
                  type="number"
                  inputMode="numeric"
                  value={typeRents[key]?.deposit || ""}
                  onChange={(e) => setTypeRent(key, "deposit", e.target.value)}
                  placeholder="0"
                />
                <Input
                  label={`${key} 월세 합`}
                  type="number"
                  inputMode="numeric"
                  value={typeRents[key]?.monthlyRent || ""}
                  onChange={(e) =>
                    setTypeRent(key, "monthlyRent", e.target.value)
                  }
                  placeholder="0"
                />
              </div>
            ))}
        </div>
      )}

      <Input
        label="주차 대수"
        type="number"
        inputMode="numeric"
        value={property.parkingSpaces ?? ""}
        onChange={(e) => {
          const n =
            e.target.value === "" ? undefined : Number(e.target.value) || 0;
          onChange({
            parkingSpaces: n,
            parkingType: n && n > 0 ? "유" : "무",
          });
        }}
        placeholder="2"
      />

      <p className="rounded-xl bg-gray-50 px-3 py-2 text-[12px] font-medium leading-snug text-gray-500">
        건폐율·용적률·현황·향은 아래 추가내용에 적어 주세요.
      </p>
    </div>
  );
}

/** 단일 유형(원룸·상가 등) 실사용면적 */
export function UsableAreaField({
  property,
  onChange,
}: {
  property: Property;
  onChange: (patch: Partial<Property>) => void;
}) {
  return (
    <Input
      label="실사용면적 (㎡)"
      type="number"
      inputMode="decimal"
      value={property.usableArea ?? ""}
      onChange={(e) =>
        onChange({
          usableArea:
            e.target.value === "" ? undefined : Number(e.target.value) || 0,
        })
      }
      placeholder="28"
      hint="평 ≈ ÷3.3"
    />
  );
}
