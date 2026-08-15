"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { TextArea } from "@/components/ui/Input";
import type { IntakeKind, IntakeParseResult } from "@/lib/intakeParse";
import {
  INTAKE_GUIDE_STEPS,
  buildIntakeFromSteps,
  flagsStepComplete,
  formatFlagsActiveExample,
  formatFlagsValueLine,
  parseIntakeStepChain,
  splitIntakeStepCancel,
  stepPartialsFromRecords,
  type IntakeStepKey,
} from "@/lib/intakeSteps";
import {
  composeTalkText,
  readSpeechResultsSince,
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
  const [stepLive, setStepLive] = useState("");
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");

  const recRef = useRef<SpeechRec | null>(null);
  const sessionFinalRef = useRef("");
  const listeningRef = useRef(false);
  const activeIndexRef = useRef(0);
  const stepsRef = useRef(steps);

  const resetStepSpeech = useCallback(() => {
    setStepLive("");
    sessionFinalRef.current = "";
  }, []);

  useEffect(() => {
    stepsRef.current = steps;
  }, [steps]);

  useEffect(() => {
    activeIndexRef.current = activeIndex;
    resetStepSpeech();
  }, [activeIndex, resetStepSpeech]);

  const resetWizard = useCallback(() => {
    setActiveIndex(0);
    setSteps({});
    setDialogueLog("");
    resetStepSpeech();
  }, [resetStepSpeech]);

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
      resetStepSpeech();
    },
    [guide, resetStepSpeech]
  );

  const clearStep = useCallback((key: IntakeStepKey) => {
    setSteps((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setStepLive("");
    sessionFinalRef.current = "";
  }, []);

  const processUtterance = useCallback(
    (raw: string, fromSpeech: boolean) => {
      const startIndex = activeIndexRef.current;
      const key = guide[startIndex]?.key;
      if (!key) return false;

      const trimmed = raw.trim();
      if (!trimmed) return false;

      if (key === "notes") {
        const notes = trimmed.replace(/^메모\s*[:：.]?\s*/, "").trim();
        if (!notes) return false;
        if (fromSpeech) appendDialogue(notes);
        commitStep(key, { notes, options: [] }, notes);
        return true;
      }

      const { cancel, remainder } = splitIntakeStepCancel(trimmed);
      if (cancel && !remainder) {
        clearStep(key);
        return true;
      }
      const text = remainder || trimmed;
      const chain = parseIntakeStepChain(
        text,
        startIndex,
        kind,
        stepPartialsFromRecords(stepsRef.current)
      );
      if (chain.commits.length === 0) return false;

      const nextSteps = { ...stepsRef.current };
      for (const row of chain.commits) {
        if (fromSpeech) appendDialogue(row.display || text);
        nextSteps[row.key] = {
          partial: row.partial,
          display: row.display,
          skipped: false,
        };
      }
      stepsRef.current = nextSteps;
      setSteps(nextSteps);
      setActiveIndex(
        chain.nextIndex >= guide.length ? guide.length - 1 : chain.nextIndex
      );
      resetStepSpeech();
      return true;
    },
    [clearStep, commitStep, kind, guide, resetStepSpeech]
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
      const spoken = readSpeechResultsSince(ev.results, 0);
      sessionFinalRef.current = spoken.sessionFinal;
      setStepLive(spoken.live);
    };
    rec.onend = () => {
      const pending = composeTalkText("", sessionFinalRef.current, "").trim();
      resetStepSpeech();
      if (pending) {
        processUtterance(pending, true);
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
  }, [open, processUtterance, resetWizard, resetStepSpeech]);

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
    resetStepSpeech();
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
    resetStepSpeech();
  };

  const jumpToStep = (index: number) => {
    setActiveIndex(index);
    resetStepSpeech();
  };

  const handleApply = () => {
    onApply(buildIntakeFromSteps(stepPartialsFromRecords(steps), kind));
  };

  const hasAnyStep = Object.values(steps).some((row) => row?.display);
  const composedLive = stepLive;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="대화로 입력"
      description="한 번에 여러 항목을 말해도 순서대로 칸에 넣습니다. 앞 칸에 맞지 않는 말은 버려지고, 메모만 그대로 받습니다."
    >
      <ul className="mb-3 space-y-1 rounded-2xl bg-gray-50 px-2 py-2">
        {guide.map((line, index) => {
          const row = steps[line.key];
          const isFlags = line.key === "flags";
          const done = isFlags
            ? flagsStepComplete(row?.partial)
            : Boolean(row?.display);
          const active = index === activeIndex;
          const flagsValues = isFlags
            ? formatFlagsValueLine(row?.partial ?? {})
            : "";
          const flagsExample = isFlags
            ? formatFlagsActiveExample(row?.partial)
            : "";
          return (
            <li
              key={line.key}
              data-testid={`intake-guide-row-${line.key}`}
              className="flex items-baseline gap-1"
            >
              <span
                className={[
                  "w-4 shrink-0 text-center text-[14px] font-bold leading-none",
                  active ? "text-blue-600" : "text-transparent",
                ].join(" ")}
                aria-hidden={!active}
              >
                ▶
              </span>
              <button
                type="button"
                disabled={!done && !active && !flagsValues}
                onClick={() => {
                  if (done || active || flagsValues) jumpToStep(index);
                }}
                aria-current={active ? "step" : undefined}
                className={[
                  "min-w-0 flex-1 text-left",
                  isFlags ? "flex flex-col gap-0.5" : "flex items-baseline",
                  activeRowClass(active, done),
                  done || active || flagsValues
                    ? "cursor-pointer active:scale-[0.99] transition-transform"
                    : "cursor-default",
                ].join(" ")}
              >
                <span
                  className={[
                    "text-[15px] font-bold",
                    done ? "text-green-800" : active ? "text-blue-900" : "text-gray-800",
                    isFlags ? "" : "shrink-0",
                  ].join(" ")}
                >
                  {line.name}
                  {!isFlags && (done || line.example ? ":" : "")}
                </span>
                {isFlags ? (
                  done || flagsValues || active ? (
                    <span
                      className={[
                        "text-[13px] font-semibold",
                        done
                          ? "text-green-700"
                          : active
                            ? "text-blue-700 font-medium"
                            : "text-green-700",
                      ].join(" ")}
                    >
                      {active && composedLive.trim()
                        ? composedLive
                        : flagsValues ||
                          (active && flagsExample ? `예) ${flagsExample}` : "")}
                    </span>
                  ) : (
                    <span className="text-[13px] font-medium text-gray-500">
                      예) {line.example}
                    </span>
                  )
                ) : done ? (
                  <span className="ml-2.5 text-[13px] font-semibold text-green-700">
                    {row?.display}
                  </span>
                ) : active ? (
                  <span
                    className={[
                      "ml-2.5 text-[13px] font-medium text-blue-700",
                      !composedLive.trim() && line.example ? "whitespace-pre" : "",
                    ].join(" ")}
                  >
                    {composedLive.trim()
                      ? composedLive
                      : line.example
                        ? `예) ${line.example}`
                        : null}
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

      <TextArea
        label="대화"
        value={dialogueLog}
        readOnly
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
      {!listening ? (
        <button
          type="button"
          className={[
            "mt-2 inline-flex w-full min-h-[48px] items-center justify-center gap-2 rounded-2xl px-4 py-3 text-[15px] font-semibold",
            "active:scale-95 transition-all duration-150 disabled:opacity-50 disabled:active:scale-100",
            "bg-red-500 text-white hover:bg-red-600",
          ].join(" ")}
          onClick={toggleListen}
          disabled={!recRef.current && Boolean(error)}
        >
          대화 시작
        </button>
      ) : (
        <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1 rounded-2xl border-2 border-red-500 bg-white px-1.5 py-2">
          <button
            type="button"
            disabled={activeIndex === 0}
            onClick={goPrevious}
            className={[
              "inline-flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-xl px-1",
              "text-gray-700 active:scale-95 transition-transform",
              "disabled:opacity-30 disabled:active:scale-100",
            ].join(" ")}
          >
            <span className="text-[20px] font-bold leading-none">&lt;</span>
            <span className="text-[11px] font-semibold leading-none">이전</span>
          </button>
          <button
            type="button"
            onClick={toggleListen}
            className={[
              "inline-flex min-h-[48px] min-w-[96px] items-center justify-center gap-2 rounded-xl px-3",
              "text-[15px] font-semibold text-red-600 active:scale-[0.99] transition-transform",
            ].join(" ")}
          >
            <span
              className="rec-dot-blink h-2.5 w-2.5 shrink-0 rounded-full bg-red-500"
              aria-hidden
            />
            듣는 중
          </button>
          <button
            type="button"
            onClick={skipCurrent}
            className={[
              "inline-flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-xl px-1",
              "text-gray-700 active:scale-95 transition-transform",
            ].join(" ")}
          >
            <span className="text-[20px] font-bold leading-none">&gt;</span>
            <span className="text-[11px] font-semibold leading-none">건너뛰기</span>
          </button>
        </div>
      )}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button variant="secondary" fullWidth onClick={onClose}>
          취소
        </Button>
        <Button
          fullWidth
          disabled={!hasAnyStep}
          onClick={handleApply}
          data-testid="intake-talk-apply"
        >
          반영하기
        </Button>
      </div>
    </Modal>
  );
}
