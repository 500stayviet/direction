"use client";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

export function RequiredFieldWarnModal({
  open,
  message,
  onClose,
}: {
  open: boolean;
  message?: string;
  onClose: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      position="center"
      dense
      title={message?.trim() || "칸 입력은 필수입니다."}
    >
      <Button
        fullWidth
        className="mt-1 !bg-red-400 hover:!bg-red-500"
        onClick={onClose}
      >
        확인
      </Button>
    </Modal>
  );
}
