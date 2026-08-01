"use client";

import { useEffect, useState } from "react";

function resolveAppUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

/** 앱스토어 없이 홈 화면에 추가하는 안내 */
export function InstallAppGuide({ className = "" }: { className?: string }) {
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setUrl(resolveAppUrl());
  }, []);

  const copyUrl = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt("주소를 복사해 휴대폰 Safari/Chrome에 붙여넣으세요", url);
    }
  };

  return (
    <div
      className={[
        "rounded-[24px] border border-[#3182F6]/20 bg-gradient-to-b from-blue-50/80 to-white px-4 py-3.5",
        className,
      ].join(" ")}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-3 text-left active:scale-[0.99] transition-all duration-150"
        aria-expanded={open}
      >
        <span
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#3182F6] text-[18px] text-white"
          aria-hidden
        >
          📱
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-bold text-gray-900">
            폰에 앱처럼 쓰기
          </span>
          <span className="mt-0.5 block text-[12px] leading-relaxed text-gray-500">
            앱스토어 없이, 홈 화면에 바로가기를 추가하세요
          </span>
        </span>
        <span className="mt-1 text-[18px] font-light text-gray-300">
          {open ? "▴" : "▾"}
        </span>
      </button>

      {open && (
        <div className="mt-3 space-y-3 border-t border-blue-100/80 pt-3">
          <div>
            <p className="text-[11px] font-semibold text-gray-400">접속 주소</p>
            <div className="mt-1.5 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-xl bg-white px-3 py-2.5 text-[12px] font-semibold text-[#3182F6] ring-1 ring-gray-100">
                {url || "주소를 불러오는 중…"}
              </code>
              <button
                type="button"
                onClick={copyUrl}
                disabled={!url}
                className="shrink-0 rounded-xl bg-[#3182F6] px-3 py-2.5 text-[12px] font-bold text-white active:scale-95 transition-all duration-150 disabled:opacity-50"
              >
                {copied ? "복사됨" : "복사"}
              </button>
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-gray-400">
              이 주소를 휴대폰 브라우저에 열어 주세요. (문자·메모로 보내도 됩니다)
            </p>
          </div>

          <ol className="space-y-2.5 text-[12px] leading-relaxed text-gray-600">
            <li className="rounded-xl bg-white/80 px-3 py-2.5 ring-1 ring-gray-100">
              <span className="font-bold text-gray-900">아이폰 (Safari)</span>
              <p className="mt-1">
                1) Safari로 위 주소 열기 → 2) 하단{" "}
                <strong className="font-bold text-gray-800">공유</strong> 버튼 →
                3){" "}
                <strong className="font-bold text-gray-800">
                  홈 화면에 추가
                </strong>
              </p>
            </li>
            <li className="rounded-xl bg-white/80 px-3 py-2.5 ring-1 ring-gray-100">
              <span className="font-bold text-gray-900">안드로이드 (Chrome)</span>
              <p className="mt-1">
                1) Chrome으로 위 주소 열기 → 2) 오른쪽 위{" "}
                <strong className="font-bold text-gray-800">⋮ 메뉴</strong> → 3){" "}
                <strong className="font-bold text-gray-800">
                  앱 설치
                </strong>
                {" "}또는{" "}
                <strong className="font-bold text-gray-800">
                  홈 화면에 추가
                </strong>
              </p>
            </li>
          </ol>
        </div>
      )}
    </div>
  );
}
