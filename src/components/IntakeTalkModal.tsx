"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import type { DealType } from "@/lib/types";
import type { IntakeKind, IntakeParseResult } from "@/lib/intakeParse";
import { applyDealTypeToMoney, isDealMoneyCleared } from "@/lib/dealTypeMoney";
import { intakeGuideHits } from "@/lib/intakeGuideHits";
import {
  INTAKE_GUIDE_STEPS,
  allGuideStepsComplete,
  buildIntakeFromSteps,
  buildFlagsProgressParts,
  flagsStepComplete,
  formatFlagsActiveExample,
  formatFlagsValueLine,
  guideStepComplete,
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
import {
  applyNotesUtterance,
  TALK_IDLE_MS,
  TALK_LOCATION_HOLD_MS,
  TALK_STOP_HINT,
  talkPrimaryKind,
  talkPrimaryLabel,
} from "@/lib/talkSession";

type StepRecord = {
  partial: Partial<IntakeParseResult>;
  display: string;
  skipped?: boolean;
  complete?: boolean;
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
  const box = "rounded-xl border p-2";
  if (filled) return `${box} border-green-400 bg-green-50`;
  if (active) return `${box} border-blue-400 bg-blue-50/80`;
  return `${box} border-transparent bg-transparent`;
}

function navStepButtonClass(disabled = false): string {
  return [
    "inline-flex h-12 box-border items-center justify-center gap-0.5 rounded-xl border border-gray-200 bg-white px-1.5",
    "text-[12px] font-semibold leading-none text-gray-700 active:scale-95 transition-transform",
    disabled ? "opacity-30 active:scale-100" : "",
  ].join(" ");
}

const MIC_LEVEL_WEIGHTS = [0.35, 0.65, 1, 0.65, 0.35];

function ListeningMicMeter({ live }: { live: string }) {
  const barsRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let raf = 0;
    let tick = 0;
    const talking = live.trim().length > 0;
    const paint = () => {
      tick += talking ? 0.22 : 0.08;
      const pulse = talking
        ? 0.4 + 0.6 * Math.abs(Math.sin(tick))
        : 0.08 + 0.1 * Math.abs(Math.sin(tick));
      const nodes = barsRef.current?.children;
      if (nodes) {
        for (let i = 0; i < nodes.length; i += 1) {
          const el = nodes[i] as HTMLElement;
          const weight = MIC_LEVEL_WEIGHTS[i] ?? 1;
          el.style.height = `${3 + Math.round(pulse * 13 * weight)}px`;
        }
      }
      raf = requestAnimationFrame(paint);
    };
    paint();
    return () => cancelAnimationFrame(raf);
  }, [live]);

  return (
    <span className="inline-flex items-end gap-1" aria-hidden>
      <svg viewBox="0 0 16 16" className="h-4 w-4 text-red-500" fill="currentColor">
        <path d="M8 1.5a2.25 2.25 0 0 0-2.25 2.25v4a2.25 2.25 0 1 0 4.5 0v-4A2.25 2.25 0 0 0 8 1.5Z" />
        <path d="M4.25 7.25a.75.75 0 0 0-1.5 0 5.25 5.25 0 0 0 4.5 5.196V14h-1.5a.75.75 0 0 0 0 1.5h4.5a.75.75 0 0 0 0-1.5h-1.5v-1.554A5.25 5.25 0 0 0 13.25 7.25a.75.75 0 0 0-1.5 0 3.75 3.75 0 1 1-7.5 0Z" />
      </svg>
      <span
        ref={barsRef}
        className="inline-flex h-4 w-4 items-end justify-center gap-px"
      >
        {MIC_LEVEL_WEIGHTS.map((_, i) => (
          <span
            key={i}
            className="w-[2px] rounded-full bg-red-400"
            style={{ height: 3 }}
          />
        ))}
      </span>
    </span>
  );
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
  const [stepLive, setStepLive] = useState("");
  const [listening, setListening] = useState(false);
  const [talkStarted, setTalkStarted] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");
  const [error, setError] = useState("");
  const [speechSupported, setSpeechSupported] = useState(true);

  const recRef = useRef<SpeechRec | null>(null);
  const sessionFinalRef = useRef("");
  const stepSpeechRef = useRef("");
  const notesDraftRef = useRef("");
  const processedResultIndexRef = useRef(0);
  const listeningRef = useRef(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const locationHoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const activeIndexRef = useRef(0);
  const stepsRef = useRef(steps);
  const processUtteranceRef = useRef<(raw: string) => boolean>(() => false);
  const scheduleLocationHoldRef = useRef<() => void>(() => {});
  const heardCommittedRef = useRef(false);
  const lastDealTypeRef = useRef<DealType | "">("");

  const resetStepSpeech = useCallback(() => {
    setStepLive("");
    sessionFinalRef.current = "";
  }, []);

  const clearStepSpeechBuffer = useCallback(() => {
    stepSpeechRef.current = "";
  }, []);

  const setNotesDraftBoth = useCallback((next: string) => {
    notesDraftRef.current = next;
    setNotesDraft(next);
  }, []);

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
    setTalkStarted(false);
    setNotesDraftBoth("");
    stepSpeechRef.current = "";
    processedResultIndexRef.current = 0;
    heardCommittedRef.current = false;
    lastDealTypeRef.current = "";
    resetStepSpeech();
  }, [resetStepSpeech, setNotesDraftBoth]);

  const clearLocationHoldTimer = useCallback(() => {
    if (locationHoldTimerRef.current == null) return;
    clearTimeout(locationHoldTimerRef.current);
    locationHoldTimerRef.current = null;
  }, []);

  const scheduleLocationHoldAdvance = useCallback(() => {
    clearLocationHoldTimer();
    if (kind !== "customer") return;
    if (!listeningRef.current) return;
    const idx = activeIndexRef.current;
    if (guide[idx]?.key !== "location") return;
    const rec = stepsRef.current.location;
    if (!rec?.display || rec.skipped) return;
    locationHoldTimerRef.current = setTimeout(() => {
      locationHoldTimerRef.current = null;
      if (!listeningRef.current) return;
      if (guide[activeIndexRef.current]?.key !== "location") return;
      const held = stepsRef.current.location;
      if (!held?.display || held.skipped) return;
      if (activeIndexRef.current >= guide.length - 1) return;
      const next = activeIndexRef.current + 1;
      activeIndexRef.current = next;
      setActiveIndex(next);
    }, TALK_LOCATION_HOLD_MS);
  }, [clearLocationHoldTimer, guide, kind]);

  useEffect(() => {
    scheduleLocationHoldRef.current = scheduleLocationHoldAdvance;
  }, [scheduleLocationHoldAdvance]);

  const applySteps = useCallback(
    (
      nextSteps: Partial<Record<IntakeStepKey, StepRecord>>,
      nextIndex: number,
      fromIndex: number
    ) => {
      stepsRef.current = nextSteps;
      setSteps(nextSteps);
      const fromKey = guide[fromIndex]?.key;
      const flagsDone =
        fromKey === "flags" && flagsStepComplete(nextSteps.flags?.partial);
      if (fromKey === "flags" && !flagsDone) {
        resetStepSpeech();
        return;
      }
      if (nextIndex === fromIndex) {
        resetStepSpeech();
        if (fromKey === "location") scheduleLocationHoldAdvance();
        return;
      }
      clearLocationHoldTimer();
      const clamped =
        nextIndex >= guide.length ? guide.length - 1 : nextIndex;
      activeIndexRef.current = clamped;
      setActiveIndex(clamped);
      clearStepSpeechBuffer();
      resetStepSpeech();
    },
    [
      clearLocationHoldTimer,
      clearStepSpeechBuffer,
      guide,
      resetStepSpeech,
      scheduleLocationHoldAdvance,
    ]
  );

  const clearStep = useCallback(
    (key: IntakeStepKey) => {
      if (key === "location") clearLocationHoldTimer();
      setSteps((prev) => {
        const next = { ...prev };
        delete next[key];
        stepsRef.current = next;
        return next;
      });
      if (key === "notes") setNotesDraftBoth("");
      setStepLive("");
      sessionFinalRef.current = "";
      clearStepSpeechBuffer();
    },
    [clearLocationHoldTimer, clearStepSpeechBuffer, setNotesDraftBoth]
  );

  const processUtterance = useCallback(
    (raw: string) => {
      const startIndex = activeIndexRef.current;
      const key = guide[startIndex]?.key;
      if (!key) return false;

      const trimmed = raw.trim();
      if (!trimmed) return false;

      if (key === "notes") {
        const base =
          notesDraftRef.current || stepsRef.current.notes?.display || "";
        const next = applyNotesUtterance(base, trimmed);
        if (next.clear) {
          heardCommittedRef.current = true;
          setNotesDraftBoth("");
          if (guideStepComplete("notes", stepsRef.current.notes)) {
            clearStep(key);
          }
          return true;
        }
        if (next.draft === base && !next.draft) return false;
        heardCommittedRef.current = true;
        setNotesDraftBoth(next.draft);
        return true;
      }

      const { cancel, remainder } = splitIntakeStepCancel(trimmed);
      if (cancel && !remainder) {
        heardCommittedRef.current = true;
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

      heardCommittedRef.current = true;
      const nextSteps = { ...stepsRef.current };
      for (const row of chain.commits) {
        nextSteps[row.key] = {
          partial: row.partial,
          display: row.display,
          skipped: false,
        };
      }
      const dealCommit = chain.commits.find((row) => row.key === "dealType");
      if (dealCommit) {
        const prevDeal = lastDealTypeRef.current;
        const nextDeal = dealCommit.partial.dealType ?? "";
        lastDealTypeRef.current = nextDeal;
        const moneyAlsoCommitted = chain.commits.some((row) => row.key === "money");
        const moneyPartial = nextSteps.money?.partial;
        if (
          !moneyAlsoCommitted &&
          moneyPartial &&
          (moneyPartial.deposit || moneyPartial.monthlyRent)
        ) {
          const money = applyDealTypeToMoney(prevDeal, nextDeal, {
            deposit: moneyPartial.deposit ?? 0,
            depositTo: moneyPartial.depositTo ?? moneyPartial.deposit ?? 0,
            monthlyRent: moneyPartial.monthlyRent ?? 0,
            monthlyRentTo:
              moneyPartial.monthlyRentTo ?? moneyPartial.monthlyRent ?? 0,
          });
          if (isDealMoneyCleared(money)) {
            delete nextSteps.money;
          } else {
            const partial: Partial<IntakeParseResult> = {
              ...moneyPartial,
              deposit: money.deposit || undefined,
              depositTo:
                money.depositTo && money.depositTo !== money.deposit
                  ? money.depositTo
                  : undefined,
              monthlyRent: money.monthlyRent || undefined,
              monthlyRentTo:
                money.monthlyRentTo && money.monthlyRentTo !== money.monthlyRent
                  ? money.monthlyRentTo
                  : undefined,
              dealType: nextDeal || moneyPartial.dealType,
            };
            nextSteps.money = {
              partial,
              display:
                intakeGuideHits(
                  { options: [], notes: "", ...partial },
                  kind
                ).money ?? nextSteps.money?.display ?? "",
              skipped: false,
            };
          }
        }
      }
      applySteps(nextSteps, chain.nextIndex, startIndex);
      return true;
    },
    [
      applySteps,
      clearStep,
      clearStepSpeechBuffer,
      kind,
      guide,
      setNotesDraftBoth,
    ]
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
          } else {
            scheduleLocationHoldRef.current();
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

  const clearIdleTimer = useCallback(() => {
    if (idleTimerRef.current == null) return;
    clearTimeout(idleTimerRef.current);
    idleTimerRef.current = null;
  }, []);

  const stopRecognition = useCallback(() => {
    const rec = recRef.current;
    recRef.current = null;
    rec?.stop();
  }, []);

  const haltListening = useCallback(() => {
    setListeningBoth(false);
    stopRecognition();
    clearIdleTimer();
    clearLocationHoldTimer();
    processedResultIndexRef.current = 0;
    resetStepSpeech();
  }, [clearIdleTimer, clearLocationHoldTimer, resetStepSpeech, stopRecognition]);

  const stopCurrentTake = useCallback(() => {
    haltListening();
    const key = guide[activeIndexRef.current]?.key;
    if (key) clearStep(key);
  }, [clearStep, guide, haltListening]);

  const bumpIdleTimer = useCallback(() => {
    clearIdleTimer();
    if (!listeningRef.current) return;
    idleTimerRef.current = setTimeout(() => {
      if (!listeningRef.current) return;
      stopCurrentTake();
    }, TALK_IDLE_MS);
  }, [clearIdleTimer, stopCurrentTake]);

  const buildRecognition = useCallback((): SpeechRec | null => {
    const rec = getSpeechRecognition();
    if (!rec) return null;
    rec.lang = "ko-KR";
    rec.interimResults = true;
    rec.continuous = true;
    rec.onresult = (ev) => {
      const spoken = readSpeechResultsSince(ev.results, 0);
      if (spoken.sessionFinal || spoken.live) bumpIdleTimer();
      sessionFinalRef.current = spoken.sessionFinal;
      setStepLive(spoken.live);
      processNewFinalResults(ev.results);
      if (spoken.live) scheduleLocationHoldAdvance();
    };
    rec.onend = () => {
      resetStepSpeech();
      processedResultIndexRef.current = 0;
      if (!listeningRef.current) return;
      const fresh = buildRecognition();
      if (!fresh) {
        haltListening();
        setError("마이크를 시작할 수 없습니다.");
        return;
      }
      recRef.current = fresh;
      try {
        fresh.start();
      } catch {
        recRef.current = null;
        haltListening();
        setError("마이크를 시작할 수 없습니다.");
      }
    };
    rec.onerror = (ev) => {
      if (ev?.error === "aborted" || ev?.error === "no-speech") return;
      haltListening();
      setError("말을 인식하지 못했습니다. 다시 눌러 주세요.");
    };
    return rec;
  }, [
    bumpIdleTimer,
    haltListening,
    processNewFinalResults,
    resetStepSpeech,
    scheduleLocationHoldAdvance,
  ]);

  useEffect(() => {
    if (!open) {
      listeningRef.current = false;
      stopRecognition();
      clearIdleTimer();
      clearLocationHoldTimer();
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
  }, [
    open,
    resetWizard,
    resetStepSpeech,
    stopRecognition,
    clearIdleTimer,
    clearLocationHoldTimer,
  ]);

  useEffect(() => {
    const hideMic = () => {
      if (!listeningRef.current) return;
      stopCurrentTake();
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") hideMic();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", hideMic);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", hideMic);
    };
  }, [stopCurrentTake]);

  useEffect(() => {
    return () => {
      listeningRef.current = false;
      if (idleTimerRef.current != null) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
      if (locationHoldTimerRef.current != null) {
        clearTimeout(locationHoldTimerRef.current);
        locationHoldTimerRef.current = null;
      }
      const rec = recRef.current;
      recRef.current = null;
      rec?.stop();
    };
  }, []);

  const startListening = () => {
    const key = guide[activeIndexRef.current]?.key;
    if (key) clearStep(key);
    setError("");
    setTalkStarted(true);
    resetStepSpeech();
    clearStepSpeechBuffer();
    processedResultIndexRef.current = 0;
    heardCommittedRef.current = false;
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
      bumpIdleTimer();
    } catch {
      recRef.current = null;
      setError("마이크를 시작할 수 없습니다.");
    }
  };

  const commitNotesDraft = useCallback(() => {
    const notes = notesDraftRef.current.trim();
    setSteps((prev) => ({
      ...prev,
      notes: {
        partial: { notes, options: [] },
        display: notes,
        complete: true,
      },
    }));
    clearStepSpeechBuffer();
    resetStepSpeech();
  }, [clearStepSpeechBuffer, resetStepSpeech]);

  const finishTalking = useCallback(() => {
    setListeningBoth(false);
    stopRecognition();
    clearIdleTimer();
    clearLocationHoldTimer();
    const key = guide[activeIndexRef.current]?.key;
    if (key === "notes" && !guideStepComplete("notes", stepsRef.current.notes)) {
      commitNotesDraft();
    } else if (key === "notes" && notesDraftRef.current.trim()) {
      commitNotesDraft();
    }
  }, [
    clearIdleTimer,
    clearLocationHoldTimer,
    commitNotesDraft,
    guide,
    stopRecognition,
  ]);

  const allComplete = allGuideStepsComplete(kind, steps);
  const currentKey = guide[activeIndex]?.key;
  const primaryKind = talkPrimaryKind({
    talkStarted,
    listening,
    currentKey,
    allComplete,
  });
  const primaryLabel = talkPrimaryLabel(primaryKind);

  const handlePrimary = () => {
    if (primaryKind === "finish") {
      finishTalking();
      return;
    }
    if (listeningRef.current) {
      stopCurrentTake();
      return;
    }
    startListening();
  };

  const selectGuideRow = (index: number) => {
    const key = guide[index]?.key;
    if (!key) return;
    const fromKey = guide[activeIndexRef.current]?.key;
    if (listeningRef.current) {
      haltListening();
      if (
        fromKey === "notes" &&
        !guideStepComplete("notes", stepsRef.current.notes)
      ) {
        setNotesDraftBoth("");
      }
    }
    clearLocationHoldTimer();
    activeIndexRef.current = index;
    setActiveIndex(index);
    clearStep(key);
  };

  const goPrevious = () => {
    clearLocationHoldTimer();
    setActiveIndex((idx) => Math.max(0, idx - 1));
  };

  const skipCurrent = () => {
    clearLocationHoldTimer();
    if (activeIndex < guide.length - 1) {
      setActiveIndex((idx) => idx + 1);
    }
  };

  const handleApply = () => {
    onApply(buildIntakeFromSteps(stepPartialsFromRecords(steps), kind));
  };

  const hasAnyStep = Object.values(steps).some(
    (row) => row?.display || row?.complete
  );
  const composedLive = stepLive;
  const notesPreview = composeTalkText(notesDraft, "", composedLive);
  const showRecordIcon = talkStarted && !listening && primaryKind === "stop";
  const primaryButton = (
    <button
      type="button"
      className={[
        "inline-flex h-12 box-border w-full items-center justify-center gap-1 rounded-2xl px-3",
        "text-[13px] font-semibold leading-none",
        "active:scale-95 transition-all duration-150 disabled:opacity-50 disabled:active:scale-100",
        listening || showRecordIcon
          ? "border border-red-500 bg-white text-red-600"
          : "border border-red-500 bg-red-500 text-white hover:bg-red-600",
      ].join(" ")}
      onClick={handlePrimary}
      disabled={!speechSupported}
      data-testid="intake-talk-primary"
      aria-label={
        showRecordIcon
          ? "녹화"
          : listening && primaryKind === "stop"
            ? "정지"
            : primaryLabel
      }
    >
      {listening && primaryKind === "stop" ? (
        <>
          <span className="inline-flex items-center gap-0.5" aria-hidden>
            <span className="h-3 w-0.5 rounded-sm bg-red-500" />
            <span className="h-3 w-0.5 rounded-sm bg-red-500" />
          </span>
          {primaryLabel}
        </>
      ) : showRecordIcon ? (
        <span className="h-5 w-5 rounded-full bg-red-500" aria-hidden />
      ) : (
        primaryLabel
      )}
    </button>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="대화로 입력"
      description="순서대로 대화로 입력하세요."
      dense
      overlayClassName="z-50 max-sm:!px-0"
      className="h-[100dvh] !max-h-[100dvh] max-sm:!rounded-none sm:h-auto sm:!max-h-[min(92dvh,800px)]"
      footer={
        <div className="space-y-2">
          {listening ? (
            <p className="flex min-h-[1.25rem] items-center justify-center gap-2 break-words text-[14px] font-medium text-gray-400">
              <ListeningMicMeter live={composedLive} />
              <span>{composedLive || "듣는 중…"}</span>
            </p>
          ) : talkStarted && !allComplete ? (
            <p className="min-h-[1.25rem] text-center text-[14px] font-medium leading-snug text-gray-400">
              {TALK_STOP_HINT}
            </p>
          ) : (
            <p className="min-h-[1.25rem]" aria-hidden />
          )}
          {error ? (
            <p className="text-center text-[12px] font-semibold text-red-400">{error}</p>
          ) : null}
          {talkStarted ? (
            <div className="grid grid-cols-3 items-stretch gap-2">
              <button
                type="button"
                disabled={activeIndex === 0}
                onClick={goPrevious}
                className={navStepButtonClass(activeIndex === 0)}
              >
                <span className="text-[12px] font-bold leading-none">&lt;</span>
                이전
              </button>
              {primaryButton}
              <button
                type="button"
                onClick={skipCurrent}
                className={navStepButtonClass()}
              >
                건너뛰기
                <span className="text-[12px] font-bold leading-none">&gt;</span>
              </button>
            </div>
          ) : (
            primaryButton
          )}
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
      <ul className="-mx-2 mb-2 space-y-0.5 rounded-2xl bg-gray-50 px-1 py-1.5">
        {guide.map((line, index) => {
          const row = steps[line.key];
          const isFlags = line.key === "flags";
          const done = isFlags
            ? flagsStepComplete(row?.partial)
            : guideStepComplete(line.key, row);
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
          const stackContacts = line.key === "contacts";
          const stackLayout = stackValue || showFlagsProgress || stackContacts;
          const showColon =
            !isFlags && (done || active || Boolean(line.example));
          return (
            <li
              key={line.key}
              data-testid={`intake-guide-row-${line.key}`}
            >
              <button
                type="button"
                aria-current={active ? "step" : undefined}
                onClick={() => selectGuideRow(index)}
                className={[
                  "flex w-full min-w-0 items-center gap-1.5 text-left",
                  stackLayout ? "items-start" : "",
                  activeRowClass(active, filled),
                ].join(" ")}
              >
              <span
                className={[
                  "w-3.5 shrink-0 text-center text-[14px] font-bold leading-none",
                  stackLayout ? "pt-0.5" : "",
                  active ? "text-blue-600" : "text-transparent",
                ].join(" ")}
                aria-hidden={!active}
              >
                ▶
              </span>
              <div
                className={[
                  "min-w-0 flex-1",
                  stackLayout
                    ? "flex flex-col gap-0.5"
                    : "flex min-w-0 items-baseline gap-2",
                ].join(" ")}
              >
                <span
                  className={[
                    "text-[16px] font-bold leading-snug",
                    done ? "text-green-800" : active ? "text-blue-900" : "text-gray-800",
                    stackLayout ? "" : "shrink-0",
                  ].join(" ")}
                >
                  {line.name}
                  {showColon ? ":" : ""}
                </span>
                {isFlags && showFlagsProgress ? (
                  <div
                    className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[14px] leading-snug"
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
                                : "font-medium text-gray-600",
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
                      "min-w-0 break-words text-[14px] leading-snug",
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
                      "min-w-0 truncate text-[14px] leading-snug",
                      active
                        ? "font-medium text-blue-700"
                        : "font-medium text-gray-700",
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
                      "min-w-0 text-[14px] leading-snug",
                      stackContacts ? "break-words" : "truncate",
                      done
                        ? "font-semibold text-green-700"
                        : "font-medium text-blue-700",
                    ].join(" ")}
                  >
                    {done
                      ? line.key === "notes" && active && notesPreview.trim()
                        ? notesPreview
                        : row?.display
                      : line.key === "notes" && notesPreview.trim()
                        ? notesPreview
                        : composedLive.trim()
                        ? composedLive
                        : line.example
                          ? `예) ${line.example}`
                          : null}
                  </span>
                ) : line.example ? (
                  <span
                    className={[
                      "min-w-0 text-[14px] font-medium leading-snug text-gray-700",
                      stackContacts ? "break-words" : "truncate",
                    ].join(" ")}
                  >
                    예) {line.example}
                  </span>
                ) : null}
              </div>
              </button>
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}
