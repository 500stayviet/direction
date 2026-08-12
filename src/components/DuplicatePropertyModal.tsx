"use client";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

export function DuplicatePropertyModal({
  open,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      position="center"
      dense
      title="동일 매물이 있습니다"
      description="같은 주소·호실로 이미 등록된 매물이 있습니다. 그래도 저장할까요?"
    >
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          취소
        </Button>
        <Button type="button" onClick={onConfirm}>
          그래도 저장
        </Button>
      </div>
    </Modal>
  );
}
