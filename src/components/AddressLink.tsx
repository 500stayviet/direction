"use client";

import { useState } from "react";
import { getNaviPreference } from "@/lib/storage";
import { openNavi, toNaviAddress } from "@/lib/navi";
import { NaviAppModal } from "@/components/NaviAppModal";

interface AddressLinkProps {
  /** 네비에 전달할 주소 (지번까지). 호실·건물명 넣지 말 것 */
  address: string;
  className?: string;
  /** 화면에만 보이는 텍스트 (호실 등 포함 가능) */
  children?: React.ReactNode;
}

export function AddressLink({
  address,
  className = "",
  children,
}: AddressLinkProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const naviAddress = toNaviAddress(address);

  if (!naviAddress) return <span className="text-gray-400">주소 없음</span>;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    void getNaviPreference().then((pref) => {
      if (pref?.remember && pref.app) {
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
          "relative z-10 flex w-full cursor-pointer items-start gap-2 text-left font-semibold text-[#3182F6]",
          "active:scale-[0.99] transition-all duration-150",
          className,
        ].join(" ")}
      >
        <span className="shrink-0" aria-hidden>
          📍
        </span>
        <span className="min-w-0 flex-1 break-words">
          {children ?? naviAddress}
        </span>
      </button>
      <NaviAppModal
        open={modalOpen}
        address={naviAddress}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}
