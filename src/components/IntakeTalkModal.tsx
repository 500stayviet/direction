"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { TextArea } from "@/components/ui/Input";
import {
  intakeGuideHitsFromText,
  type IntakeGuideKey,
} from "@/lib/intakeGuideHits";
import type { IntakeKind } from "@/lib/intakeParse";
import {
  absorbCommitted,
  composeTalkText,
  liveTail,
  readSpeechResults,
} from "@/lib/speechTranscript";
import { filledSectionClass } from "@/lib/uiInvalid";

const GUIDE: Record<
  IntakeKind,
  { key: IntakeGuideKey; name: string; example?: string }[]
> = {
  customer: [
    { key: "name", name: "고객명 또는 명칭", example: "홍길동" },
    { key: "phone", name: "전화번호", example: "010-1234-5678" },
    { key: "roomType", name: "매물유형", example: "원룸 등" },
    { key: "dealType", name: "거래종류", example: "매매 전세 월세" },
    { key: "location", name: "선호위치", example: "강동구 oo동" },
    { key: "money", name: "거래가액", example: "매매가 보증금 월세(월세 시)" },
    {
      key: "dates",
      name: "입주희망일",
      example: "○○월 ○○일    부터    ○○월 ○○일",
    },
    { key: "flags", name: "대출 · 보증보험 · 주차 · 엘베 (유 / 무)" },
    { key: "share", name: "팀공유 (유 / 무)" },
    { key: "notes", name: "메모", example: "메모: 남향 저층" },
  ],
  property: [
    { key: "roomType", name: "매물유형", example: "원룸 등" },
    { key: "dealType", name: "거래종류", example: "매매 전세 월세" },
    { key: "location", name: "주소", example: "강동구 oo동, 101동 102호" },
    { key: "money", name: "거래가액", example: "매매가 보증금 월세(월세 시)" },
    {
      key: "dates",
      name: "임대가능일",
      example: "○○월 ○○일    부터    ○○월 ○○일",
    },
    { key: "flags", name: "대출 · 보증보험 · 주차 · 엘베 (유 / 무)" },
    {
      key: "contacts",
      name: "임차인 · 임대인 전화번호",
      example: "010-1234-5678",
    },
    { key: "share", name: "팀공유 (유 / 무)" },
    { key: "notes", name: "메모", example: "메모: 남향 저층" },
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
  const [live, setLive] = useState("");
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const recRef = useRef<SpeechRec | null>(null);
  const committedRef = useRef("");
  const sessionFinalRef = useRef("");
  const liveRef = useRef("");
  const textRef = useRef("");
  const listeningRef = useRef(false);

  const paintTalk = (committed: string, sessionFinal: string, spokenLive: string) => {
    const locked = absorbCommitted(committed, sessionFinal);
    const next = composeTalkText(committed, sessionFinal, spokenLive);
    committedRef.current = committed;
    sessionFinalRef.current = sessionFinal;
    liveRef.current = spokenLive;
    textRef.current = next;
    setText(locked);
    setLive(liveTail(locked, spokenLive));
  };

  const lockIn = (includeLive: boolean) => {
    let locked = absorbCommitted(committedRef.current, sessionFinalRef.current);
    if (includeLive) locked = absorbCommitted(locked, liveRef.current);
    paintTalk(locked, "", "");
  };

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
      setLive("");
      setError("");
      committedRef.current = "";
      sessionFinalRef.current = "";
      liveRef.current = "";
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
      const spoken = readSpeechResults(ev.results);
      paintTalk(committedRef.current, spoken.sessionFinal, spoken.live);
    };
    rec.onend = () => {
      lockIn(true);
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
      lockIn(true);
      return;
    }
    paintTalk(textRef.current || text, "", "");
    try {
      rec.start();
      setListeningBoth(true);
    } catch {
      setError("마이크를 시작할 수 없습니다.");
    }
  };

  const talkText = [text, live].filter((part) => part.trim()).join(" ");
  const guideHits = talkText
    ? intakeGuideHitsFromText(talkText, kind)
    : {};

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="대화로 입력"
      description="가이드에 따라 대화 해 보세요."
    >
      <ul className="mb-3 space-y-1 rounded-2xl bg-gray-50 px-2 py-2">
        {GUIDE[kind].map((line) => {
          const hit = guideHits[line.key];
          return (
            <li
              key={line.key}
              className={[
                "flex items-baseline",
                hit ? filledSectionClass : "px-2 py-0.5",
              ].join(" ")}
            >
              <span
                className={[
                  "shrink-0 text-[15px] font-bold",
                  hit ? "text-green-800" : "text-gray-800",
                ].join(" ")}
              >
                {line.name}
                {hit || line.example ? ":" : ""}
              </span>
              {hit ? (
                <span className="ml-2.5 text-[13px] font-semibold text-green-700">
                  {hit}
                </span>
              ) : line.example ? (
                <span className="ml-2.5 whitespace-pre text-[13px] font-medium text-gray-500">
                  예) {line.example}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
      <TextArea
        label="대화"
        value={text}
        onChange={(e) => {
          paintTalk(e.target.value, "", "");
        }}
        placeholder="확정된 말이 여기에 쌓입니다"
        className="min-h-[96px]"
      />
      {listening ? (
        <p className="mt-1.5 min-h-[1.25rem] text-[14px] font-medium text-gray-400">
          {live || "말하는 중…"}
        </p>
      ) : null}
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
          disabled={!(text.trim() || live.trim())}
          onClick={() => onApply(textRef.current || text)}
        >
          반영하기
        </Button>
      </div>
    </Modal>
  );
}
