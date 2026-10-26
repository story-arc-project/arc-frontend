import type { GroundingSegment } from "./cover-letter-grounding";

/** Display-only removals indexed against the complete raw body, before grounding splits. */
function removalMask(text: string): Uint8Array {
  const removed = new Uint8Array(text.length);
  const protectedChars = new Uint8Array(text.length);
  const protect = (start: number, end: number) => protectedChars.fill(1, start, end);
  const remove = (start: number, end: number) => {
    if (!protectedChars.subarray(start, end).some(Boolean)) removed.fill(1, start, end);
  };
  const lines = [...text.matchAll(/[^\n]*(?:\n|$)/g)].filter(m => m[0]);
  let fence: string | undefined;
  for (const line of lines) {
    const start = line.index!;
    const opening = line[0].match(/^ {0,3}(`{3,}|~{3,})/);
    if (fence) {
      protect(start, start + line[0].length);
      if (new RegExp(`^ {0,3}${fence[0]}{${fence.length},}\\s*$`).test(line[0])) fence = undefined;
    } else if (opening) {
      fence = opening[1];
      protect(start, start + line[0].length);
    } else if (/^ {0,3}(?:(?:\*[\t ]*){3,}|(?:-[\t ]*){3,}|(?:_[\t ]*){3,})\r?\n?$/.test(line[0]) || /^(?: {4}|\t)/.test(line[0]) || /\[[^\]]*\]\(|<[^>]+>/.test(line[0])) {
      protect(start, start + line[0].length);
    }
  }
  for (const m of text.matchAll(/(`+)[^`]*?\1/g)) protect(m.index!, m.index! + m[0].length);

  for (const m of text.matchAll(/(\*\*|__)(\S(?:[\s\S]*?\S)?)\1/g)) {
    const start = m.index!;
    const end = start + m[0].length;
    const marker = m[1][0];
    const before = text[start - 1] ?? "";
    const after = text[end] ?? "";
    // Escaped, intraword, longer delimiter runs and arithmetic are intentionally literal.
    if (before === "\\" || text[end - 3] === "\\" || before === marker || after === marker || m[2].includes(marker + marker)) continue;
    if (marker === "_" && (/[\p{L}\p{N}_]/u.test(before) || (/[\p{L}\p{N}_]/u.test(after) && !/[가-힣]/.test(after)))) continue;
    if (/^[\d\s.+\-*/=]+$/.test(m[2])) continue;
    if (protectedChars.subarray(start, end).some(Boolean)) continue;
    remove(start, start + 2);
    remove(end - 2, end);
  }

  type Item = { start: number; prefix: string; indent: string; family: string; number?: number };
  let run: Item[] = [];
  const flush = () => {
    if (run.length >= 2) for (const item of run) remove(item.start + item.indent.length, item.start + item.prefix.length);
    run = [];
  };
  for (const line of lines) {
    const start = line.index!;
    if (protectedChars[start]) { flush(); continue; }
    const header = line[0].match(/^( {0,3})(#{1,6})([\t ]+)(?=\S)([^\r\n]*)/);
    if (header) {
      remove(start + header[1].length, start + header[1].length + header[2].length + header[3].length);
      const closing = header[0].match(/[\t ]+#+[\t ]*$/);
      if (closing) remove(start + closing.index!, start + header[0].length);
    }
    const bullet = line[0].match(/^( {0,3})([-+*])[\t ]+(?=\S)/);
    const ordered = line[0].match(/^( {0,3})(\d{1,9})([.)])[\t ]+(?=\S)/);
    const item: Item | undefined = bullet ? { start, prefix: bullet[0], indent: bullet[1], family: bullet[2] } : ordered ? { start, prefix: ordered[0], indent: ordered[1], family: ordered[3], number: Number(ordered[2]) } : undefined;
    if (!item) { flush(); continue; }
    const prev = run.at(-1);
    if (prev && (prev.indent !== item.indent || prev.family !== item.family || (item.number !== undefined && item.number !== prev.number! + 1))) flush();
    run.push(item);
  }
  flush();
  return removed;
}

export function displayCoverLetterSegments(segments: readonly GroundingSegment[]): GroundingSegment[] {
  const text = segments.map(segment => segment.text).join("");
  const removed = removalMask(text);
  let offset = 0;
  return segments.flatMap(segment => {
    let shown = "";
    for (let i = 0; i < segment.text.length; i++) if (!removed[offset + i]) shown += segment.text[i];
    offset += segment.text.length;
    return shown ? [{ text: shown, flagged: segment.flagged }] : [];
  });
}

export function stripCoverLetterMarkdown(text: string): string {
  return displayCoverLetterSegments([{ text, flagged: false }]).map(segment => segment.text).join("");
}
