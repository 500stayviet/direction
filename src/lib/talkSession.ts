import { absorbCommitted } from "@/lib/speechTranscript";
import {
  splitIntakeStepCancel,
  stripTalkNotesPrefix,
  type IntakeStepKey,
} from "@/lib/intakeSteps";

export const TALK_IDLE_MS = 10_000;
/** 선호지역·거래가액·단일 날짜: 다음 말이 없으면 2초 여유 뒤 다음 칸 (셋 다 동일) */
export const TALK_FIELD_HOLD_MS = 2_000;
export const TALK_LOCATION_HOLD_MS = TALK_FIELD_HOLD_MS;
export const TALK_MONEY_HOLD_MS = TALK_FIELD_HOLD_MS;
export const TALK_DATES_HOLD_MS = TALK_FIELD_HOLD_MS;
/** 대화 종료 안내를 짧게 보여 주는 시간 */
export const TALK_ENDED_MS = 2_000;

export type TalkPrimaryKind = "start" | "stop" | "finish";

export const TALK_ENDED_TITLE = "입력완료!";
export const TALK_ENDED_MESSAGE = "입력한 내용 확인후 반영하기 누르세요";

export const TALK_STOP_HINT = "녹화버튼을 눌러 대화를 이어가세요.";

/** 말은 들렸지만 내용 인식 실패 */
export const TALK_RECOGNITION_FAIL =
  "대화를 인식하지 못했습니다. 다시 눌러 주세요.";

/** 권한·장치 문제로 마이크를 쓸 수 없을 때 */
export const TALK_MIC_FAIL = "마이크를 연결할 수 없습니다.";

/** SpeechRecognition onerror → 마이크 문제 */
export function isTalkMicError(code: string | undefined): boolean {
  return (
    code === "not-allowed" ||
    code === "service-not-allowed" ||
    code === "audio-capture"
  );
}

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
