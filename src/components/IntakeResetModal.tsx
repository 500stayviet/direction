"use client";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

export function IntakeResetModal({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      position="center"
      dense
      title="다시 입력할까요?"
      description="지금 입력한 내용이 모두 지워집니다."
    >
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" fullWidth onClick={onClose}>
          취소
        </Button>
        <Button fullWidth onClick={onConfirm}>
          다시 입력
        </Button>
      </div>
    </Modal>
  );
}
