export type DeviceConsentKind = "microphone" | "photos";

export const DEVICE_CONSENT_MS = 30 * 24 * 60 * 60 * 1000;

const STORAGE_PREFIX = "direction.deviceConsent.";

export const DEVICE_CONSENT_COPY: Record<
  DeviceConsentKind,
  { title: string; body: string }
> = {
  microphone: {
    title: "마이크를 사용하도록 허용하시겠습니까?",
    body: "'현장동선'에서 대화로 입력할 때 마이크를 사용합니다.",
  },
  photos: {
    title: "사진 및 카메라에 액세스하도록 허용하시겠습니까?",
    body: "'현장동선'에서 사진으로 입력할 때 촬영하거나 앨범에서 사진을 고릅니다.",
  },
};

function storageKey(kind: DeviceConsentKind) {
  return `${STORAGE_PREFIX}${kind}`;
}

export function hasValidDeviceConsent(
  kind: DeviceConsentKind,
  now = Date.now()
): boolean {
  if (typeof window === "undefined") return false;
  try {
    const grantedAt = Number(window.localStorage.getItem(storageKey(kind)));
    if (!Number.isFinite(grantedAt) || grantedAt <= 0) return false;
    return now - grantedAt < DEVICE_CONSENT_MS;
  } catch {
    return false;
  }
}

export function grantDeviceConsent(
  kind: DeviceConsentKind,
  now = Date.now()
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(kind), String(now));
  } catch {
    /* private mode */
  }
}

export function consentKindForIntake(
  method: "talk" | "photo"
): DeviceConsentKind {
  return method === "talk" ? "microphone" : "photos";
}
