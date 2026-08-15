"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { TextArea } from "@/components/ui/Input";
import type { IntakeKind, IntakeParseResult } from "@/lib/intakeParse";
import {
  INTAKE_GUIDE_STEPS,
  buildIntakeFromSteps,
  parseIntakeStep,
  priorStepsMerged,
  splitIntakeStepCancel,
  stepPartialsFromRecords,
  type IntakeStepKey,
} from "@/lib/intakeSteps";
import {
  absorbCommitted,
  composeTalkText,
  liveTail,
  readSpeechResults,
} from "@/lib/speechTranscript";
import { filledSectionClass } from "@/lib/uiInvalid";

type StepRecord = {
  partial: Partial<IntakeParseResult>;
  display: string;
  skipped?: boolean;
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

function activeRowClass(active: boolean, done: boolean): string {
  if (active) {
    return "rounded-xl border-2 border-blue-400 bg-blue-50/80 px-2 py-1";
  }
  if (done) return filledSectionClass;
  return "px-2 py-0.5";
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
  onApply: (parsed: IntakeParseResult) => void;
}) {
  const guide = INTAKE_GUIDE_STEPS[kind];
  const [activeIndex, setActiveIndex] = useState(0);
  const [steps, setSteps] = useState<Partial<Record<IntakeStepKey, StepRecord>>>(
    {}
  );
  const [dialogueLog, setDialogueLog] = useState("");
  const [stepDraft, setStepDraft] = useState("");
  const [stepLive, setStepLive] = useState("");
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");

  const recRef = useRef<SpeechRec | null>(null);
  const stepDraftRef = useRef("");
  const sessionFinalRef = useRef("");
  const listeningRef = useRef(false);
  const activeIndexRef = useRef(0);
  const stepsRef = useRef(steps);

  useEffect(() => {
    stepsRef.current = steps;
  }, [steps]);

  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  const resetWizard = useCallback(() => {
    setActiveIndex(0);
    setSteps({});
    setDialogueLog("");
    setStepDraft("");
    setStepLive("");
    stepDraftRef.current = "";
    sessionFinalRef.current = "";
  }, []);

  const appendDialogue = (chunk: string) => {
    const next = chunk.trim();
    if (!next) return;
    setDialogueLog((prev) => (prev.trim() ? `${prev.trim()} ${next}` : next));
  };

  const commitStep = useCallback(
    (key: IntakeStepKey, partial: Partial<IntakeParseResult>, display: string) => {
      setSteps((prev) => ({
        ...prev,
        [key]: { partial, display, skipped: false },
      }));
      const idx = guide.findIndex((line) => line.key === key);
      if (idx >= 0 && idx < guide.length - 1) {
        setActiveIndex(idx + 1);
      }
      setStepDraft("");
      setStepLive("");
      stepDraftRef.current = "";
      sessionFinalRef.current = "";
    },
    [guide]
  );

  const clearStep = useCallback((key: IntakeStepKey) => {
    setSteps((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setStepDraft("");
    setStepLive("");
    stepDraftRef.current = "";
    sessionFinalRef.current = "";
  }, []);

  const processUtterance = useCallback(
    (raw: string, fromSpeech: boolean) => {
      const key = guide[activeIndexRef.current]?.key;
      if (!key) return false;

      const trimmed = raw.trim();
      if (!trimmed) return false;

      if (key !== "notes") {
        const { cancel, remainder } = splitIntakeStepCancel(trimmed);
        if (cancel && !remainder) {
          clearStep(key);
          return true;
        }
        const text = remainder || trimmed;
        const prior = priorStepsMerged(
          stepPartialsFromRecords(stepsRef.current),
          kind,
          activeIndexRef.current
        );
        const parsed = parseIntakeStep(text, key, kind, prior);
        if (parsed.ok) {
          if (fromSpeech) appendDialogue(trimmed);
          commitStep(key, parsed.partial, parsed.display);
          return true;
        }
        if (fromSpeech) {
          stepDraftRef.current = text;
          setStepDraft(text);
        }
        return false;
      }

      const notes = trimmed.replace(/^메모\s*[:：.]?\s*/, "").trim();
      if (!notes) return false;
      if (fromSpeech) appendDialogue(trimmed);
      commitStep(key, { notes, options: [] }, notes);
      return true;
    },
    [clearStep, commitStep, kind, guide]
  );

  const tryAdvanceFromDraft = useCallback(
    (includeLive: boolean) => {
      const composed = composeTalkText(
        stepDraftRef.current,
        sessionFinalRef.current,
        includeLive ? stepLive : ""
      );
      if (!composed.trim()) return;
      processUtterance(composed, false);
    },
    [processUtterance, stepLive]
  );

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
      resetWizard();
      setError("");
      return;
    }
    resetWizard();
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
      sessionFinalRef.current = spoken.sessionFinal;
      setStepLive(spoken.live);
      const composed = composeTalkText(
        stepDraftRef.current,
        spoken.sessionFinal,
        spoken.live
      );
      if (spoken.sessionFinal.trim()) {
        processUtterance(composed, true);
      }
    };
    rec.onend = () => {
      const locked = absorbCommitted(stepDraftRef.current, sessionFinalRef.current);
      stepDraftRef.current = locked;
      setStepDraft(locked);
      sessionFinalRef.current = "";
      setStepLive("");
      if (locked.trim()) {
        processUtterance(locked, false);
      }
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
  }, [open, processUtterance, resetWizard]);

  const toggleListen = () => {
    const rec = recRef.current;
    if (!rec) return;
    setError("");
    if (listeningRef.current) {
      setListeningBoth(false);
      rec.stop();
      return;
    }
    try {
      rec.start();
      setListeningBoth(true);
    } catch {
      setError("마이크를 시작할 수 없습니다.");
    }
  };

  const goPrevious = () => {
    setActiveIndex((idx) => Math.max(0, idx - 1));
    setStepDraft("");
    setStepLive("");
    stepDraftRef.current = "";
    sessionFinalRef.current = "";
  };

  const skipCurrent = () => {
    const key = guide[activeIndex]?.key;
    if (!key) return;
    setSteps((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    if (activeIndex < guide.length - 1) {
      setActiveIndex((idx) => idx + 1);
    }
    setStepDraft("");
    setStepLive("");
    stepDraftRef.current = "";
    sessionFinalRef.current = "";
  };

  const jumpToStep = (index: number) => {
    setActiveIndex(index);
    setStepDraft("");
    setStepLive("");
    stepDraftRef.current = "";
    sessionFinalRef.current = "";
  };

  const handleApply = () => {
    onApply(buildIntakeFromSteps(stepPartialsFromRecords(steps), kind));
  };

  const hasAnyStep = Object.values(steps).some((row) => row?.display);
  const activeKey = guide[activeIndex]?.key;
  const composedLive = liveTail(stepDraft, stepLive);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="대화로 입력"
      description="안내 순서대로 말해 주세요. 인식되면 자동으로 다음 항목으로 넘어갑니다."
    >
      <ul className="mb-3 space-y-1 rounded-2xl bg-gray-50 px-2 py-2">
        {guide.map((line, index) => {
          const row = steps[line.key];
          const done = Boolean(row?.display);
          const active = index === activeIndex;
          return (
            <li key={line.key}>
              <button
                type="button"
                disabled={!done && !active}
                onClick={() => {
                  if (done || active) jumpToStep(index);
                }}
                className={[
                  "flex w-full items-baseline text-left",
                  activeRowClass(active, done),
                  done || active
                    ? "cursor-pointer active:scale-[0.99] transition-transform"
                    : "cursor-default",
                ].join(" ")}
              >
                <span
                  className={[
                    "shrink-0 text-[15px] font-bold",
                    done ? "text-green-800" : active ? "text-blue-900" : "text-gray-800",
                  ].join(" ")}
                >
                  {line.name}
                  {done || line.example ? ":" : ""}
                </span>
                {done ? (
                  <span className="ml-2.5 text-[13px] font-semibold text-green-700">
                    {row?.display}
                  </span>
                ) : active ? (
                  <span className="ml-2.5 text-[13px] font-medium text-blue-700">
                    {composedLive.trim() ? composedLive : "지금 말씀해 주세요"}
                  </span>
                ) : line.example ? (
                  <span className="ml-2.5 whitespace-pre text-[13px] font-medium text-gray-500">
                    예) {line.example}
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mb-2 grid grid-cols-2 gap-2">
        <Button
          variant="secondary"
          fullWidth
          disabled={activeIndex === 0}
          onClick={goPrevious}
        >
          이전
        </Button>
        <Button variant="secondary" fullWidth onClick={skipCurrent}>
          건너뛰기
        </Button>
      </div>

      <TextArea
        label="대화"
        value={dialogueLog}
        onChange={(e) => {
          setDialogueLog(e.target.value);
          if (activeKey === "notes") {
            processUtterance(e.target.value, false);
          }
        }}
        placeholder="확정된 말이 여기에 쌓입니다"
        className="min-h-[72px]"
      />
      {listening ? (
        <p className="mt-1.5 min-h-[1.25rem] text-[14px] font-medium text-gray-400">
          {composedLive || "말하는 중…"}
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
        <Button fullWidth disabled={!hasAnyStep} onClick={handleApply}>
          반영하기
        </Button>
      </div>
    </Modal>
  );
}
