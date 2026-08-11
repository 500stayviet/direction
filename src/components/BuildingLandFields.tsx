"use client";

import { Input } from "@/components/ui/Input";
import { OptionToggle } from "@/components/OptionToggle";
import {
  BUILDING_KINDS,
  EMPTY_UNIT_COUNTS,
  normalizeBuildingKind,
  normalizeUnitCounts,
  RESIDENTIAL_UNIT_KEYS,
} from "@/lib/constants";
import type {
  BuildingKind,
  BuildingUnitCounts,
  BuildingUnitKey,
  Property,
} from "@/lib/types";

function parseCount(raw: string): number {
  if (raw === "") return 0;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
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
  const unitCounts: BuildingUnitCounts = normalizeUnitCounts({
    ...EMPTY_UNIT_COUNTS,
    ...property.unitCounts,
  });

  const setUnitCount = (key: BuildingUnitKey, n: number) => {
    onChange({ unitCounts: { ...unitCounts, [key]: n } });
  };

  if (roomType === "토지") {
    return (
      <div className="space-y-1.5">
        <p className="text-sm font-bold text-gray-800">토지 정보</p>
        <div className="grid grid-cols-2 gap-2">
          <Input
            label="대지면적 (평)"
            type="number"
            inputMode="decimal"
            value={property.landArea ?? ""}
            onChange={(e) =>
              onChange({
                landArea:
                  e.target.value === "" ? undefined : Number(e.target.value) || 0,
              })
            }
            placeholder="45"
          />
          <Input
            label="용도"
            value={property.landUse ?? ""}
            onChange={(e) => onChange({ landUse: e.target.value })}
            placeholder="제2종일반주거, 일반상업, 준공업 등"
          />
        </div>
      </div>
    );
  }

  if (roomType !== "건물") return null;

  return (
    <div className="space-y-1.5">
      <p className="text-sm font-bold text-gray-800">건물 정보</p>

      <OptionToggle
        label="건물 종류"
        required
        invalid={invalidBuildingKind}
        value={
          (normalizeBuildingKind(property.buildingKind) ??
            ("—" as BuildingKind))
        }
        options={BUILDING_KINDS}
        fit
        onChange={(buildingKind) =>
          onChange({ buildingKind: buildingKind as BuildingKind })
        }
      />

      <div className="grid grid-cols-2 gap-2">
        <label className="block space-y-1">
          <span className="text-[13px] font-semibold text-gray-600">
            지하 층수
          </span>
          <div className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1/2 z-[1] -translate-y-1/2 text-[16px] font-bold tabular-nums text-gray-700">
              -
            </span>
            <input
              type="number"
              inputMode="numeric"
              value={property.floorsBasement ?? ""}
              onChange={(e) =>
                onChange({
                  floorsBasement:
                    e.target.value === ""
                      ? undefined
                      : Math.abs(Number(e.target.value) || 0),
                })
              }
              placeholder="1"
              className="h-[48px] w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-7 pr-3.5 text-[16px] text-gray-900 outline-none transition focus:border-[#3182F6] focus:bg-white focus:ring-2 focus:ring-[#3182F6]/20"
            />
          </div>
        </label>
        <Input
          label="지상 층수"
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
          label="토지면적 (평)"
          type="number"
          inputMode="decimal"
          value={property.landArea ?? ""}
          onChange={(e) =>
            onChange({
              landArea:
                e.target.value === "" ? undefined : Number(e.target.value) || 0,
            })
          }
          placeholder="60"
        />
        <Input
          label="건축면적 (평)"
          type="number"
          inputMode="decimal"
          value={property.buildingArea ?? ""}
          onChange={(e) =>
            onChange({
              buildingArea:
                e.target.value === "" ? undefined : Number(e.target.value) || 0,
            })
          }
          placeholder="40"
        />
      </div>

      <div className="mt-3 space-y-1">
        <p className="text-[13px] font-semibold text-gray-600">
          방 · 상가수
        </p>
        <div className="grid grid-cols-4 gap-1">
          {([...RESIDENTIAL_UNIT_KEYS, "상가"] as BuildingUnitKey[]).map(
            (key) => (
              <label key={key} className="block min-w-0 space-y-0.5">
                <span className="block truncate text-center text-[11px] font-semibold text-gray-500">
                  {key}
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={unitCounts[key] || ""}
                  onChange={(e) =>
                    setUnitCount(key, parseCount(e.target.value))
                  }
                  placeholder="0"
                  className="h-10 w-full rounded-lg border border-gray-200 bg-gray-50 px-1 text-center text-[15px] font-bold tabular-nums text-gray-900 outline-none transition focus:border-[#3182F6] focus:bg-white focus:ring-1 focus:ring-[#3182F6]/20"
                />
              </label>
            )
          )}
        </div>
      </div>

      <Input
        label="주차가능대수"
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
    </div>
  );
}
