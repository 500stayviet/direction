"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { buildPropertyShareText } from "@/lib/shareProperty";
import type { Property, User } from "@/lib/types";

interface SharePropertyModalProps {
  open: boolean;
  properties: Property[];
  agent: Pick<User, "shopName" | "name" | "phone" | "username"> | null;
  onClose: () => void;
}

export function SharePropertyModal({
  open,
  properties,
  agent,
  onClose,
}: SharePropertyModalProps) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [excludeRoomNo, setExcludeRoomNo] = useState(true);
  const [excludeUsableArea, setExcludeUsableArea] = useState(true);
  const [excludeNotes, setExcludeNotes] = useState(false);

  useEffect(() => {
    if (!open) return;
    setExcludeRoomNo(true);
    setExcludeUsableArea(true);
    setExcludeNotes(false);
    setCopied(false);
    setError("");
  }, [open]);

  const text = useMemo(() => {
    if (!agent) return "";
    return buildPropertyShareText(properties, agent, {
      excludeRoomNo,
      excludeUsableArea,
      excludeNotes,
    });
  }, [agent, properties, excludeRoomNo, excludeUsableArea, excludeNotes]);

  const handleCopy = async () => {
    if (!text.trim()) return;
    setBusy(true);
    setError("");
    setCopied(false);
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
        return;
      }
      setError("이 기기에서는 복사를 지원하지 않습니다. 텍스트를 길게 눌러 복사해 주세요.");
    } catch {
      setError("복사에 실패했습니다. 미리보기 텍스트를 길게 눌러 복사해 주세요.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="매물 공유 미리보기"
      dense
    >
      <div className="space-y-3">
        <div>
          <p className="text-[13px] leading-snug text-gray-500">
            손님에게 보낼 내용입니다. 상대방 전화·손님 정보는 포함되지
            않습니다.
          </p>
          <div className="mt-1 flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
            <label className="flex cursor-pointer items-center gap-1.5 text-[13px] font-semibold text-gray-600">
              <input
                type="checkbox"
                checked={excludeRoomNo}
                onChange={(e) => setExcludeRoomNo(e.target.checked)}
                className="h-4 w-4 accent-[#3182F6]"
              />
              호실 제외
            </label>
            <label className="flex cursor-pointer items-center gap-1.5 text-[13px] font-semibold text-gray-600">
              <input
                type="checkbox"
                checked={excludeUsableArea}
                onChange={(e) => setExcludeUsableArea(e.target.checked)}
                className="h-4 w-4 accent-[#3182F6]"
              />
              실사용면적 제외
            </label>
            <label className="flex cursor-pointer items-center gap-1.5 text-[13px] font-semibold text-gray-600">
              <input
                type="checkbox"
                checked={excludeNotes}
                onChange={(e) => setExcludeNotes(e.target.checked)}
                className="h-4 w-4 accent-[#3182F6]"
              />
              추가내용 제외
            </label>
          </div>
        </div>

        <pre className="max-h-[50dvh] overflow-y-auto whitespace-pre-wrap rounded-2xl bg-[#F9FAFB] px-3.5 py-3 text-[13px] font-medium leading-relaxed text-gray-800 ring-1 ring-inset ring-gray-100">
          {text || "공유할 매물이 없습니다."}
        </pre>

        {copied ? (
          <p className="text-center text-[13px] font-bold text-[#3182F6]">
            매물 내용이 복사되었습니다.
          </p>
        ) : null}
        {error ? (
          <p className="text-center text-[13px] font-semibold text-red-600">
            {error}
          </p>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            닫기
          </Button>
          <Button onClick={() => void handleCopy()} disabled={busy || !text}>
            {busy ? "복사 중..." : "복사하기"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
