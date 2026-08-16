"use client";

import { useState } from "react";
import { getNaviPreference } from "@/lib/storage";
import { NAVI_REMEMBER_ENABLED, isNaviAppDisabled, openNavi, toNaviAddress } from "@/lib/navi";
import { NaviAppModal } from "@/components/NaviAppModal";

interface AddressLinkProps {
  /** 네비에 전달할 주소 (지번까지). 호실·건물명 넣지 말 것 */
  address: string;
  className?: string;
  showIcon?: boolean;
  /** 화면에만 보이는 텍스트 (호실 등 포함 가능) */
  children?: React.ReactNode;
}

export function AddressLink({
  address,
  className = "",
  showIcon = true,
  children,
}: AddressLinkProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const naviAddress = toNaviAddress(address);

  if (!naviAddress) return <span className="text-gray-400">주소 없음</span>;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!NAVI_REMEMBER_ENABLED) {
      setModalOpen(true);
      return;
    }
    void getNaviPreference().then((pref) => {
      if (pref?.remember && pref.app && !isNaviAppDisabled(pref.app)) {
        void openNavi(pref.app, naviAddress);
        return;
      }
      setModalOpen(true);
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={[
          "relative z-10 flex w-full cursor-pointer text-left font-semibold text-[#3182F6]",
          showIcon ? "items-start gap-2" : "flex-col items-stretch",
          "active:scale-[0.99] transition-all duration-150",
          className,
        ].join(" ")}
      >
        {showIcon ? (
          <>
            <span className="shrink-0" aria-hidden>
              📍
            </span>
            <span className="min-w-0 flex-1 break-words">
              {children ?? naviAddress}
            </span>
          </>
        ) : (
          (children ?? naviAddress)
        )}
      </button>
      <NaviAppModal
        open={modalOpen}
        address={naviAddress}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}
