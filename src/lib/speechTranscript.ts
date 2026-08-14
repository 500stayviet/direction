/** 인식 결과가 앞 글자와 겹치면 이어 붙이지 않는다 */
export function mergeSpeech(prefix: string, spoken: string): string {
  const a = prefix.replace(/\s+/g, " ").trim();
  const b = spoken.replace(/\s+/g, " ").trim();
  if (!b) return a;
  if (!a) return b;
  if (a === b) return a;
  if (b.startsWith(`${a} `)) return b;
  if (a.endsWith(` ${b}`)) return a;

  const aTokens = a.split(" ");
  const bTokens = b.split(" ");
  const max = Math.min(aTokens.length, bTokens.length);
  for (let k = max; k > 0; k -= 1) {
    if (aTokens.slice(-k).join(" ") === bTokens.slice(0, k).join(" ")) {
      return [...aTokens, ...bTokens.slice(k)].join(" ");
    }
  }
  return `${a} ${b}`;
}

/** 원룸 원룸 매매 원룸 매매 → 원룸 매매 */
export function collapseRepeatSpeech(text: string): string {
  let tokens = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (tokens.length === 0) return "";

  let tokenDup = true;
  while (tokenDup) {
    tokenDup = false;
    const next: string[] = [];
    let i = 0;
    while (i < tokens.length) {
      if (tokens[i] && tokens[i] === tokens[i + 1]) {
        next.push(tokens[i]);
        i += 2;
        tokenDup = true;
        continue;
      }
      if (tokens[i]) next.push(tokens[i]);
      i += 1;
    }
    tokens = next;
  }

  let phraseDup = true;
  while (phraseDup) {
    phraseDup = false;
    outer: for (let len = Math.floor(tokens.length / 2); len >= 2; len -= 1) {
      const next: string[] = [];
      let i = 0;
      while (i < tokens.length) {
        if (i + 2 * len <= tokens.length) {
          const left = tokens.slice(i, i + len).join(" ");
          const right = tokens.slice(i + len, i + 2 * len).join(" ");
          if (left === right) {
            next.push(...tokens.slice(i, i + len));
            i += 2 * len;
            phraseDup = true;
            continue;
          }
        }
        const token = tokens[i];
        if (token) next.push(token);
        i += 1;
      }
      tokens = next;
      if (phraseDup) break outer;
    }
  }

  return tokens.join(" ");
}

function normalizeSpeech(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * 확정된 글에 새 인식을 넣는다.
 * 앞·뒤가 같은 말이면(세션이 다시 시작된 메아리) 붙이지 않고,
 * 앞 글자를 이어서 말하면 그 줄로 바꾼다.
 */
export function absorbCommitted(committed: string, incoming: string): string {
  const a = normalizeSpeech(committed);
  const b = normalizeSpeech(incoming);
  if (!b) return a;
  if (!a) return collapseRepeatSpeech(b);
  if (a === b) return a;
  if (a.endsWith(` ${b}`)) return a;
  if (b.endsWith(` ${a}`)) return collapseRepeatSpeech(b);
  if (a.startsWith(`${b} `)) return a;
  if (b.startsWith(`${a} `)) return collapseRepeatSpeech(b);
  return collapseRepeatSpeech(mergeSpeech(a, b));
}

/** 이미 칸에 있는 말은 빼고, 지금 하는 말만 남긴다 */
export function liveTail(locked: string, live: string): string {
  const a = normalizeSpeech(locked);
  const b = normalizeSpeech(live);
  if (!b) return "";
  if (!a) return b;
  if (b === a) return "";
  if (b.startsWith(`${a} `)) return b.slice(a.length).trim();
  if (a.startsWith(`${b} `) || a.endsWith(` ${b}`)) return "";
  return b;
}

export function readSpeechResults(
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>
): { sessionFinal: string; live: string } {
  let sessionFinal = "";
  let live = "";
  for (let i = 0; i < results.length; i += 1) {
    const row = results[i];
    if (!row) continue;
    const piece = normalizeSpeech(row[0]?.transcript ?? "");
    if (!piece) continue;
    if (row.isFinal) sessionFinal = absorbCommitted(sessionFinal, piece);
    else live = piece;
  }
  return { sessionFinal, live };
}

export function composeTalkText(
  committed: string,
  sessionFinal: string,
  live: string
): string {
  return absorbCommitted(absorbCommitted(committed, sessionFinal), live);
}

export function spokenFromResults(
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>
): string {
  const { sessionFinal, live } = readSpeechResults(results);
  return composeTalkText("", sessionFinal, live);
}

export function appendSpoken(prefix: string, spoken: string): string {
  return absorbCommitted(prefix, spoken);
}
