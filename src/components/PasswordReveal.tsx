"use client";

import { useState } from "react";

export function PasswordReveal({ password }: { password?: string }) {
  const [visible, setVisible] = useState(false);

  if (!password) {
    return <span className="text-gray-400">미입력</span>;
  }

  return (
    <button
      type="button"
      onClick={() => setVisible((v) => !v)}
      className="inline-flex items-center gap-2 rounded-xl bg-gray-100 px-3 py-1.5 text-sm font-semibold text-gray-800 active:scale-95 transition-all duration-150"
    >
      <span className="font-mono tracking-wider">
        {visible ? password : "••••••"}
      </span>
      <span className="text-[#3182F6]">{visible ? "숨김" : "보기"}</span>
    </button>
  );
}
