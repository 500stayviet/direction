import type { Property } from "@/lib/types";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** 미입력·플레이스홀더(00:00) 취급 */
export function isUnsetArriveTime(value: string | undefined): boolean {
  const t = (value ?? "").trim();
  return !t || t === "00:00" || t === "0:00";
}

function arriveSortKey(value: string | undefined): string {
  return isUnsetArriveTime(value) ? "99:99" : (value ?? "").trim();
}

/**
 * HH:mm 에 분을 더한 시각.
 * 정오(12시)는 선택 불가이므로 13:00으로 넘기고, 최대 23:50.
 */
export function addMinutesToHHmm(value: string, delta: number): string {
  const [hs, ms] = (value || "").split(":").map(Number);
  if (!Number.isFinite(hs) || !Number.isFinite(ms)) return "";
  let total = hs * 60 + ms + delta;
  const max = 23 * 60 + 50;
  if (total < 0) total = 0;
  if (total > max) total = max;

  let h = Math.floor(total / 60);
  let m = total % 60;

  // 오전 11:xx + 30 → 12:xx 이면 오후 1시로
  if (h === 12) {
    h = 13;
    m = 0;
  }

  return `${pad(h)}:${pad(m)}`;
}

/**
 * index 매물 약속시간이 바뀌면, 뒤 매물 중
 * 비어 있거나(00:00) · 이전 자동값(+30분) · 앞 매물보다 이르거나 같은 칸만
 * 앞+30분으로 갱신
 */
export function cascadeArriveTimes(
  list: Property[],
  index: number,
  prevArriveTime: string,
  nextArriveTime: string
): Property[] {
  if (prevArriveTime === nextArriveTime || isUnsetArriveTime(nextArriveTime)) {
    return list;
  }

  const next = [...list];
  let cursor = nextArriveTime;
  let oldCursor = prevArriveTime;

  for (let i = index + 1; i < next.length; i += 1) {
    const oldDefault = !isUnsetArriveTime(oldCursor)
      ? addMinutesToHHmm(oldCursor, 30)
      : "";
    const current = next[i].arriveTime ?? "";
    const wasDefault =
      isUnsetArriveTime(current) ||
      (Boolean(oldDefault) && current === oldDefault) ||
      current <= nextArriveTime;

    if (!wasDefault) break;

    const filled = addMinutesToHHmm(cursor, 30);
    if (!filled) break;

    next[i] = { ...next[i], arriveTime: filled };
    oldCursor = isUnsetArriveTime(current)
      ? oldDefault || cursor
      : current;
    cursor = filled;
  }

  return next;
}

/** 만나는 시간 → 1번 매물 방문 약속. 뒤 매물은 +30분씩 */
export function applyVisitTimeToArriveTimes(
  list: Property[],
  visitTime: string
): Property[] {
  if (isUnsetArriveTime(visitTime) || list.length === 0) return list;
  const prevArrive = list[0].arriveTime ?? "";
  const next =
    prevArrive === visitTime
      ? list
      : list.map((p, i) => (i === 0 ? { ...p, arriveTime: visitTime } : p));
  return sortPropertiesByArriveTime(
    cascadeArriveTimes(next, 0, prevArrive, visitTime)
  );
}

/** 방문 약속 시간이 빠른 순으로 정렬 (미입력은 맨 뒤) */
export function sortPropertiesByArriveTime(list: Property[]): Property[] {
  return [...list].sort((a, b) =>
    arriveSortKey(a.arriveTime).localeCompare(arriveSortKey(b.arriveTime))
  );
}

/**
 * 두 슬롯의 매물을 맞바꾸고, 각 슬롯의 방문 약속 시간은 유지
 * (예: 1번↔2번 교환 시 시간은 자리에 남고 매물만 바뀜)
 */
export function swapPropertySlots(
  list: Property[],
  fromIndex: number,
  toIndex: number
): Property[] {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= list.length ||
    toIndex >= list.length
  ) {
    return list;
  }
  const next = [...list];
  const from = next[fromIndex];
  const to = next[toIndex];
  const fromTime = from.arriveTime;
  const toTime = to.arriveTime;
  next[fromIndex] = { ...to, arriveTime: fromTime };
  next[toIndex] = { ...from, arriveTime: toTime };
  return next;
}
