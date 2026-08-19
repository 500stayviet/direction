"use client";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

export function TeamShareConfirmModal({
  open,
  onReject,
  onAgree,
}: {
  open: boolean;
  onReject: () => void;
  onAgree: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onReject}
      position="center"
      dense
      title="팀 공유 하시겠습니까?"
      description="동의하면 팀원에게 이 매물이 보입니다."
    >
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button type="button" variant="secondary" onClick={onReject}>
          거절
        </Button>
        <Button type="button" onClick={onAgree}>
          동의
        </Button>
      </div>
    </Modal>
  );
}
