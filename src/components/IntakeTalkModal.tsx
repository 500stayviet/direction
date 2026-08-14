"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { TextArea } from "@/components/ui/Input";
import type { IntakeKind } from "@/lib/intakeParse";

const GUIDE: Record<
  IntakeKind,
  { name: string; example?: string }[]
> = {
  customer: [
    { name: "고객명 또는 명칭", example: "홍길동" },
    { name: "전화번호", example: "010-1234-5678" },
    { name: "매물유형", example: "원룸 등" },
    { name: "거래종류", example: "매매 전세 월세" },
    { name: "선호위치", example: "강동구 oo동" },
    { name: "거래가액", example: "매매가 보증금 월세(월세 시)" },
    { name: "입주희망일", example: "○○월 ○○일    부터    ○○월 ○○일" },
    { name: "대출 · 보증보험 · 주차 · 엘베 (유 / 무)" },
    { name: "팀공유 (유 / 무)" },
    { name: "메모", example: "메모: 남향 저층" },
  ],
  property: [
    { name: "매물유형", example: "원룸 등" },
    { name: "거래종류", example: "매매 전세 월세" },
    { name: "주소", example: "강동구 oo동, 101동 102호" },
    { name: "거래가액", example: "매매가 보증금 월세(월세 시)" },
    { name: "임대가능일", example: "○○월 ○○일    부터    ○○월 ○○일" },
    { name: "대출 · 보증보험 · 주차 · 엘베 (유 / 무)" },
    { name: "임차인 · 임대인 전화번호", example: "010-1234-5678" },
    { name: "팀공유 (유 / 무)" },
    { name: "메모", example: "메모: 남향 저층" },
  ],
};

type SpeechRec = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult:
    | ((ev: {
        results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
      }) => void)
    | null;
  onend: (() => void) | null;
  onerror: ((ev?: { error?: string }) => void) | null;
  start: () => void;
  stop: () => void;
};

function getSpeechRecognition(): SpeechRec | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    (window as unknown as { webkitSpeechRecognition?: new () => SpeechRec })
      .webkitSpeechRecognition ||
    (window as unknown as { SpeechRecognition?: new () => SpeechRec })
      .SpeechRecognition;
  return Ctor ? new Ctor() : null;
}

function spokenFromResults(
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>
): string {
  let finals = "";
  let interim = "";
  for (let i = 0; i < results.length; i += 1) {
    const row = results[i];
    if (!row) continue;
    const piece = (row[0]?.transcript ?? "").trim();
    if (!piece) continue;
    if (row.isFinal) finals = `${finals} ${piece}`.trim();
    else interim = `${interim} ${piece}`.trim();
  }
  return `${finals} ${interim}`.replace(/\s+/g, " ").trim();
}

export function IntakeTalkModal({
  open,
  kind,
  onClose,
  onApply,
}: {
  open: boolean;
  kind: IntakeKind;
  onClose: () => void;
  onApply: (text: string) => void;
}) {
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const recRef = useRef<SpeechRec | null>(null);
  const prefixRef = useRef("");
  const textRef = useRef("");
  const listeningRef = useRef(false);

  const setListeningBoth = (next: boolean) => {
    listeningRef.current = next;
    setListening(next);
  };

  useEffect(() => {
    if (!open) {
      listeningRef.current = false;
      recRef.current?.stop();
      recRef.current = null;
      setListening(false);
      setText("");
      setError("");
      prefixRef.current = "";
      textRef.current = "";
      return;
    }
    const rec = getSpeechRecognition();
    if (!rec) {
      setError("이 브라우저에서는 대화를 쓸 수 없습니다. 메시지로 입력해 주세요.");
      return;
    }
    rec.lang = "ko-KR";
    rec.interimResults = true;
    rec.continuous = true;
    rec.onresult = (ev) => {
      const spoken = spokenFromResults(ev.results);
      const next = `${prefixRef.current} ${spoken}`.replace(/\s+/g, " ").trim();
      textRef.current = next;
      setText(next);
    };
    rec.onend = () => {
      prefixRef.current = textRef.current;
      if (!listeningRef.current) return;
      try {
        rec.start();
      } catch {
        setListeningBoth(false);
      }
    };
    rec.onerror = (ev) => {
      if (ev?.error === "aborted" || ev?.error === "no-speech") return;
      setListeningBoth(false);
      setError("말을 인식하지 못했습니다. 다시 눌러 주세요.");
    };
    recRef.current = rec;
  }, [open]);

  const toggleListen = () => {
    const rec = recRef.current;
    if (!rec) return;
    setError("");
    if (listeningRef.current) {
      setListeningBoth(false);
      rec.stop();
      prefixRef.current = textRef.current;
      return;
    }
    prefixRef.current = textRef.current;
    try {
      rec.start();
      setListeningBoth(true);
    } catch {
      setError("마이크를 시작할 수 없습니다.");
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="대화로 입력"
      description="가이드에 따라 대화 해 보세요."
    >
      <ul className="mb-3 space-y-1.5 rounded-2xl bg-gray-50 px-3 py-2.5">
        {GUIDE[kind].map((line) => (
          <li key={line.name} className="flex items-baseline">
            <span className="shrink-0 text-[15px] font-bold text-gray-800">
              {line.name}
              {line.example ? ":" : ""}
            </span>
            {line.example ? (
              <span className="ml-2.5 whitespace-pre text-[13px] font-medium text-gray-500">
                예) {line.example}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
      <TextArea
        label="대화"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          textRef.current = e.target.value;
          prefixRef.current = e.target.value;
        }}
        placeholder="입력한 내용이 여기에 쌓입니다"
        className="min-h-[96px]"
      />
      {error ? (
        <p className="mt-1.5 text-[12px] font-semibold text-red-400">{error}</p>
      ) : null}
      <button
        type="button"
        className={[
          "mt-2 inline-flex w-full min-h-[48px] items-center justify-center gap-2 rounded-2xl px-4 py-3 text-[15px] font-semibold",
          "active:scale-95 transition-all duration-150 disabled:opacity-50 disabled:active:scale-100",
          listening
            ? "border-2 border-red-500 bg-white text-red-600"
            : "bg-red-500 text-white hover:bg-red-600",
        ].join(" ")}
        onClick={toggleListen}
        disabled={!recRef.current && Boolean(error)}
      >
        {listening ? (
          <>
            <span
              className="rec-dot-blink h-2.5 w-2.5 shrink-0 rounded-full bg-red-500"
              aria-hidden
            />
            듣는 중
          </>
        ) : (
          "대화 시작"
        )}
      </button>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button variant="secondary" fullWidth onClick={onClose}>
          취소
        </Button>
        <Button
          fullWidth
          disabled={!text.trim()}
          onClick={() => onApply(textRef.current || text)}
        >
          반영하기
        </Button>
      </div>
    </Modal>
  );
}
