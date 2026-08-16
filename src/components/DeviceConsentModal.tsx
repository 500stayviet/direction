"use client";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import {
  DEVICE_CONSENT_COPY,
  type DeviceConsentKind,
} from "@/lib/deviceConsent";

export function DeviceConsentModal({
  kind,
  onAllow,
  onDeny,
}: {
  kind: DeviceConsentKind | null;
  onAllow: () => void;
  onDeny: () => void;
}) {
  const copy = kind ? DEVICE_CONSENT_COPY[kind] : null;

  return (
    <Modal
      open={Boolean(kind)}
      onClose={onDeny}
      title={copy?.title}
      description={copy?.body}
      descriptionClassName="text-[14px] font-medium leading-snug text-gray-600"
      position="center"
      dense
      className="!max-w-[340px]"
      footer={
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" fullWidth onClick={onDeny}>
            허용 안 함
          </Button>
          <Button fullWidth onClick={onAllow}>
            허용
          </Button>
        </div>
      }
    >
      <p className="text-[12px] font-medium leading-snug text-gray-400">
        허용하면 이 안내를 30일 동안 다시 표시하지 않습니다. 허용 안 함을 누르면
        다음에 다시 묻습니다.
      </p>
    </Modal>
  );
}
