"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import dynamic from "next/dynamic";
import { IntakeSourceBar, type IntakeMethod } from "@/components/IntakeSourceBar";
import { IntakeResetModal } from "@/components/IntakeResetModal";
import { IntakeMessageModal, IntakeTalkModal } from "@/components/intakeLazy";
import { IntakeAiBusyOverlay } from "@/components/IntakeAiBusyOverlay";
import { useModalBackClose } from "@/hooks/useModalBackClose";
import { getAccessToken } from "@/lib/auth";
import type { IntakeKind, IntakeParseResult } from "@/lib/intakeParse";
import {
  recordIntakeSample,
  type IntakeSampleSource,
} from "@/lib/intakeSampleCollect";

const IntakePhotoPicker = dynamic(
  () =>
    import("@/components/IntakePhotoPicker").then((m) => m.IntakePhotoPicker),
  { ssr: false }
);

export function useIntakeApply(opts: {
  kind: IntakeKind;
  enabled?: boolean;
  hasDraftContent: boolean;
  onResetDraft: () => void;
  onApplyParsed: (parsed: IntakeParseResult) => void;
  sourceClassName?: string;
  photoErrorClassName?: string;
}): {
  filledFromIntake: boolean;
  setFilledFromIntake: (next: boolean) => void;
  aiBusy: boolean;
  setAiBusy: (next: boolean) => void;
  overlay: ReactNode;
  sourceSection: ReactNode;
  modals: ReactNode;
} {
  const enabled = opts.enabled !== false;
  const [filledFromIntake, setFilledFromIntake] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [pendingMethod, setPendingMethod] = useState<IntakeMethod | null>(null);
  const [messageOpen, setMessageOpen] = useState(false);
  const [talkOpen, setTalkOpen] = useState(false);
  const [photoRequestId, setPhotoRequestId] = useState(0);
  const [photoError, setPhotoError] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const applyingIntakeRef = useRef(false);
  const cancelledRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const hasDraftContentRef = useRef(opts.hasDraftContent);
  const onResetDraftRef = useRef(opts.onResetDraft);
  const onApplyParsedRef = useRef(opts.onApplyParsed);
  hasDraftContentRef.current = opts.hasDraftContent;
  onResetDraftRef.current = opts.onResetDraft;
  onApplyParsedRef.current = opts.onApplyParsed;

  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
      abortRef.current?.abort();
    };
  }, []);

  const startIntake = useCallback((method: IntakeMethod) => {
    setPhotoError("");
    if (method === "message") setMessageOpen(true);
    if (method === "talk") setTalkOpen(true);
    if (method === "photo") setPhotoRequestId((n) => n + 1);
  }, []);

  const requestIntake = useCallback((method: IntakeMethod) => {
    if (filledFromIntake || hasDraftContentRef.current) {
      setPendingMethod(method);
      setResetOpen(true);
      return;
    }
    startIntake(method);
  }, [filledFromIntake, startIntake]);

  const applyParsed = useCallback((parsed: IntakeParseResult) => {
    if (cancelledRef.current) return;
    onApplyParsedRef.current(parsed);
    setFilledFromIntake(true);
    setMessageOpen(false);
    setTalkOpen(false);
  }, []);

  const applyIntakeText = useCallback(
    async (raw: string, source: IntakeSampleSource) => {
      if (applyingIntakeRef.current || cancelledRef.current) return;
      applyingIntakeRef.current = true;
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      setAiBusy(true);
      if (source !== "message") setMessageOpen(false);
      const started = Date.now();
      try {
        const accessToken = await getAccessToken();
        if (ac.signal.aborted || cancelledRef.current) return;
        const { INTAKE_AI_MIN_WAIT_MS, resolveIntakeWithAi } = await import(
          "@/lib/intakeAiClient"
        );
        const parsed = await resolveIntakeWithAi({
          raw,
          kind: opts.kind,
          source,
          accessToken,
          signal: ac.signal,
        });
        if (ac.signal.aborted || cancelledRef.current) return;
        const wait = Math.max(0, INTAKE_AI_MIN_WAIT_MS - (Date.now() - started));
        if (wait) {
          await new Promise<void>((resolve) => {
            const timer = window.setTimeout(resolve, wait);
            const onAbort = () => {
              window.clearTimeout(timer);
              resolve();
            };
            ac.signal.addEventListener("abort", onAbort, { once: true });
          });
        }
        if (ac.signal.aborted || cancelledRef.current) return;
        void recordIntakeSample({
          raw,
          kind: opts.kind,
          source,
          parsed,
          accessToken,
        });
        applyParsed(parsed);
      } catch {
        /* 규칙 결과는 유지. 화면은 그대로 */
      } finally {
        applyingIntakeRef.current = false;
        if (!cancelledRef.current) setAiBusy(false);
      }
    },
    [applyParsed, opts.kind]
  );

  const applyFromTalk = useCallback(
    (parsed: IntakeParseResult) => {
      if (applyingIntakeRef.current || cancelledRef.current) return;
      applyParsed(parsed);
    },
    [applyParsed]
  );

  const intakeModalOpen = enabled && (messageOpen || talkOpen);
  const closeIntakeModalFromBack = useCallback(() => {
    if (talkOpen) {
      setTalkOpen(false);
      return true;
    }
    if (messageOpen) {
      if (aiBusy) return false;
      setMessageOpen(false);
      return true;
    }
    return false;
  }, [talkOpen, messageOpen, aiBusy]);

  useModalBackClose({
    open: intakeModalOpen,
    onRequestClose: closeIntakeModalFromBack,
  });

  const overlay = <IntakeAiBusyOverlay open={aiBusy} />;

  const sourceSection = enabled ? (
    <div className={opts.sourceClassName}>
      <IntakeSourceBar onSelect={requestIntake} />
      {photoError ? (
        <p
          className={
            opts.photoErrorClassName ??
            "text-[12px] font-semibold text-red-400"
          }
        >
          {photoError}
        </p>
      ) : null}
      {photoRequestId > 0 ? (
        <IntakePhotoPicker
          requestId={photoRequestId}
          onBusyChange={setAiBusy}
          onText={(text) => applyIntakeText(text, "photo")}
          onError={setPhotoError}
        />
      ) : null}
    </div>
  ) : null;

  const modals = enabled ? (
    <>
      <IntakeResetModal
        open={resetOpen}
        onClose={() => {
          setResetOpen(false);
          setPendingMethod(null);
        }}
        onConfirm={() => {
          const method = pendingMethod;
          setResetOpen(false);
          setPendingMethod(null);
          onResetDraftRef.current();
          setFilledFromIntake(false);
          setPhotoError("");
          if (method) startIntake(method);
        }}
      />
      {messageOpen ? (
        <IntakeMessageModal
          open={messageOpen}
          busy={aiBusy}
          onClose={() => {
            if (aiBusy) return;
            setMessageOpen(false);
          }}
          onApply={(text) => void applyIntakeText(text, "message")}
        />
      ) : null}
      {talkOpen ? (
        <IntakeTalkModal
          open={talkOpen}
          kind={opts.kind}
          onClose={() => setTalkOpen(false)}
          onApply={(parsed) => applyFromTalk(parsed)}
        />
      ) : null}
    </>
  ) : null;

  return {
    filledFromIntake,
    setFilledFromIntake,
    aiBusy,
    setAiBusy,
    overlay,
    sourceSection,
    modals,
  };
}
