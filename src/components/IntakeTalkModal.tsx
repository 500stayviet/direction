"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import type { DealType } from "@/lib/types";
import type { IntakeKind, IntakeParseResult } from "@/lib/intakeParse";
import { talkRoomBathExplicitInput } from "@/lib/intakeParse";
import { applyDealTypeToMoney, isDealMoneyCleared } from "@/lib/dealTypeMoney";
import { intakeGuideHits } from "@/lib/intakeGuideHits";
import {
  talkGuideSteps,
  allGuideStepsComplete,
  buildIntakeFromSteps,
  flagsStepComplete,
  flagsGuideCopy,
  formatFlagsValueLine,
  guideStepComplete,
  moneyFieldsComplete,
  moneyStepExample,
  dealTypeStepExample,
  resolveTalkDealType,
  datesStepNeedsHold,
  locationStepNeedsHold,
  restAddressStepNeedsHold,
  restAddressStepReadyToAdvance,
  roomBathStepNeedsHold,
  roomBathStepReadyToAdvance,
  looksLikeTalkBathroomContinuation,
  formatTalkRoomBathLivePreview,
  parseIntakeStepChain,
  splitIntakeStepCancel,
  stepPartialsFromRecords,
  talkDasiIsHyphen,
  type IntakeStepKey,
} from "@/lib/intakeSteps";
import {
  absorbCommitted,
  absorbPhoneSpeech,
  composeTalkText,
  readSpeechResultsSince,
} from "@/lib/speechTranscript";
import { useScreenWakeLock } from "@/hooks/useScreenWakeLock";
import {
  applyNotesUtterance,
  TALK_IDLE_MS,
  TALK_FIELD_HOLD_MS,
  TALK_LISTEN_RESTART_MS,
  TALK_ROOM_BATH_HOLD_MS,
  talkLocationHoldMs,
  talkRestAddressHoldMs,
  TALK_ENDED_TITLE,
  TALK_ENDED_MESSAGE,
  TALK_SILENCE_STOP_MESSAGE,
  TALK_SILENCE_STOP_MS,
  TALK_STOP_HINT,
  TALK_RECOGNITION_FAIL,
  TALK_MIC_FAIL,
  isTalkMicError,
  talkPrimaryKind,
  talkPrimaryLabel,
  talkStepUsesFieldHold,
  looksLikeTalkJibunUtterance,
  looksLikeTalkRestAddressContinuation,
  TALK_LOCATION_JIBUN_LISTENING,
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
  const box = "rounded-lg border px-2 py-1 min-h-8";
  if (filled) return `${box} border-green-400 bg-green-50`;
  if (active) return `${box} border-blue-400 bg-blue-50/80`;
  return `${box} border-gray-200 bg-white`;
}

