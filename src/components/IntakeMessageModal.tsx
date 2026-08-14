"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { TextArea } from "@/components/ui/Input";

export function IntakeMessageModal({
  open,
  onClose,
  onApply,
}: {
  open: boolean;
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
      onClose={onClose}
      title="메시지로 입력"
      description="글을 붙여넣거나 입력한 뒤 반영하세요."
    >
      <TextArea
        ref={areaRef}
        label=""
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="메시지를 붙여넣으세요"
        className="min-h-[140px]"
      />
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button variant="secondary" fullWidth onClick={onClose}>
          취소
        </Button>
        <Button
          fullWidth
          disabled={!text.trim()}
          onClick={() => onApply(text)}
        >
          반영하기
        </Button>
      </div>
    </Modal>
  );
}
