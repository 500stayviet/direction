"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { NAVI_APPS, openNavi } from "@/lib/navi";
import { NAVI_REMEMBER_DAYS, setNaviPreference } from "@/lib/storage";
import type { NaviApp } from "@/lib/types";

interface NaviAppModalProps {
  open: boolean;
  address: string;
  onClose: () => void;
  onOpened?: (app: NaviApp) => void;
}

export function NaviAppModal({
  open,
  address,
  onClose,
  onOpened,
}: NaviAppModalProps) {
  const [selected, setSelected] = useState<NaviApp>("kakaonavi");
  /** 기본: 매번 선택. 체크해야만 약 15일 기억 */
  const [remember, setRemember] = useState(false);

  useEffect(() => {
    if (!open) return;
    setRemember(false);
  }, [open]);

  const handleOpen = () => {
    void setNaviPreference(selected, remember)
      .then(() => openNavi(selected, address))
      .then(() => {
        onOpened?.(selected);
        onClose();
      });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="어떤 앱으로 연결할까요?"
      description="선택한 내비 앱으로 주소를 바로 전달합니다. 체크하지 않으면 매번 고릅니다."
    >
      <div className="space-y-2">
        {NAVI_APPS.map((app) => (
          <button
            key={app.id}
            type="button"
            onClick={() => setSelected(app.id)}
            className={[
              "w-full rounded-2xl border p-4 text-left active:scale-95 transition-all duration-150",
              selected === app.id
                ? "border-[#3182F6] bg-blue-50"
                : "border-gray-200 bg-white",
            ].join(" ")}
          >
            <div className="font-bold text-gray-900">{app.label}</div>
            <div className="text-sm text-gray-500">{app.description}</div>
          </button>
        ))}
      </div>

      <label className="mt-4 flex items-start gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={remember}
          onChange={(e) => setRemember(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-[#3182F6]"
        />
        <span>
          항상 이 앱으로 열기
          <span className="mt-0.5 block text-[12px] font-medium text-gray-400">
            약 {NAVI_REMEMBER_DAYS}일간만 기억 · 이후 다시 선택
          </span>
        </span>
      </label>

      <div className="mt-5 grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={onClose}>
          취소
        </Button>
        <Button onClick={handleOpen}>연결하기</Button>
      </div>
    </Modal>
  );
}