function navStepButtonClass(disabled = false): string {
  return [
    "inline-flex h-11 box-border items-center justify-center gap-0.5 rounded-xl border border-gray-200 bg-white px-1.5",
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
  const [activeIndex, setActiveIndex] = useState(0);
  const [steps, setSteps] = useState<Partial<Record<IntakeStepKey, StepRecord>>>(
    {}
  );
  const [stepLive, setStepLive] = useState("");
  const [listening, setListening] = useState(false);
  const [talkStarted, setTalkStarted] = useState(false);
  const [showTalkEnded, setShowTalkEnded] = useState(false);
  const [showSilenceStop, setShowSilenceStop] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");
  const [error, setError] = useState("");
  const [speechSupported, setSpeechSupported] = useState(true);

  const recRef = useRef<SpeechRec | null>(null);
  const stepSpeechRef = useRef("");
  const notesDraftRef = useRef("");
  const processedResultIndexRef = useRef(0);
  const speechResultsRef = useRef<ArrayLike<unknown> | null>(null);
  const listeningRef = useRef(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fieldHoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingListenRef = useRef(false);
  const listenRetryRef = useRef(0);
  const listenRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const startFreshRef = useRef<() => void>(() => {});
  const activeIndexRef = useRef(0);
  const stepsRef = useRef(steps);
  const processUtteranceRef = useRef<(raw: string) => boolean>(() => false);
  const processLivePartialStepRef = useRef<(composed: string) => void>(() => {});
  const scheduleFieldHoldRef = useRef<() => void>(() => {});
  const finishTalkingRef = useRef<() => void>(() => {});
  const heardCommittedRef = useRef(false);
  const lastDealTypeRef = useRef<DealType | "">("");
  const stepLiveRef = useRef("");
  const lastSpeechAtRef = useRef(0);
  const silenceAutoStoppedRef = useRef(false);

  useScreenWakeLock(open && listening);

  const resetStepSpeech = useCallback(() => {
    setStepLive("");
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

  const resolvedDealForGuide =
    steps.roomType?.partial?.roomType === "토지" ||
    steps.roomType?.partial?.roomType === "건물"
      ? "매매"
      : resolveTalkDealType(
          steps.dealType?.partial,
          steps.money?.partial
        );
  const guide = talkGuideSteps(
    kind,
    steps.roomType?.partial?.roomType,
    resolvedDealForGuide
  );
  const guideKeys = guide.map((line) => line.key).join(",");

  useEffect(() => {
    const room = stepsRef.current.roomType?.partial?.roomType;
    const g = talkGuideSteps(
      kind,
      room,
      room === "토지" || room === "건물"
        ? "매매"
        : resolveTalkDealType(
            stepsRef.current.dealType?.partial,
            stepsRef.current.money?.partial
          )
    );
    const currentKey = g[activeIndexRef.current]?.key;
    const idx = currentKey
      ? g.findIndex((line) => line.key === currentKey)
      : -1;
    if (idx >= 0 && idx !== activeIndexRef.current) {
      activeIndexRef.current = idx;
      setActiveIndex(idx);
      return;
    }
    if (idx < 0 && g.length > 0) {
      const fallback = Math.min(activeIndexRef.current, g.length - 1);
      activeIndexRef.current = fallback;
      setActiveIndex(fallback);
    }
  }, [guideKeys, kind]);

  useEffect(() => {
    activeIndexRef.current = activeIndex;
    resetStepSpeech();
    clearStepSpeechBuffer();
  }, [activeIndex, clearStepSpeechBuffer, resetStepSpeech]);

  const resetWizard = useCallback(() => {
    setActiveIndex(0);
    setSteps({});
    setTalkStarted(false);
    setShowTalkEnded(false);
    setNotesDraftBoth("");
    stepSpeechRef.current = "";
    processedResultIndexRef.current = 0;
    heardCommittedRef.current = false;
    lastDealTypeRef.current = "";
    resetStepSpeech();
  }, [resetStepSpeech, setNotesDraftBoth]);

  const showTalkEndedDone = useCallback(() => {
    setShowTalkEnded(true);
  }, []);

  useEffect(() => {
    if (!showSilenceStop) return;
    const id = window.setTimeout(
      () => setShowSilenceStop(false),
      TALK_SILENCE_STOP_MS
    );
    return () => window.clearTimeout(id);
  }, [showSilenceStop]);

  const clearFieldHoldTimer = useCallback(() => {
    if (fieldHoldTimerRef.current == null) return;
    clearTimeout(fieldHoldTimerRef.current);
    fieldHoldTimerRef.current = null;
  }, []);

  const scheduleFieldHoldAdvance = useCallback(() => {
    clearFieldHoldTimer();
    if (!listeningRef.current) return;
    const idx = activeIndexRef.current;
    const key = guide[idx]?.key;
    if (!talkStepUsesFieldHold(key)) return;
    if (key === "notes") {
      if (!notesDraftRef.current.trim()) return;
    } else {
      const rec = key ? stepsRef.current[key] : undefined;
      if (!rec?.display || rec.skipped) return;
      if (key === "money") {
        const deal = resolveTalkDealType(
          stepsRef.current.dealType?.partial,
          rec.partial
        );
        if (!moneyFieldsComplete(rec.partial, deal)) return;
      }
      if (key === "dates" && !datesStepNeedsHold(rec.partial)) return;
      if (key === "location" && !locationStepNeedsHold(rec.partial, kind)) return;
      if (key === "restAddress" && !restAddressStepNeedsHold(rec.partial)) return;
      if (
        key === "roomBath" &&
        !roomBathStepNeedsHold(rec.partial, stepLiveRef.current) &&
        !guideStepComplete("roomBath", rec, stepsRef.current)
      ) {
        return;
      }
    }
    const holdMs =
      key === "location"
        ? talkLocationHoldMs(kind, stepsRef.current.location?.partial)
        : key === "restAddress"
          ? talkRestAddressHoldMs(stepsRef.current.restAddress?.partial)
          : key === "roomBath" &&
              roomBathStepNeedsHold(
                stepsRef.current.roomBath?.partial,
                stepLiveRef.current
              )
            ? TALK_ROOM_BATH_HOLD_MS
          : TALK_FIELD_HOLD_MS;
    fieldHoldTimerRef.current = setTimeout(() => {
      fieldHoldTimerRef.current = null;
      if (!listeningRef.current) return;
      if (guide[activeIndexRef.current]?.key !== key) return;
      if (key === "notes") {
        if (!notesDraftRef.current.trim()) return;
        finishTalkingRef.current();
        return;
      }
      const held = key ? stepsRef.current[key] : undefined;
      if (!held?.display || held.skipped) return;
      if (key === "money") {
        const deal = resolveTalkDealType(
          stepsRef.current.dealType?.partial,
          held.partial
        );
        if (!moneyFieldsComplete(held.partial, deal)) return;
      }
      if (key === "dates" && !datesStepNeedsHold(held.partial)) return;
      if (key === "location" && !locationStepNeedsHold(held.partial, kind)) return;
      if (key === "restAddress" && !restAddressStepNeedsHold(held.partial)) return;
      if (
        key === "roomBath" &&
        !guideStepComplete("roomBath", held, stepsRef.current)
      ) {
        return;
      }
      if (
        key === "location" &&
        kind === "property" &&
        held.partial.dong &&
        !held.partial.jibun?.includes("-") &&
        looksLikeTalkJibunUtterance(stepLiveRef.current)
      ) {
        scheduleFieldHoldRef.current();
        return;
      }
      if (
        key === "restAddress" &&
        restAddressStepNeedsHold(held.partial) &&
        looksLikeTalkRestAddressContinuation(stepLiveRef.current)
      ) {
        scheduleFieldHoldRef.current();
        return;
      }
      if (
        key === "roomBath" &&
        roomBathStepNeedsHold(held.partial, stepLiveRef.current) &&
        looksLikeTalkBathroomContinuation(stepLiveRef.current)
      ) {
        scheduleFieldHoldRef.current();
        return;
      }
      if (key === "roomBath" && roomBathStepNeedsHold(held.partial)) return;
      if (activeIndexRef.current >= guide.length - 1) return;
      const next = activeIndexRef.current + 1;
      activeIndexRef.current = next;
      setActiveIndex(next);
    }, holdMs);
  }, [clearFieldHoldTimer, guide, kind]);

  useEffect(() => {
    scheduleFieldHoldRef.current = scheduleFieldHoldAdvance;
  }, [scheduleFieldHoldAdvance]);

  const applySteps = useCallback(
    (
      nextSteps: Partial<Record<IntakeStepKey, StepRecord>>,
      nextIndex: number,
      fromIndex: number
    ) => {
      stepsRef.current = nextSteps;
      setSteps(nextSteps);
      const fromKey = guide[fromIndex]?.key;
      const resolvedRoom = nextSteps.roomType?.partial?.roomType;
      const resolvedDeal =
        resolvedRoom === "토지" || resolvedRoom === "건물"
          ? "매매"
          : resolveTalkDealType(
              nextSteps.dealType?.partial,
              nextSteps.money?.partial
            );
      const flagsDone =
        fromKey === "flags" &&
        flagsStepComplete(nextSteps.flags?.partial, resolvedDeal, resolvedRoom, kind);
      if (fromKey === "flags" && !flagsDone) {
        resetStepSpeech();
        return;
      }
      if (nextIndex === fromIndex) {
        if (fromKey !== "location" && fromKey !== "restAddress" && fromKey !== "roomBath") {
        resetStepSpeech();
      }
        if (talkStepUsesFieldHold(fromKey)) {
          scheduleFieldHoldAdvance();
        }
        return;
      }
      clearFieldHoldTimer();
      const nextGuide = talkGuideSteps(kind, resolvedRoom, resolvedDeal);
      const clamped =
        nextIndex >= nextGuide.length ? nextGuide.length - 1 : nextIndex;
      activeIndexRef.current = clamped;
      setActiveIndex(clamped);
      clearStepSpeechBuffer();
      resetStepSpeech();
      const landed = nextGuide[clamped]?.key;
      if (talkStepUsesFieldHold(landed)) {
        scheduleFieldHoldAdvance();
      }
    },
    [
      clearFieldHoldTimer,
      clearStepSpeechBuffer,
      guide,
      kind,
      resetStepSpeech,
      scheduleFieldHoldAdvance,
    ]
  );

  const clearStep = useCallback(
    (key: IntakeStepKey) => {
      if (talkStepUsesFieldHold(key)) {
        clearFieldHoldTimer();
      }
      setSteps((prev) => {
        const next = { ...prev };
        delete next[key];
        stepsRef.current = next;
        return next;
      });
      if (key === "notes") setNotesDraftBoth("");
      setStepLive("");
      clearStepSpeechBuffer();
    },
    [clearFieldHoldTimer, clearStepSpeechBuffer, setNotesDraftBoth]
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
        scheduleFieldHoldAdvance();
        return true;
      }

      const { cancel, remainder } = splitIntakeStepCancel(trimmed, {
        dasiIsHyphen: talkDasiIsHyphen(kind, key),
      });
      if (cancel && !remainder) {
        heardCommittedRef.current = true;
        clearStep(key);
        clearStepSpeechBuffer();
        return true;
      }
      const piece = remainder || trimmed;
      stepSpeechRef.current =
        key === "phone" || key === "tenantPhone" || key === "landlordPhone"
          ? absorbPhoneSpeech(stepSpeechRef.current, piece)
          : absorbCommitted(stepSpeechRef.current, piece);
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
      scheduleFieldHoldAdvance,
      setNotesDraftBoth,
    ]
  );

  const processNewFinalResults = useCallback(
    (
      results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>
    ) => {
      if (speechResultsRef.current !== results) {
        speechResultsRef.current = results;
        processedResultIndexRef.current = 0;
      }
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
            scheduleFieldHoldRef.current();
          }
        }
      }
    },
    []
  );

  const processLivePartialStep = useCallback(
    (composed: string) => {
      const startIndex = activeIndexRef.current;
      const key = guide[startIndex]?.key;
      if (key !== "location" && key !== "restAddress" && key !== "roomBath") {
        return;
      }
      const trimmed = composed.trim();
      if (!trimmed) return;
      if (key === "roomBath" && !talkRoomBathExplicitInput(trimmed)) {
        return;
      }
      const chain = parseIntakeStepChain(
        trimmed,
        startIndex,
        kind,
        stepPartialsFromRecords(stepsRef.current)
      );
      if (key === "location") {
        const loc = chain.commits.find((row) => row.key === "location");
        if (!loc) return;
        const prev = stepsRef.current.location;
        if (
          loc.display === prev?.display &&
          loc.partial.jibun === prev?.partial.jibun &&
          loc.partial.dong === prev?.partial.dong
        ) {
          return;
        }
        heardCommittedRef.current = true;
        const nextSteps = { ...stepsRef.current };
        nextSteps.location = {
          partial: loc.partial,
          display: loc.display,
          skipped: false,
        };
        const hasSub = Boolean(loc.partial.jibun?.split("-")[1]?.trim());
        applySteps(
          nextSteps,
          hasSub ? chain.nextIndex : startIndex,
          startIndex
        );
        return;
      }
      if (key === "restAddress") {
        const rest = chain.commits.find((row) => row.key === "restAddress");
        if (!rest) return;
        const prev = stepsRef.current.restAddress;
        if (
          rest.display === prev?.display &&
          rest.partial.buildingName === prev?.partial.buildingName &&
          rest.partial.roomNo === prev?.partial.roomNo
        ) {
          return;
        }
        heardCommittedRef.current = true;
        const nextSteps = { ...stepsRef.current };
        nextSteps.restAddress = {
          partial: rest.partial,
          display: rest.display,
          skipped: false,
        };
        const ready = restAddressStepReadyToAdvance(trimmed, rest.partial);
        applySteps(nextSteps, ready ? chain.nextIndex : startIndex, startIndex);
        return;
      }
      const roomBath = chain.commits.find((row) => row.key === "roomBath");
      if (!roomBath) return;
      const prevRb = stepsRef.current.roomBath;
      if (
        roomBath.display === prevRb?.display &&
        roomBath.partial.roomCount === prevRb?.partial.roomCount &&
        roomBath.partial.bathroomCount === prevRb?.partial.bathroomCount
      ) {
        return;
      }
      heardCommittedRef.current = true;
      const rbSteps = { ...stepsRef.current };
      rbSteps.roomBath = {
        partial: roomBath.partial,
        display: roomBath.display,
        skipped: false,
      };
      const rbReady = roomBathStepReadyToAdvance(trimmed, roomBath.partial);
      applySteps(rbSteps, rbReady ? chain.nextIndex : startIndex, startIndex);
    },
    [applySteps, guide, kind]
  );

  useEffect(() => {
    processUtteranceRef.current = processUtterance;
  }, [processUtterance]);

  useEffect(() => {
    processLivePartialStepRef.current = processLivePartialStep;
  }, [processLivePartialStep]);

  const setListeningBoth = (next: boolean) => {
    listeningRef.current = next;
    setListening(next);
  };

  const clearIdleTimer = useCallback(() => {
    if (idleTimerRef.current == null) return;
    clearTimeout(idleTimerRef.current);
    idleTimerRef.current = null;
  }, []);

  const clearListenRetryTimer = useCallback(() => {
    if (listenRetryTimerRef.current == null) return;
    clearTimeout(listenRetryTimerRef.current);
    listenRetryTimerRef.current = null;
  }, []);

  const stopRecognition = useCallback(() => {
    pendingListenRef.current = false;
    listenRetryRef.current = 0;
    clearListenRetryTimer();
    const rec = recRef.current;
    recRef.current = null;
    rec?.stop();
  }, [clearListenRetryTimer]);

  const haltListening = useCallback(() => {
    setListeningBoth(false);
    stopRecognition();
    clearIdleTimer();
    clearFieldHoldTimer();
    processedResultIndexRef.current = 0;
    resetStepSpeech();
  }, [
    clearIdleTimer,
    clearFieldHoldTimer,
    resetStepSpeech,
    stopRecognition,
  ]);

  const stopCurrentTake = useCallback(() => {
    haltListening();
    const key = guide[activeIndexRef.current]?.key;
    if (key) clearStep(key);
  }, [clearStep, guide, haltListening]);

  const bumpIdleTimer = useCallback(() => {
    clearIdleTimer();
    if (!listeningRef.current) return;
    const scheduleNext = () => {
      idleTimerRef.current = setTimeout(() => {
        if (!listeningRef.current) return;
        const idleFor = Date.now() - lastSpeechAtRef.current;
        if (idleFor >= TALK_IDLE_MS) {
          silenceAutoStoppedRef.current = true;
          haltListening();
          setShowSilenceStop(true);
          return;
        }
        scheduleNext();
      }, 1_000);
    };
    scheduleNext();
  }, [clearIdleTimer, haltListening]);

  const buildRecognition = useCallback((): SpeechRec | null => {
    const rec = getSpeechRecognition();
    if (!rec) return null;
    rec.lang = "ko-KR";
    rec.interimResults = true;
    rec.continuous = true;
    rec.onresult = (ev) => {
      const spoken = readSpeechResultsSince(ev.results, 0);
      if (spoken.sessionFinal || spoken.live) {
        silenceAutoStoppedRef.current = false;
        lastSpeechAtRef.current = Date.now();
        bumpIdleTimer();
        scheduleFieldHoldAdvance();
      }
      processNewFinalResults(ev.results);
      const key = guide[activeIndexRef.current]?.key;
      if (key === "location" || key === "restAddress" || key === "roomBath") {
        const composed = composeTalkText(
          stepSpeechRef.current,
          spoken.sessionFinal,
          spoken.live
        );
        if (composed.trim()) {
          processLivePartialStepRef.current(composed);
        }
      }
      stepLiveRef.current = spoken.live;
      setStepLive(spoken.live);
    };
    rec.onend = () => {
      if (pendingListenRef.current) {
        if (recRef.current === rec) recRef.current = null;
        startFreshRef.current();
        return;
      }
      if (recRef.current !== rec) return;
      if (silenceAutoStoppedRef.current) return;
      resetStepSpeech();
      processedResultIndexRef.current = 0;
      if (!listeningRef.current) return;
      recRef.current = null;
      startFreshRef.current();
    };
    rec.onerror = (ev) => {
      if (ev?.error === "aborted" || ev?.error === "no-speech") return;
      haltListening();
      setError(
        isTalkMicError(ev?.error) ? TALK_MIC_FAIL : TALK_RECOGNITION_FAIL
      );
    };
    return rec;
  }, [
    bumpIdleTimer,
    haltListening,
    processNewFinalResults,
    resetStepSpeech,
    scheduleFieldHoldAdvance,
    guide,
  ]);

  useEffect(() => {
    if (!open) {
      listeningRef.current = false;
      stopRecognition();
      clearIdleTimer();
      clearFieldHoldTimer();
      setShowTalkEnded(false);
      setShowSilenceStop(false);
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
      return;
    }
    let cancelled = false;
    const permissions = (
      navigator as Navigator & {
        permissions?: {
          query: (desc: { name: string }) => Promise<{ state: string }>;
        };
      }
    ).permissions;
    void permissions
      ?.query({ name: "microphone" })
      .then((status) => {
        if (cancelled) return;
        if (status.state === "denied") setError(TALK_MIC_FAIL);
      })
      .catch(() => {
        /* Safari 등 permissions 미지원 — 시작 시 오류로 안내 */
      });
    return () => {
      cancelled = true;
    };
  }, [
    open,
    resetWizard,
    resetStepSpeech,
    stopRecognition,
    clearIdleTimer,
    clearFieldHoldTimer,
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
      if (fieldHoldTimerRef.current != null) {
        clearTimeout(fieldHoldTimerRef.current);
        fieldHoldTimerRef.current = null;
      }
      if (listenRetryTimerRef.current != null) {
        clearTimeout(listenRetryTimerRef.current);
        listenRetryTimerRef.current = null;
      }
      pendingListenRef.current = false;
      const rec = recRef.current;
      recRef.current = null;
      rec?.stop();
    };
  }, []);

  const startFreshRecognition = useCallback(() => {
    pendingListenRef.current = false;
    clearListenRetryTimer();
    processedResultIndexRef.current = 0;
    const rec = buildRecognition();
    if (!rec) {
      setListeningBoth(false);
      setError(TALK_MIC_FAIL);
      return;
    }
    recRef.current = rec;
    try {
      rec.start();
      listenRetryRef.current = 0;
      setListeningBoth(true);
      bumpIdleTimer();
    } catch {
      recRef.current = null;
      if (listenRetryRef.current < 1) {
        listenRetryRef.current += 1;
        pendingListenRef.current = true;
        listenRetryTimerRef.current = setTimeout(() => {
          listenRetryTimerRef.current = null;
          if (pendingListenRef.current) startFreshRef.current();
        }, TALK_LISTEN_RESTART_MS);
        return;
      }
      listenRetryRef.current = 0;
      pendingListenRef.current = false;
      setListeningBoth(false);
      setError(TALK_MIC_FAIL);
    }
  }, [buildRecognition, bumpIdleTimer, clearListenRetryTimer]);

  useEffect(() => {
    startFreshRef.current = startFreshRecognition;
  }, [startFreshRecognition]);

  const startListening = () => {
    const key = guide[activeIndexRef.current]?.key;
    if (key) clearStep(key);
    setError("");
    setShowTalkEnded(false);
    setShowSilenceStop(false);
    silenceAutoStoppedRef.current = false;
    lastSpeechAtRef.current = Date.now();
    setTalkStarted(true);
    resetStepSpeech();
    clearStepSpeechBuffer();
    processedResultIndexRef.current = 0;
    heardCommittedRef.current = false;
    pendingListenRef.current = true;
    listenRetryRef.current = 0;
    clearListenRetryTimer();
    const rec = recRef.current;
    if (rec) {
      rec.stop();
      return;
    }
    startFreshRecognition();
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
    const wasListening = listeningRef.current;
    setListeningBoth(false);
    stopRecognition();
    clearIdleTimer();
    clearFieldHoldTimer();
    const key = guide[activeIndexRef.current]?.key;
    if (key === "notes" && !guideStepComplete("notes", stepsRef.current.notes)) {
      commitNotesDraft();
    } else if (key === "notes" && notesDraftRef.current.trim()) {
      commitNotesDraft();
    }
    if (wasListening) showTalkEndedDone();
  }, [
    clearIdleTimer,
    clearFieldHoldTimer,
    commitNotesDraft,
    showTalkEndedDone,
    guide,
    stopRecognition,
  ]);

  useEffect(() => {
    finishTalkingRef.current = finishTalking;
  }, [finishTalking]);

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
    if (!speechSupported) return;
    const key = guide[index]?.key;
    if (!key) return;
    const fromKey = guide[activeIndexRef.current]?.key;
    if (
      fromKey === "notes" &&
      !guideStepComplete("notes", stepsRef.current.notes)
    ) {
      setNotesDraftBoth("");
    }
    clearFieldHoldTimer();
    activeIndexRef.current = index;
    setActiveIndex(index);
    startListening();
  };

  const goPrevious = () => {
    clearFieldHoldTimer();
    setActiveIndex((idx) => Math.max(0, idx - 1));
  };

  const skipCurrent = () => {
    clearFieldHoldTimer();
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
  const activeGuideKey = guide[activeIndex]?.key;
  const roomBathListeningComposed =
    activeGuideKey === "roomBath"
      ? composeTalkText(stepSpeechRef.current, "", stepLive)
      : "";
  const roomBathLivePreview =
    activeGuideKey === "roomBath"
      ? formatTalkRoomBathLivePreview(
          roomBathListeningComposed,
          steps.roomBath?.partial
        )
      : "";
  const notesPreview = composeTalkText(notesDraft, "", composedLive);
  const showJibunListening =
    listening &&
    kind === "property" &&
    guide[activeIndex]?.key === "location" &&
    Boolean(steps.location?.partial.dong) &&
    !steps.location?.partial.jibun?.trim() &&
    looksLikeTalkJibunUtterance(composedLive);
  const showRecordIcon = talkStarted && !listening && primaryKind === "stop";
  const primaryButton = (
    <button
      type="button"
      className={[
        "inline-flex h-11 box-border w-full items-center justify-center gap-1 rounded-2xl px-3",
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
          <span
            className="h-3 w-3 rounded-[2px] bg-red-500"
            aria-hidden
          />
          {primaryLabel}
        </>
      ) : showRecordIcon ? (
        <span className="h-5 w-5 rounded-full bg-red-500" aria-hidden />
      ) : primaryKind === "start" ? (
        <>
          <svg
            viewBox="0 0 16 16"
            className="h-4 w-4 shrink-0"
            fill="currentColor"
            aria-hidden
          >
            <path d="M8 1.5a2.25 2.25 0 0 0-2.25 2.25v4a2.25 2.25 0 1 0 4.5 0v-4A2.25 2.25 0 0 0 8 1.5Z" />
            <path d="M4.25 7.25a.75.75 0 0 0-1.5 0 5.25 5.25 0 0 0 4.5 5.196V14h-1.5a.75.75 0 0 0 0 1.5h4.5a.75.75 0 0 0 0-1.5h-1.5v-1.554A5.25 5.25 0 0 0 13.25 7.25a.75.75 0 0 0-1.5 0 3.75 3.75 0 1 1-7.5 0Z" />
          </svg>
          {primaryLabel}
        </>
      ) : (
        primaryLabel
      )}
    </button>
  );

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title="대화로 입력"
        description={
          <>
            순서대로 대화로 입력 또는 항목을 선택하여 입력하세요.
            <span className="mt-0.5 block text-[12px] font-medium leading-snug text-orange-400">
              수정 팁: 항목을 선택하면 선택된 항목에 입력된 내용은 삭제되며
              대화로 다시 입력하시면 됩니다.
            </span>
          </>
        }
        dense
        overlayClassName="z-50 max-sm:!px-0"
        descriptionClassName="text-[13px] leading-snug"
        className="h-[100dvh] !max-h-[100dvh] !pt-3 max-sm:!rounded-none sm:h-auto sm:!max-h-[min(92dvh,800px)]"
        footer={
        <div className="space-y-1.5">
          {listening ? (
            <p className="flex min-h-[1.125rem] items-center justify-center gap-2 break-words text-[13px] font-medium text-gray-400">
              <ListeningMicMeter live={composedLive} />
              <span>
                {showJibunListening
                  ? TALK_LOCATION_JIBUN_LISTENING
                  : composedLive || "듣는 중…"}
              </span>
            </p>
          ) : talkStarted && !allComplete && !error ? (
            <p className="min-h-[1.125rem] text-center text-[13px] font-medium leading-snug text-gray-400">
              {TALK_STOP_HINT}
            </p>
          ) : (
            <p className="min-h-[1.125rem]" aria-hidden />
          )}
          {error ? (
            <p className="text-center text-[12px] font-semibold text-red-400">{error}</p>
          ) : null}
          {talkStarted ? (
            <div className="grid grid-cols-3 items-stretch gap-1.5">
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
          <div className="grid grid-cols-2 gap-1.5">
            <Button
              variant="secondary"
              fullWidth
              className="!min-h-11 !py-0 !text-[14px]"
              onClick={onClose}
            >
              취소
            </Button>
            <Button
              fullWidth
              className="!min-h-11 !py-0 !text-[14px]"
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
      <ul className="-mx-1 space-y-0.5 overflow-x-hidden rounded-2xl bg-gray-50 px-1 py-1">
        {guide.map((line, index) => {
          const row = steps[line.key];
          const isFlags = line.key === "flags";
          const resolvedDeal = resolveTalkDealType(
            steps.dealType?.partial,
            steps.money?.partial
          );
          const resolvedRoom = steps.roomType?.partial?.roomType;
          const flagsCopy = flagsGuideCopy(kind, resolvedDeal, resolvedRoom);
          const stepExample =
            line.key === "money"
              ? moneyStepExample(resolvedDeal)
              : line.key === "dealType"
                ? dealTypeStepExample(resolvedDeal)
                : isFlags
                  ? flagsCopy.example
                  : line.example;
          const flagsValues = isFlags
            ? formatFlagsValueLine(
                row?.partial ?? {},
                kind,
                resolvedDeal,
                resolvedRoom
              )
            : "";
          const rowDisplay = isFlags
            ? flagsValues || row?.display || ""
            : row?.display || "";
          const hasEnteredValue = Boolean(rowDisplay);
          const filled = isFlags
            ? flagsStepComplete(row?.partial, resolvedDeal, resolvedRoom, kind)
            : line.key === "roomBath"
              ? guideStepComplete("roomBath", row, steps)
              : hasEnteredValue ||
                (line.key === "notes" && Boolean(row?.complete));
          const active = index === activeIndex;
          const showColon =
            filled || active || hasEnteredValue || Boolean(stepExample);

          let valueText: string | null = null;
          if (filled) {
            valueText =
              line.key === "notes" && active && notesPreview.trim()
                ? notesPreview
                : rowDisplay || null;
          } else if (active) {
            if (line.key === "notes" && notesPreview.trim()) {
              valueText = notesPreview;
            } else if (line.key === "roomBath" && roomBathLivePreview) {
              valueText = roomBathLivePreview;
            } else if (isFlags) {
              if (flagsValues) {
                valueText = flagsValues;
              } else if (flagsCopy.valueInline && stepExample) {
                valueText = `예) ${stepExample}`;
              } else if (composedLive.trim()) {
                valueText = composedLive;
              } else if (stepExample) {
                valueText = `예) ${stepExample}`;
              }
            } else if (composedLive.trim()) {
              valueText = composedLive;
            } else if (stepExample) {
              valueText = `예) ${stepExample}`;
            }
          } else if (isFlags && hasEnteredValue) {
            valueText = rowDisplay;
          } else if (stepExample) {
            valueText = `예) ${stepExample}`;
          }

          const isNotes = line.key === "notes";
          const flagsValueBelow =
            isFlags && Boolean(valueText) && !flagsCopy.valueInline;
          const notesGrowing =
            isNotes && Boolean(valueText) && valueText !== `예) ${stepExample}`;
          const valueBelow = flagsValueBelow || notesGrowing;
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
                  "flex w-full min-w-0 gap-1 text-left",
                  valueBelow ? "items-start" : "items-baseline",
                  activeRowClass(active, filled),
                ].join(" ")}
              >
              <span
                className={[
                  "w-3 shrink-0 text-center text-[13px] font-bold leading-none",
                  valueBelow ? "mt-0.5" : "",
                  active ? "text-blue-600" : "text-transparent",
                ].join(" ")}
                aria-hidden={!active}
              >
                ▶
              </span>
              <div
                className={[
                  "flex min-w-0 flex-1 gap-1",
                  valueBelow ? "flex-col items-stretch" : "items-baseline",
                ].join(" ")}
              >
                <span
                  className={[
                    "shrink-0 text-[15px] font-bold leading-snug",
                    filled ? "text-green-800" : active ? "text-blue-900" : "text-gray-800",
                  ].join(" ")}
                >
                  {isFlags ? flagsCopy.name : line.name}
                  {(isFlags ? flagsCopy.nameHint : line.nameHint) ? (
                    <span
                      className={[
                        "ml-1 text-[11px] font-medium leading-none",
                        filled
                          ? "text-green-700/70"
                          : active
                            ? "text-blue-700/70"
                            : "text-gray-500",
                      ].join(" ")}
                    >
                      {isFlags ? flagsCopy.nameHint : line.nameHint}
                    </span>
                  ) : null}
                  {showColon ? ":" : ""}
                </span>
                {valueText ? (
                  <span
                    className={[
                      "min-w-0 text-[13px] leading-snug",
                      valueBelow
                        ? "whitespace-pre-wrap break-words"
                        : "truncate",
                      filled || (hasEnteredValue && !active)
                        ? "font-semibold text-green-700"
                        : active
                          ? "font-medium text-blue-700"
                          : "font-medium text-gray-700",
                    ].join(" ")}
                  >
                    {valueText}
                  </span>
                ) : null}
              </div>
              </button>
            </li>
          );
        })}
      </ul>
      </Modal>
      {open && showTalkEnded ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center px-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="talk-ended-title"
          aria-describedby="talk-ended-desc"
        >
          <div className="absolute inset-0 bg-black/40" aria-hidden />
          <div className="relative w-full max-w-[300px] rounded-2xl bg-white px-6 pb-5 pt-6 text-center shadow-xl">
            <p
              id="talk-ended-title"
              className="text-[22px] font-bold leading-tight tracking-tight text-gray-900"
            >
              {TALK_ENDED_TITLE}
            </p>
            <p
              id="talk-ended-desc"
              className="mt-3 text-[15px] font-medium leading-relaxed text-gray-600"
            >
              {TALK_ENDED_MESSAGE}
            </p>
            <Button
              fullWidth
              className="mt-5"
              onClick={() => setShowTalkEnded(false)}
              data-testid="intake-talk-ended-confirm"
            >
              확인
            </Button>
          </div>
        </div>
      ) : null}
      {open && showSilenceStop && !showTalkEnded ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center px-6"
          role="status"
          aria-live="polite"
          data-testid="intake-talk-silence-stop"
        >
          <div className="absolute inset-0 bg-black/40" aria-hidden />
          <div className="relative w-full max-w-[300px] rounded-2xl bg-white px-6 py-7 text-center shadow-xl">
            <p className="text-[17px] font-bold leading-snug tracking-tight text-gray-900">
              {TALK_SILENCE_STOP_MESSAGE}
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
