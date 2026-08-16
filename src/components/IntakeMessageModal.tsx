"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { IntakeAiBusyCover } from "@/components/IntakeAiBusyOverlay";

export function IntakeMessageModal({
  open,
  busy = false,
  onClose,
  onApply,
}: {
  open: boolean;
  busy?: boolean;
  onClose: () => void;
  onApply: (text: string) => void;
}) {
  const [text, setText] = useState("");
  const areaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    setText("");
    const id = window.setTimeout(() => {
      const el = areaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(0, el.value.length);
    }, 50);
    return () => window.clearTimeout(id);
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title="메시지로 입력"
      description="AI가 분석해 각 칸에 넣습니다."
      dense
      overlayClassName="z-50 overflow-x-hidden"
      className="max-h-[min(82dvh,640px)]"
      cover={busy ? <IntakeAiBusyCover /> : null}
      footer={
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" fullWidth disabled={busy} onClick={onClose}>
            취소
          </Button>
          <Button
            fullWidth
            disabled={busy || !text.trim()}
            onClick={() => onApply(text)}
          >
            AI 반영하기
          </Button>
        </div>
      }
    >
      <div className="flex min-h-0 flex-col rounded-2xl bg-gray-50 px-2 py-2">
        <textarea
          ref={areaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="메시지를 작성 또는 붙여넣으세요"
          disabled={busy}
          className="h-[28vh] max-h-[220px] min-h-[160px] w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-[16px] leading-relaxed text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-[#3182F6] focus:ring-2 focus:ring-[#3182F6]/20 disabled:opacity-60"
        />
        <p className="mt-2 px-0.5 text-[12px] font-medium leading-snug text-gray-400">
          작성하거나 붙여 넣은 글을 AI가 분석해 매물·고객 각 칸에 넣습니다.
        </p>
      </div>
    </Modal>
  );
}
