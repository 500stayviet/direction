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
      {copy ? (
        <div className="space-y-3">
          <h2 className="text-center text-lg font-bold leading-snug text-gray-900">
            {copy.title}
          </h2>
          <p className="text-center text-[12px] font-semibold leading-snug text-red-500">
            허용하면 30일간 다시 묻지 않습니다.
          </p>
        </div>
      ) : null}
    </Modal>
  );
}
