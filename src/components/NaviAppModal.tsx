"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { NAVI_APPS, NAVI_REMEMBER_ENABLED, openNavi } from "@/lib/navi";
import { setNaviPreference } from "@/lib/storage";
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
  const [selected, setSelected] = useState<NaviApp>("tmap");
  /** 기본: 매번 선택. 체크 시 기억 (NAVI_REMEMBER_ENABLED일 때만) */
  const [remember, setRemember] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelected("tmap");
    setRemember(false);
  }, [open]);

  const handleOpen = () => {
    const app = NAVI_APPS.find((item) => item.id === selected);
    if (!app || app.disabled) return;
    void (async () => {
      const shouldRemember = NAVI_REMEMBER_ENABLED && remember;
      await setNaviPreference(selected, shouldRemember);
      await openNavi(selected, address);
      onOpened?.(selected);
      onClose();
    })();
  };

  return (
    <Modal open={open} onClose={onClose} title="어떤 앱으로 연결할까요?">
      <p className="-mt-2 mb-4 rounded-xl bg-amber-50 px-3 py-2.5 text-[12px] font-semibold leading-relaxed text-amber-800">
        (추천) 아래 앱이 없으시면 플레이스토어나 앱스토어에서 설치후 사용을 권장
        합니다
      </p>

      <div className="space-y-2">
        {NAVI_APPS.filter((app) => app.id !== "kakaonavi").map((app) => {
          const disabled = Boolean(app.disabled);
          const isSelected = !disabled && selected === app.id;
          return (
            <button
              key={app.id}
              type="button"
              disabled={disabled}
              aria-label={app.label}
              aria-pressed={isSelected}
              onClick={() => {
                if (disabled) return;
                setSelected(app.id);
              }}
              style={{ backgroundColor: app.buttonBg }}
              className={[
                "relative flex h-14 w-full items-center justify-center overflow-hidden rounded-2xl border transition-all duration-150",
                disabled
                  ? "cursor-not-allowed border-gray-300 opacity-90"
                  : "active:scale-[0.99]",
                isSelected
                  ? "border-[#3182F6] ring-2 ring-[#3182F6]/35"
                  : "border-gray-200",
              ].join(" ")}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <span className="relative h-full w-full">
                <img
                  src={app.image}
                  alt=""
                  className="h-full w-full object-cover object-center"
                  draggable={false}
                />
                {app.id === "kakaonavi" ? (
                  <span
                    aria-hidden
                    style={{ backgroundColor: app.buttonBg }}
                    className="absolute top-[8%] right-[6%] h-[18%] w-[28%] rounded"
                  />
                ) : null}
              </span>
            </button>
          );
        })}
      </div>

      {NAVI_REMEMBER_ENABLED ? (
        <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="h-4 w-4 shrink-0 accent-[#3182F6]"
          />
          <span>항상 이 앱으로 열기</span>
        </label>
      ) : (
        null
      )}

      <div className="mt-5 grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={onClose}>
          취소
        </Button>
        <Button onClick={handleOpen}>연결하기</Button>
      </div>
    </Modal>
  );
}
