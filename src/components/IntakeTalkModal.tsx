"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { TextArea } from "@/components/ui/Input";
import type { IntakeKind, IntakeParseResult } from "@/lib/intakeParse";
import {
  INTAKE_GUIDE_STEPS,
  buildIntakeFromSteps,
  buildFlagsProgressParts,
  firstIncompleteGuideIndex,
  flagsStepComplete,
  formatFlagsActiveExample,
  formatFlagsValueLine,
  parseIntakeStepChain,
  splitIntakeStepCancel,
  stepPartialsFromRecords,
  type IntakeStepKey,
} from "@/lib/intakeSteps";
import {
  absorbCommitted,
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

function activeRowClass(active: boolean, filled: boolean): string {
  if (active) {
    return "rounded-xl border-2 border-blue-400 bg-blue-50/80 px-2 py-1";
  }
  if (filled) return filledSectionClass;
  return "px-2 py-0.5";
}

function buildDialogueLogForKind(
  kind: IntakeKind,
  steps: Partial<Record<IntakeStepKey, StepRecord>>
): string {
  return INTAKE_GUIDE_STEPS[kind]
    .map((line) => steps[line.key]?.display)
    .filter(Boolean)
    .join(" ");
}

function composeDialogueDisplay(confirmed: string, preview: string): string {
  const parts = [confirmed.trim(), preview.trim()].filter(Boolean);
  return parts.join(" ");
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
  const [dialoguePreview, setDialoguePreview] = useState("");
  const [stepLive, setStepLive] = useState("");
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const [speechSupported, setSpeechSupported] = useState(true);

  const recRef = useRef<SpeechRec | null>(null);
  const sessionFinalRef = useRef("");
  const stepSpeechRef = useRef("");
  const processedResultIndexRef = useRef(0);
  const listeningRef = useRef(false);
  const activeIndexRef = useRef(0);
  const stepsRef = useRef(steps);
  const processUtteranceRef = useRef<(raw: string) => boolean>(() => false);

  const resetStepSpeech = useCallback(() => {
    setStepLive("");
    setDialoguePreview("");
    sessionFinalRef.current = "";
  }, []);

  const clearStepSpeechBuffer = useCallback(() => {
    stepSpeechRef.current = "";
  }, []);

  const clearSpeechAfterCommit = useCallback(() => {
    setStepLive("");
    setDialoguePreview("");
    sessionFinalRef.current = "";
  }, []);

  const syncDialogueLog = useCallback(
    (nextSteps: Partial<Record<IntakeStepKey, StepRecord>>) => {
      setDialogueLog(buildDialogueLogForKind(kind, nextSteps));
    },
    [kind]
  );

  useEffect(() => {
    stepsRef.current = steps;
  }, [steps]);

  useEffect(() => {
    activeIndexRef.current = activeIndex;
    resetStepSpeech();
    clearStepSpeechBuffer();
  }, [activeIndex, clearStepSpeechBuffer, resetStepSpeech]);

  const resetWizard = useCallback(() => {
    setActiveIndex(0);
    setSteps({});
    setDialogueLog("");
    setDialoguePreview("");
    stepSpeechRef.current = "";
    processedResultIndexRef.current = 0;
    resetStepSpeech();
  }, [resetStepSpeech]);

  const commitStep = useCallback(
    (key: IntakeStepKey, partial: Partial<IntakeParseResult>, display: string) => {
      setSteps((prev) => {
        const next = {
          ...prev,
          [key]: { partial, display, skipped: false },
        };
        syncDialogueLog(next);
        return next;
      });
      const idx = guide.findIndex((line) => line.key === key);
      if (idx >= 0 && idx < guide.length - 1) {
        setActiveIndex(idx + 1);
      }
      clearStepSpeechBuffer();
      if (listeningRef.current) {
        clearSpeechAfterCommit();
      } else {
        resetStepSpeech();
      }
    },
    [clearSpeechAfterCommit, clearStepSpeechBuffer, guide, resetStepSpeech, syncDialogueLog]
  );

  const applySteps = useCallback(
    (
      nextSteps: Partial<Record<IntakeStepKey, StepRecord>>,
      nextIndex: number,
      fromIndex: number
    ) => {
      stepsRef.current = nextSteps;
      setSteps(nextSteps);
      syncDialogueLog(nextSteps);
      setActiveIndex(
        nextIndex >= guide.length ? guide.length - 1 : nextIndex
      );
      const fromKey = guide[fromIndex]?.key;
      const flagsDone =
        fromKey === "flags" && flagsStepComplete(nextSteps.flags?.partial);
      if (fromKey === "flags" && !flagsDone) {
        if (listeningRef.current) {
          clearSpeechAfterCommit();
        } else {
          resetStepSpeech();
        }
        return;
      }
      clearStepSpeechBuffer();
      if (listeningRef.current) {
        clearSpeechAfterCommit();
      } else {
        resetStepSpeech();
      }
    },
    [clearSpeechAfterCommit, clearStepSpeechBuffer, guide, resetStepSpeech, syncDialogueLog]
  );

  const clearStep = useCallback(
    (key: IntakeStepKey) => {
      setSteps((prev) => {
        const next = { ...prev };
        delete next[key];
        syncDialogueLog(next);
        return next;
      });
      setStepLive("");
      sessionFinalRef.current = "";
      clearStepSpeechBuffer();
    },
    [clearStepSpeechBuffer, syncDialogueLog]
  );

  const processUtterance = useCallback(
    (raw: string) => {
      const startIndex = activeIndexRef.current;
      const key = guide[startIndex]?.key;
      if (!key) return false;

      const trimmed = raw.trim();
      if (!trimmed) return false;

      if (key === "notes") {
        const notes = trimmed.replace(/^메모\s*[:：.]?\s*/, "").trim();
        if (!notes) return false;
        commitStep(key, { notes, options: [] }, notes);
        return true;
      }

      const { cancel, remainder } = splitIntakeStepCancel(trimmed);
      if (cancel && !remainder) {
        clearStep(key);
        clearStepSpeechBuffer();
        return true;
      }
      const piece = remainder || trimmed;
      stepSpeechRef.current = absorbCommitted(stepSpeechRef.current, piece);
      const text = stepSpeechRef.current;
      const chain = parseIntakeStepChain(
        text,
        startIndex,
        kind,
        stepPartialsFromRecords(stepsRef.current)
      );
      if (chain.commits.length === 0) return false;

      const nextSteps = { ...stepsRef.current };
      for (const row of chain.commits) {
        nextSteps[row.key] = {
          partial: row.partial,
          display: row.display,
          skipped: false,
        };
      }
      applySteps(nextSteps, chain.nextIndex, startIndex);
      return true;
    },
    [applySteps, clearStep, clearStepSpeechBuffer, commitStep, kind, guide]
  );

  const flushSpeechPreview = useCallback(
    (
      results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>,
      live: string
    ) => {
      let pendingFinal = "";
      for (
        let i = processedResultIndexRef.current;
        i < results.length;
        i += 1
      ) {
        const row = results[i];
        if (!row?.isFinal) continue;
        const piece = (row[0]?.transcript ?? "").replace(/\s+/g, " ").trim();
        if (piece) {
          pendingFinal = absorbCommitted(pendingFinal, piece);
        }
      }
      setDialoguePreview(composeTalkText("", pendingFinal, live));
    },
    []
  );

  const processNewFinalResults = useCallback(
    (
      results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>
    ) => {
      for (
        let i = processedResultIndexRef.current;
        i < results.length;
        i += 1
      ) {
        const row = results[i];
        if (!row?.isFinal) continue;
        const piece = (row[0]?.transcript ?? "").replace(/\s+/g, " ").trim();
        if (piece) {
          if (processUtteranceRef.current(piece)) {
            processedResultIndexRef.current = i + 1;
          }
        }
      }
    },
    []
  );

  useEffect(() => {
    processUtteranceRef.current = processUtterance;
  }, [processUtterance]);

  const setListeningBoth = (next: boolean) => {
    listeningRef.current = next;
    setListening(next);
  };

  const stopRecognition = useCallback(() => {
    const rec = recRef.current;
    recRef.current = null;
    rec?.stop();
  }, []);

  const buildRecognition = useCallback((): SpeechRec | null => {
    const rec = getSpeechRecognition();
    if (!rec) return null;
    rec.lang = "ko-KR";
    rec.interimResults = true;
    rec.continuous = true;
    rec.onresult = (ev) => {
      const spoken = readSpeechResultsSince(ev.results, 0);
      sessionFinalRef.current = spoken.sessionFinal;
      setStepLive(spoken.live);
      flushSpeechPreview(ev.results, spoken.live);
      processNewFinalResults(ev.results);
    };
    rec.onend = () => {
      resetStepSpeech();
      processedResultIndexRef.current = 0;
      if (!listeningRef.current) return;
      const fresh = buildRecognition();
      if (!fresh) {
        setListeningBoth(false);
        setError("마이크를 시작할 수 없습니다.");
        return;
      }
      recRef.current = fresh;
      try {
        fresh.start();
      } catch {
        recRef.current = null;
        setListeningBoth(false);
        setError("마이크를 시작할 수 없습니다.");
      }
    };
    rec.onerror = (ev) => {
      if (ev?.error === "aborted" || ev?.error === "no-speech") return;
      stopRecognition();
      setListeningBoth(false);
      setError("말을 인식하지 못했습니다. 다시 눌러 주세요.");
    };
    return rec;
  }, [flushSpeechPreview, processNewFinalResults, resetStepSpeech, stopRecognition]);

  useEffect(() => {
    if (!open) {
      listeningRef.current = false;
      stopRecognition();
      setListening(false);
      resetWizard();
      setError("");
      return;
    }
    resetWizard();
    const supported = Boolean(getSpeechRecognition());
    setSpeechSupported(supported);
    if (!supported) {
      setError("이 브라우저에서는 대화를 쓸 수 없습니다. 메시지로 입력해 주세요.");
    }
  }, [open, resetWizard, resetStepSpeech, stopRecognition]);

  const startListening = () => {
    setError("");
    const resumeIndex = firstIncompleteGuideIndex(kind, stepsRef.current);
    setActiveIndex(resumeIndex);
    activeIndexRef.current = resumeIndex;
    resetStepSpeech();
    clearStepSpeechBuffer();
    processedResultIndexRef.current = 0;
    stopRecognition();
    const rec = buildRecognition();
    if (!rec) {
      setError("마이크를 시작할 수 없습니다.");
      return;
    }
    recRef.current = rec;
    try {
      rec.start();
      setListeningBoth(true);
    } catch {
      recRef.current = null;
      setError("마이크를 시작할 수 없습니다.");
    }
  };

  const toggleListen = () => {
    if (listeningRef.current) {
      setListeningBoth(false);
      stopRecognition();
      return;
    }
    startListening();
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
      syncDialogueLog(next);
      return next;
    });
    if (activeIndex < guide.length - 1) {
      setActiveIndex((idx) => idx + 1);
    }
    resetStepSpeech();
    clearStepSpeechBuffer();
  };

  const handleApply = () => {
    onApply(buildIntakeFromSteps(stepPartialsFromRecords(steps), kind));
  };

  const hasAnyStep = Object.values(steps).some((row) => row?.display);
  const hasProgress = hasAnyStep || activeIndex > 0;
  const composedLive = stepLive;
  const dialogueDisplay = composeDialogueDisplay(dialogueLog, dialoguePreview);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="대화로 입력"
      description="순서대로 마이크에 입력하세요."
      dense
      className="max-h-[min(92dvh,720px)]"
      footer={
        <div className="space-y-2">
          {listening ? (
            <p className="min-h-[1.25rem] break-words text-center text-[14px] font-medium text-gray-400">
              {composedLive || "듣는 중…"}
            </p>
          ) : null}
          {error ? (
            <p className="text-center text-[12px] font-semibold text-red-400">{error}</p>
          ) : null}
          {listening ? (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={activeIndex === 0}
                onClick={goPrevious}
                className={[
                  "inline-flex min-h-[44px] items-center justify-center gap-1 rounded-xl border border-gray-200 bg-white px-2",
                  "text-[14px] font-semibold text-gray-700 active:scale-95 transition-transform",
                  "disabled:opacity-30 disabled:active:scale-100",
                ].join(" ")}
              >
                <span className="text-[16px] font-bold leading-none">&lt;</span>
                이전
              </button>
              <button
                type="button"
                onClick={skipCurrent}
                className={[
                  "inline-flex min-h-[44px] items-center justify-center gap-1 rounded-xl border border-gray-200 bg-white px-2",
                  "text-[14px] font-semibold text-gray-700 active:scale-95 transition-transform",
                ].join(" ")}
              >
                건너뛰기
                <span className="text-[16px] font-bold leading-none">&gt;</span>
              </button>
            </div>
          ) : null}
          <button
            type="button"
            className={[
              "inline-flex w-full min-h-[48px] items-center justify-center gap-2 rounded-2xl px-4 py-3 text-[15px] font-semibold",
              "active:scale-95 transition-all duration-150 disabled:opacity-50 disabled:active:scale-100",
              listening
                ? "border-2 border-red-500 bg-white text-red-600"
                : "bg-red-500 text-white hover:bg-red-600",
            ].join(" ")}
            onClick={toggleListen}
            disabled={!speechSupported}
          >
            {listening ? (
              <>
                <span className="inline-flex items-center gap-0.5" aria-hidden>
                  <span className="h-3.5 w-1 rounded-sm bg-red-500" />
                  <span className="h-3.5 w-1 rounded-sm bg-red-500" />
                </span>
                일시정지
              </>
            ) : hasProgress ? (
              "계속"
            ) : (
              "대화 시작"
            )}
          </button>
          <div className="grid grid-cols-2 gap-2">
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
        </div>
      }
    >
      <ul className="mb-2 space-y-0.5 rounded-2xl bg-gray-50 px-2 py-1.5">
        {guide.map((line, index) => {
          const row = steps[line.key];
          const isFlags = line.key === "flags";
          const done = isFlags
            ? flagsStepComplete(row?.partial)
            : Boolean(row?.display);
          const flagsValues = isFlags
            ? formatFlagsValueLine(row?.partial ?? {})
            : "";
          const filled = done;
          const active = index === activeIndex;
          const flagsExample = isFlags
            ? formatFlagsActiveExample(row?.partial)
            : "";
          const showFlagsProgress = isFlags && !done;
          const stackValue = isFlags && done && Boolean(flagsValues);
          const showColon =
            !isFlags && (done || active || Boolean(line.example));
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
              <div
                aria-current={active ? "step" : undefined}
                className={[
                  "min-w-0 flex-1 text-left",
                  stackValue || showFlagsProgress
                    ? "flex flex-col gap-0.5"
                    : "flex min-w-0 items-baseline gap-2",
                  activeRowClass(active, filled),
                ].join(" ")}
              >
                <span
                  className={[
                    "text-[15px] font-bold leading-snug",
                    done ? "text-green-800" : active ? "text-blue-900" : "text-gray-800",
                    stackValue || showFlagsProgress ? "" : "shrink-0",
                  ].join(" ")}
                >
                  {line.name}
                  {showColon ? ":" : ""}
                </span>
                {isFlags && showFlagsProgress ? (
                  <div
                    className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[13px] leading-snug"
                    data-testid="intake-flags-progress"
                  >
                    {buildFlagsProgressParts(row?.partial).map((part, partIndex) => (
                      <span
                        key={part.field}
                        className="inline-flex items-center gap-x-1.5"
                      >
                        {partIndex > 0 ? (
                          <span className="text-gray-300" aria-hidden>
                            ·
                          </span>
                        ) : null}
                        <span
                          className={[
                            part.filled
                              ? "font-semibold text-green-700"
                              : active
                                ? "font-semibold text-red-500"
                                : "font-medium text-gray-400",
                          ].join(" ")}
                        >
                          {part.text}
                        </span>
                      </span>
                    ))}
                    {active && composedLive.trim() ? (
                      <>
                        <span className="text-gray-300" aria-hidden>
                          ·
                        </span>
                        <span className="min-w-0 font-medium text-blue-600">
                          {composedLive}
                        </span>
                      </>
                    ) : null}
                  </div>
                ) : isFlags && stackValue ? (
                  <span
                    className={[
                      "min-w-0 break-words text-[13px] leading-snug",
                      done
                        ? "font-semibold text-green-700"
                        : "font-semibold text-blue-700",
                    ].join(" ")}
                  >
                    {active && composedLive.trim()
                      ? [flagsValues, composedLive].filter(Boolean).join(" · ")
                      : flagsValues}
                  </span>
                ) : isFlags ? (
                  <span
                    className={[
                      "min-w-0 truncate text-[13px] leading-snug",
                      active
                        ? "font-medium text-blue-700"
                        : "font-medium text-gray-500",
                    ].join(" ")}
                  >
                    {active && composedLive.trim()
                      ? composedLive
                      : active && flagsExample
                        ? `예) ${flagsExample}`
                        : line.example
                          ? `예) ${line.example}`
                          : null}
                  </span>
                ) : done || active ? (
                  <span
                    className={[
                      "min-w-0 truncate text-[13px] leading-snug",
                      done
                        ? "font-semibold text-green-700"
                        : "font-medium text-blue-700",
                    ].join(" ")}
                  >
                    {done
                      ? row?.display
                      : composedLive.trim()
                        ? composedLive
                        : line.example
                          ? `예) ${line.example}`
                          : null}
                  </span>
                ) : line.example ? (
                  <span className="min-w-0 truncate text-[13px] font-medium leading-snug text-gray-500">
                    예) {line.example}
                  </span>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      <TextArea
        label="대화"
        value={dialogueDisplay}
        readOnly
        placeholder="확정된 말이 여기에 쌓입니다"
        className="min-h-[56px]"
      />
    </Modal>
  );
}
