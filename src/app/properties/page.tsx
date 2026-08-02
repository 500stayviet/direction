"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StickyActionBar } from "@/components/StickyActionBar";
import { formatDepositRent } from "@/lib/format";
import { formatSavedDate } from "@/lib/date";
import { getListedProperties } from "@/lib/storage";
import type { ListedProperty } from "@/lib/types";

export default function PropertyListPage() {
  const [properties, setProperties] = useState<ListedProperty[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    void getListedProperties().then(setProperties);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? properties.filter(
          (p) =>
            p.address.toLowerCase().includes(q) ||
            p.roomNo.toLowerCase().includes(q) ||
            (p.roomType ?? "").includes(q) ||
            p.dealType.includes(q)
        )
      : properties;
    return [...list].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [properties, query]);

  return (
    <main>
      <PageHeader
        title="매물 리스트"
        backHref="/"
        subtitle={`등록 ${properties.length}건`}
      />

      <div className="space-y-3 pb-4">
        <Card>
          <label className="block space-y-1">
            <span className="text-[13px] font-semibold text-gray-600">
              주소 / 호실 / 유형 검색
            </span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="성내동, 원룸, 전세..."
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-3 text-[16px] text-gray-900 outline-none transition focus:border-[#3182F6] focus:bg-white focus:ring-2 focus:ring-[#3182F6]/20"
            />
          </label>
        </Card>

        {filtered.length === 0 ? (
          <Card>
            <p className="text-sm text-gray-500">
              {properties.length === 0
                ? "등록된 매물이 없습니다. 아래 버튼으로 추가해 주세요."
                : "검색 결과가 없습니다."}
            </p>
          </Card>
        ) : (
          <div className="space-y-2">
            {filtered.map((p) => (
              <Link key={p.id} href={`/properties/${p.id}`}>
                <Card pressable className="mb-2 !p-3">
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <p className="text-[13px] font-bold text-[#3182F6]">
                      {formatSavedDate(p.createdAt) || "-"}
                    </p>
                    <p className="text-[11px] font-medium text-gray-400">
                      수정 {formatSavedDate(p.updatedAt) || "-"}
                    </p>
                  </div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[16px] font-bold text-gray-900 leading-snug">
                        {p.address || "주소 미입력"}
                      </p>
                      <p className="mt-1 text-sm text-gray-500">
                        {p.roomNo || "호실 미입력"}
                      </p>
                      <p className="mt-2 text-sm text-gray-600">
                        {p.roomType === "건물" && p.buildingKind
                          ? `건물 · ${p.buildingKind}`
                          : p.roomType ?? "-"}{" "}
                        · {p.dealType} ·{" "}
                        {formatDepositRent(
                          p.dealType,
                          p.deposit,
                          p.monthlyRent
                        )}
                      </p>
                    </div>
                    <span className="text-xl text-gray-300">›</span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      <StickyActionBar>
        <Link href="/properties/new">
          <Button fullWidth size="lg">
            매물 추가하기
          </Button>
        </Link>
      </StickyActionBar>
    </main>
  );
}
