"use client";

import type { RouteSummary } from "@/lib/types";
import { Card } from "@/components/ui/Card";

export function RouteSummaryCard({
  summary,
}: {
  summary: RouteSummary;
}) {
  return (
    <Card className="bg-blue-50 border-blue-100 py-4">
      <p className="text-center text-[15px] font-bold text-gray-900">
        🚗 이동거리: {summary.distanceKm.toFixed(1)} km / 약 {summary.durationMin}분
      </p>
      <p className="mt-1 text-center text-xs text-gray-500">
        {summary.fromIndex + 1}번 → {summary.toIndex + 1}번 매물
      </p>
    </Card>
  );
}
