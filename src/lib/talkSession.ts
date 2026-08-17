import { absorbCommitted } from "@/lib/speechTranscript";
import {
  splitIntakeStepCancel,
  stripTalkNotesPrefix,
  type IntakeStepKey,
} from "@/lib/intakeSteps";

export const TALK_IDLE_MS = 10_000;
/** 선호지역·거래가액·단일 날짜: 다음 말이 없으면 2초 여유 뒤 다음 칸 */
export const TALK_FIELD_HOLD_MS = 2_000;
/** 대화 종료 안내를 짧게 보여 주는 시간 */
export const TALK_ENDED_MS = 2_000;

export type TalkPrimaryKind = "start" | "stop" | "finish";

export const TALK_ENDED_MESSAGE = "대화가 종료되었습니다.";

export const TALK_STOP_HINT = "녹화버튼을 눌러 대화를 이어가세요.";

export function talkPrimaryKind(opts: {
  talkStarted: boolean;
  listening: boolean;
  currentKey: IntakeStepKey | undefined;
  allComplete: boolean;
}): TalkPrimaryKind {
  if (!opts.talkStarted) return "start";
  if (opts.allComplete) return "finish";
  if (!opts.listening) return "stop";
  if (opts.currentKey === "notes") return "finish";
  return "stop";
}

export function talkPrimaryLabel(kind: TalkPrimaryKind): string {
  if (kind === "start") return "대화 시작";
  if (kind === "finish") return "입력완료";
  return "정지";
}

export function applyNotesUtterance(
  currentDraft: string,
  raw: string
): { clear: boolean; draft: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { clear: false, draft: currentDraft };

  const { cancel, remainder } = splitIntakeStepCancel(trimmed);
  if (cancel && !remainder) return { clear: true, draft: "" };

  const piece = stripTalkNotesPrefix(remainder || trimmed);
  if (!piece) return { clear: false, draft: currentDraft };
  return { clear: false, draft: absorbCommitted(currentDraft, piece) };
}
