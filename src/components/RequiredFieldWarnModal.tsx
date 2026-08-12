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
      title="필수 항목 미입력"
      description={message}
    >
      <div className="rounded-2xl border-2 border-red-400 bg-red-50 px-4 py-3">
        <p className="text-[15px] font-bold text-red-700">
          빨간 테두리 칸을 입력해 주세요.
        </p>
        <p className="mt-1 text-[13px] font-medium text-red-600/90">
          입력하면 테두리가 바로 사라집니다.
        </p>
      </div>
      <Button
        fullWidth
        className="mt-3 !bg-red-500 hover:!bg-red-600"
        onClick={onClose}
      >
        확인
      </Button>
    </Modal>
  );
}
