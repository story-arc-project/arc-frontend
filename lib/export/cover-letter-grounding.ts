// 근거 없는(환각 의심) 주장을 자소서 본문 위에 표시하기 위한 순수 계산.
//
// 명세(O-03 grounding.unsupported_claims): "본문에서 **부분 매칭**해 하이라이트 → 수정 시 해제".
// 백엔드는 문자 오프셋이 아니라 **문장 조각 문자열**을 주므로 위치는 프런트가 찾아야 한다.
//
// ⚠️ 매칭은 실패할 수 있다(교정 과정에서 본문이 바뀌어 조각이 그대로 남아 있지 않을 수 있다).
// 그래서 하이라이트는 **보조 수단**이고, 못 찾은 주장도 화면에서 사라지지 않도록 `unmatched` 로
// 돌려준다 — 호출부가 목록 배너에 반드시 함께 띄운다. 매칭 실패가 은폐로 이어지면 이 기능이
// 막으려던 실패(근거 없는 문장을 그대로 제출)가 그대로 일어난다.

/** 너무 짧은 조각은 본문 곳곳에 우연히 걸려 오탐만 만든다 — 목록에는 남기고 하이라이트만 뺀다. */
const MIN_HIGHLIGHT_LENGTH = 4;

export interface GroundingSegment {
  text: string;
  /** true 면 근거 없는 주장으로 표시된 구간. */
  flagged: boolean;
}

export interface GroundingHighlight {
  segments: GroundingSegment[];
  /** 본문에서 위치를 찾지 못한 주장 — 배너에서 반드시 따로 보여줘야 한다. */
  unmatched: string[];
}

interface Range {
  start: number;
  end: number;
}

/** 공백 차이만으로 매칭이 어긋나지 않도록, 원문 인덱스를 보존한 채 공백을 접어 비교한다. */
function collapseWithIndexMap(text: string): { collapsed: string; map: number[] } {
  const chars: string[] = [];
  const map: number[] = [];
  let lastWasSpace = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (/\s/.test(ch)) {
      // 연속 공백은 하나로 접는다. 선행 공백은 버린다.
      if (lastWasSpace || chars.length === 0) continue;
      chars.push(" ");
      map.push(i);
      lastWasSpace = true;
    } else {
      chars.push(ch);
      map.push(i);
      lastWasSpace = false;
    }
  }
  return { collapsed: chars.join(""), map };
}

function findRanges(body: string, claim: string): Range[] {
  const ranges: Range[] = [];
  const needle = claim.trim();
  if (needle.length < MIN_HIGHLIGHT_LENGTH) return ranges;

  // 1) 원문 그대로 — 가장 정확하다.
  let from = 0;
  while (from <= body.length - needle.length) {
    const idx = body.indexOf(needle, from);
    if (idx === -1) break;
    ranges.push({ start: idx, end: idx + needle.length });
    from = idx + needle.length;
  }
  if (ranges.length > 0) return ranges;

  // 2) 공백을 접어 재시도 — 교정 과정에서 줄바꿈/띄어쓰기만 달라진 경우를 건진다.
  const { collapsed, map } = collapseWithIndexMap(body);
  const { collapsed: needleCollapsed } = collapseWithIndexMap(needle);
  if (needleCollapsed.length < MIN_HIGHLIGHT_LENGTH) return ranges;

  let cFrom = 0;
  while (cFrom <= collapsed.length - needleCollapsed.length) {
    const idx = collapsed.indexOf(needleCollapsed, cFrom);
    if (idx === -1) break;
    const start = map[idx];
    const lastIdx = idx + needleCollapsed.length - 1;
    const end = map[lastIdx] + 1;
    if (typeof start === "number" && typeof end === "number") {
      ranges.push({ start, end });
    }
    cFrom = idx + needleCollapsed.length;
  }
  return ranges;
}

function mergeRanges(ranges: Range[]): Range[] {
  if (ranges.length === 0) return [];
  const sorted = [...ranges].sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: Range[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const prev = merged[merged.length - 1];
    const cur = sorted[i];
    // 겹치거나 맞닿으면 합친다 — 조각난 <mark> 는 읽기를 방해한다.
    if (cur.start <= prev.end) {
      prev.end = Math.max(prev.end, cur.end);
    } else {
      merged.push({ ...cur });
    }
  }
  return merged;
}

/**
 * 본문을 하이라이트 구간과 일반 구간으로 쪼갠다.
 *
 * @param body   자소서 본문(`answers[n].cover_letter`)
 * @param claims 근거 없는 주장 목록(`grounding.unsupported_claims`)
 */
export function buildGroundingHighlight(
  body: string,
  claims: readonly string[],
): GroundingHighlight {
  if (!body) return { segments: [], unmatched: claims.filter((c) => c.trim() !== "") };

  const all: Range[] = [];
  const unmatched: string[] = [];

  for (const claim of claims) {
    if (!claim.trim()) continue;
    const ranges = findRanges(body, claim);
    if (ranges.length === 0) unmatched.push(claim);
    else all.push(...ranges);
  }

  const merged = mergeRanges(all);
  if (merged.length === 0) {
    return { segments: [{ text: body, flagged: false }], unmatched };
  }

  const segments: GroundingSegment[] = [];
  let cursor = 0;
  for (const range of merged) {
    if (range.start > cursor) {
      segments.push({ text: body.slice(cursor, range.start), flagged: false });
    }
    segments.push({ text: body.slice(range.start, range.end), flagged: true });
    cursor = range.end;
  }
  if (cursor < body.length) {
    segments.push({ text: body.slice(cursor), flagged: false });
  }

  return { segments, unmatched };
}
