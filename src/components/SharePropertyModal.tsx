"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

interface SharePropertyModalProps {
  open: boolean;
  text: string;
  onClose: () => void;
}

export function SharePropertyModal({
  open,
  text,
  onClose,
}: SharePropertyModalProps) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

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
      description="손님에게 보낼 내용입니다. 호실·상대방 전화·손님 정보는 포함되지 않습니다."
    >
      <div className="space-y-3">
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
