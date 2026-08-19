"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { IntakeParserAdminPanel } from "@/components/admin/IntakeParserAdminPanel";
import { NaviMeetingParserAdminPanel } from "@/components/admin/NaviMeetingParserAdminPanel";

type Props = {
  token: string;
  onNewCount?: (count: number) => void;
};

export function ParsersAdminPanel({ token, onNewCount }: Props) {
  const [category, setCategory] = useState<"intake" | "navi">("intake");

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Button
          type="button"
          variant={category === "intake" ? "primary" : "secondary"}
          className="!min-h-[40px] !px-4 !text-[13px]"
          onClick={() => setCategory("intake")}
        >
          파서 · 매물고객 수집
        </Button>
        <Button
          type="button"
          variant={category === "navi" ? "primary" : "secondary"}
          className="!min-h-[40px] !px-4 !text-[13px]"
          onClick={() => setCategory("navi")}
        >
          파서 · 네비 수집
        </Button>
      </div>

      {category === "intake" ? (
        <IntakeParserAdminPanel token={token} onNewCount={onNewCount} />
      ) : (
        <NaviMeetingParserAdminPanel token={token} />
      )}
    </div>
  );
}

