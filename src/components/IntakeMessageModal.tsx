"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { IntakeAiBusyCover } from "@/components/IntakeAiBusyOverlay";

const AREA_MIN_PX = 144;
const AREA_MAX_PX = 280;
const MESSAGE_MAX_LENGTH = 200;

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

  const resizeArea = () => {
    const el = areaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(Math.max(el.scrollHeight, AREA_MIN_PX), AREA_MAX_PX)}px`;
  };

  useEffect(() => {
    if (!open) return;
    setText("");
    const focus = () => {
      const el = areaRef.current;
      if (!el) return;
      el.focus();
      el.select();
      resizeArea();
    };
    const id = window.setTimeout(focus, 80);
    return () => window.clearTimeout(id);
  }, [open]);

  useEffect(() => {
    resizeArea();
  }, [text]);

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title="메시지로 입력"
      description="메시지를 작성 또는 내용을 가져와 붙여넣으세요. AI로 내용을 분석하여 반영합니다."
      descriptionClassName="text-[12px] font-medium leading-snug"
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
            반영하기
          </Button>
        </div>
      }
    >
      <div className="-mx-2 rounded-2xl bg-gray-50 px-1 py-1.5">
        <textarea
          ref={areaRef}
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, MESSAGE_MAX_LENGTH))}
          maxLength={MESSAGE_MAX_LENGTH}
          aria-label="메시지"
          autoFocus
          disabled={busy}
          rows={6}
          className="w-full resize-none overflow-y-auto rounded-xl border border-blue-400 bg-white p-2 text-[15px] font-bold leading-snug text-gray-800 outline-none disabled:opacity-60"
        />
        <p className="mt-1 px-2 text-right text-[11px] font-medium tabular-nums text-gray-400">
          {text.length}/{MESSAGE_MAX_LENGTH}
        </p>
      </div>
    </Modal>
  );
}
