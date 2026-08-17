"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import {
  buildCustomerBlankFormText,
  buildPropertyBlankFormText,
} from "@/lib/blankIntakeForm";
import type { User } from "@/lib/types";

type Kind = "customer" | "property";

interface BlankFormModalProps {
  open: boolean;
  kind: Kind;
  agent: Pick<User, "shopName" | "name" | "phone"> | null;
  onClose: () => void;
}

export function BlankFormModal({
  open,
  kind,
  agent,
  onClose,
}: BlankFormModalProps) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setCopied(false);
    setError("");
  }, [open]);

  const title = kind === "customer" ? "고객등록 양식" : "매물등록 양식";
  const text = useMemo(() => {
    return kind === "customer"
      ? buildCustomerBlankFormText(agent)
      : buildPropertyBlankFormText(agent);
  }, [agent, kind]);

  const handleCopy = async () => {
    if (!text.trim()) return;
    setBusy(true);
    setError("");
    setCopied(false);
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
        return;
      }
      setError(
        "이 기기에서는 복사를 지원하지 않습니다. 텍스트를 길게 눌러 복사해 주세요."
      );
    } catch {
      setError(
        "복사에 실패했습니다. 미리보기 텍스트를 길게 눌러 복사해 주세요."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`${title} 미리보기`} dense>
      <div className="space-y-3">
        <p className="text-[13px] leading-snug text-gray-500">
          필요시 고객에게 전달하여 양식을 완성하세요. 그후 메시지로 입력으로
          붙여넣기하여{" "}
          {kind === "customer" ? "고객등록" : "매물등록"} 가능합니다.
        </p>

        <pre className="max-h-[50dvh] overflow-y-auto whitespace-pre-wrap rounded-2xl bg-[#F9FAFB] px-3.5 py-3 text-[13px] font-medium leading-relaxed text-gray-800 ring-1 ring-inset ring-gray-100">
          {text}
        </pre>

        {copied ? (
          <p className="text-center text-[13px] font-bold text-[#3182F6]">
            양식 내용이 복사되었습니다.
          </p>
        ) : null}
        {error ? (
          <p className="text-center text-[13px] font-semibold text-red-600">
            {error}
          </p>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            닫기
          </Button>
          <Button onClick={() => void handleCopy()} disabled={busy || !text}>
            {busy ? "복사 중..." : "복사하기"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
