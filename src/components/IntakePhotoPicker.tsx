"use client";

import { normalizeOcrIntakeText } from "@/lib/intakeOcrNormalize";

export function IntakePhotoPicker({
  requestId,
  onText,
  onError,
}: {
  requestId: number;
  onText: (text: string) => void;
  onError: (message: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (requestId <= 0) return;
    inputRef.current?.click();
  }, [requestId]);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      if (typeof window === "undefined") return;
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("kor+eng");
      const { data } = await worker.recognize(file);
      await worker.terminate();
      const text = normalizeOcrIntakeText((data.text ?? "").replace(/\s+/g, " ").trim());
      if (!text) {
        onError("사진에서 글을 읽지 못했습니다. 메시지로 입력해 주세요.");
        return;
      }
      onText(text);
    } catch {
      onError("사진을 읽지 못했습니다. 메시지로 입력해 주세요.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void onFile(e.target.files?.[0])}
      />
      {busy ? (
        <p className="text-center text-[13px] font-semibold text-[#3182F6]">
          사진에서 글을 읽는 중…
        </p>
      ) : null}
    </>
  );
}
