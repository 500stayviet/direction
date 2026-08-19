"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { LandAreaDualFields } from "@/components/LandAreaDualFields";
import { formatBuildingParking } from "@/lib/format";
import {
  normalizeUnitCounts,
  unitKeysForBuildingKind,
} from "@/lib/constants";
import type {
  BuildingUnitCounts,
  BuildingUnitKey,
  Property,
} from "@/lib/types";

function parseCount(raw: string): number {
  const text = raw.replace(/개/g, "").replace(/\s/g, "").trim();
  if (text === "") return 0;
  const n = Number(text);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

function UnitCountInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const filled = value > 0 && !editing;

  return (
    <Input
      label={label}
      inputMode="numeric"
      pattern="[0-9]*"
      placeholder="예) 2 개"
      value={filled ? `${value} 개` : editing || value ? String(value || "") : ""}
      onFocus={() => setEditing(true)}
      onBlur={() => setEditing(false)}
      onChange={(e) => onChange(parseCount(e.target.value))}
    />
  );
}

function parseLabeledCount(raw: string, label: string): number | undefined {
  const match = raw.match(new RegExp(`${label}\\s*(\\d+)\\s*대?`));
  if (!match) return undefined;
  const n = Number(match[1]);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function parseBuildingParking(raw: string): {
  parkingSpacesAbove?: number;
  parkingSpacesBasement?: number;
  parkingSpaces?: number;
  parkingType: "유" | "무";
} {
  let above = parseLabeledCount(raw, "지상");
  const basement = parseLabeledCount(raw, "지하");
  if (above == null && basement == null) {
    const n = parseCount(raw.replace(/대/g, ""));
    if (n > 0) above = n;
  }
  const total = (above ?? 0) + (basement ?? 0);
  return {
    parkingSpacesAbove: above,
    parkingSpacesBasement: basement,
    parkingSpaces: total > 0 ? total : undefined,
    parkingType: total > 0 ? "유" : "무",
  };
}

function ParkingSpacesInput({
  above,
  basement,
  total,
  onChange,
}: {
  above?: number;
  basement?: number;
  total?: number;
  onChange: (patch: Partial<Property>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const resolvedAbove =
    above != null ? above : basement != null ? undefined : total;
  const filledText = formatBuildingParking(resolvedAbove, basement, total);

  return (
    <Input
      label="주차가능대수"
      placeholder="예) 지상 5대, 지하 10대"
      value={editing ? draft : filledText}
      onFocus={() => {
        setEditing(true);
        setDraft(filledText);
      }}
      onBlur={() => {
        onChange(parseBuildingParking(draft));
        setEditing(false);
        setDraft("");
      }}
      onChange={(e) => {
        const raw = e.target.value;
        setDraft(raw);
        onChange(parseBuildingParking(raw));
      }}
    />
  );
}

interface BuildingLandFieldsProps {
  property: Property;
  onChange: (patch: Partial<Property>) => void;
}

/** 토지 · 건물 전용 입력 (기존 카드/토글 톤 유지) */
export function BuildingLandFields({
  property,
  onChange,
}: BuildingLandFieldsProps) {
  const roomType = property.roomType;
  const unitCounts: BuildingUnitCounts = normalizeUnitCounts(
    property.unitCounts
  );
  const unitKeys = unitKeysForBuildingKind(property.buildingKind);

  const setUnitCount = (key: BuildingUnitKey, n: number) => {
    onChange({ unitCounts: { ...unitCounts, [key]: n } });
  };

  if (roomType === "토지") {
    return null;
  }

  if (roomType !== "건물") return null;

  return (
    <div className="space-y-1.5">
      <p className="text-sm font-bold text-gray-800">건물 정보</p>

      <div className="grid grid-cols-2 gap-2">
        <Input
          label="지하 층수"
          type="number"
          inputMode="numeric"
          prefix="-"
          value={property.floorsBasement ?? ""}
          onChange={(e) =>
            onChange({
              floorsBasement:
                e.target.value === ""
                  ? undefined
                  : Math.abs(Number(e.target.value) || 0),
            })
          }
          placeholder="예) 1"
        />
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
          placeholder="예) 4"
        />
      </div>

      <LandAreaDualFields
        label="토지면적"
        pyeong={property.landArea}
        onChange={(landArea) => onChange({ landArea })}
        pyeongPlaceholder="예) 60.00"
        m2Placeholder="예) 198.35 ㎡"
      />
      <LandAreaDualFields
        label="건축면적"
        pyeong={property.buildingArea}
        onChange={(buildingArea) => onChange({ buildingArea })}
        pyeongPlaceholder="예) 40.00"
        m2Placeholder="예) 132.23 ㎡"
      />

      <div className="mt-3 space-y-1">
        <p className="text-[13px] font-semibold text-gray-600">
          건물내 방 · 상가수
        </p>
        <div
          className={
            unitKeys.length <= 2
              ? "grid grid-cols-2 gap-2"
              : "grid grid-cols-4 gap-1"
          }
        >
          {unitKeys.map((key) => (
            <UnitCountInput
              key={key}
              label={key}
              value={unitCounts[key] || 0}
              onChange={(n) => setUnitCount(key, n)}
            />
          ))}
        </div>
      </div>

      <ParkingSpacesInput
        above={property.parkingSpacesAbove}
        basement={property.parkingSpacesBasement}
        total={property.parkingSpaces}
        onChange={onChange}
      />
    </div>
  );
}
