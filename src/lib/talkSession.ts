import { absorbCommitted } from "@/lib/speechTranscript";
import type { IntakeKind } from "@/lib/intakeParse";
import {
  splitIntakeStepCancel,
  stripTalkNotesPrefix,
  type IntakeStepKey,
} from "@/lib/intakeSteps";
import { restAddressRoomNoHasDongOnly } from "@/lib/propertyRoomNo";

export const TALK_IDLE_MS = 10_000;
/** 칸에 값이 있고 말이 끊긴 뒤 다음 칸으로 가는 여유 */
export const TALK_FIELD_HOLD_MS = 2_000;
/** 매물 주소지: 구·동만 있고 지번이 없을 때. 동 뒤 STT 끊김을 지번으로 받을 여유 */
export const TALK_LOCATION_DONG_HOLD_MS = 4_000;
/** 나머지주소: 건물명·동만 있고 호가 없을 때. 호 STT를 기다릴 여유 */
export const TALK_REST_ADDRESS_HO_HOLD_MS = 4_000;
/** stop 직후 start가 거절되면 한 번 더 켜기까지 대기 */
export const TALK_LISTEN_RESTART_MS = 120;

export function talkLocationHoldMs(
  kind: IntakeKind,
  partial: { dong?: string; jibun?: string } | undefined
): number {
  if (kind === "property" && partial?.dong && !partial.jibun?.trim()) {
    return TALK_LOCATION_DONG_HOLD_MS;
  }
  return TALK_FIELD_HOLD_MS;
}

export function talkRestAddressHoldMs(
  partial: { buildingName?: string; roomNo?: string } | undefined
): number {
  if (
    restAddressRoomNoHasDongOnly(partial?.roomNo) ||
    (partial?.buildingName && !partial?.roomNo)
  ) {
    return TALK_REST_ADDRESS_HO_HOLD_MS;
  }
  return TALK_FIELD_HOLD_MS;
}

/** 건물동 뒤 이어서 말하는 호(숫자·한글 수)처럼 보이면 홀드를 미룬다 */
export function looksLikeTalkHoUtterance(text: string): boolean {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return false;
  const afterDong = t.match(/동\s+(.+)$/);
  const tail = (afterDong?.[1] ?? t).replace(/\s+/g, "");
  if (!tail) return false;
  if (/\d/.test(tail)) return true;
  return /^(?:[일이삼사오육륙칠팔구공영십백천하나둘셋넷다섯여섯일곱여덟아홉열백])+$/.test(
    tail
  );
}

/** 건물명 뒤 동·호 숫자가 이어지는 중이면 홀드를 미룬다 */
export function looksLikeTalkRestAddressContinuation(text: string): boolean {
  if (looksLikeTalkHoUtterance(text)) return true;
  const t = text.replace(/\s+/g, " ").trim();
  if (/\d+\s*동/.test(t)) return true;
  if (/\d+\s*호/.test(t)) return true;
  const afterName = t.match(/[가-힣A-Za-z]+\s+(.+)$/);
  const tail = (afterName?.[1] ?? "").replace(/\s+/g, "");
  if (!tail) return false;
  if (/\d/.test(tail)) return true;
  return /^(?:[일이삼사오육륙칠팔구공영십백천하나둘셋넷다섯여섯일곱여덟아홉열])+$/.test(
    tail
  );
}

/** 구·동 뒤 이어서 말하는 지번(숫자·한글 수)처럼 보이면 홀드를 미룬다 */
export function looksLikeTalkJibunUtterance(text: string): boolean {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return false;
  const afterDong = t.match(/동\s+(.+)$/);
  const tail = (afterDong?.[1] ?? t).replace(/\s+/g, "");
  if (!tail) return false;
  if (/\d/.test(tail)) return true;
  return /^(?:[일이삼사오육륙칠팔구공영십백천하나둘셋넷다섯여섯일곱여덟아홉열월다시에의에서-])+$/.test(
    tail
  );
}

export function talkStepUsesFieldHold(key: IntakeStepKey | undefined): boolean {
  return (
    key === "location" ||
    key === "restAddress" ||
    key === "roomBath" ||
    key === "money" ||
    key === "dates" ||
    key === "tenantPhone" ||
    key === "landlordPhone" ||
    key === "notes"
  );
}
/** 대화 종료 안내 문구 */
export const TALK_ENDED_TITLE = "입력완료!";
export const TALK_ENDED_MESSAGE =
  "입력한 내용을 확인한 뒤 반영하기를 눌러 주세요.";

export const TALK_STOP_HINT = "녹화버튼을 눌러 대화를 이어가세요.";

/** 녹화 중 말이 없어 마이크가 멈췄을 때 */
export const TALK_SILENCE_STOP_MESSAGE =
  "대화가 없어 마이크 정지 되었습니다.";
export const TALK_SILENCE_STOP_MS = 2_500;

/** 말은 들렸지만 내용 인식 실패 */
export const TALK_RECOGNITION_FAIL =
  "대화를 인식하지 못했습니다. 다시 눌러 주세요.";

/** 구·동은 잡혔고 지번 숫자가 들리는 중 */
export const TALK_LOCATION_JIBUN_LISTENING = "지번 인식 중…";

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

export type TalkPrimaryKind = "start" | "stop" | "finish";

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
