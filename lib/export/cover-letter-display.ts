import type { GroundingSegment } from "./cover-letter-grounding";

/** Find the outer close without treating URL parentheses or quoted title text as its end. */
function inlineLinkEnd(text: string, opening: number): number | undefined {
  let depth = 1;
  let quote: string | undefined;
  let angleDestination = false;
  let destinationStarted = false;
  for (let i = opening + 1; i < text.length; i++) {
    const ch = text[i];
    if (ch === "\\") { i++; continue; }
    if (quote) {
      if (ch === quote) quote = undefined;
      continue;
    }
    if (angleDestination) {
      if (ch === ">") angleDestination = false;
      continue;
    }
    if (!destinationStarted && /\s/.test(ch)) continue;
    if (!destinationStarted) {
      destinationStarted = true;
      if (ch === "<") { angleDestination = true; continue; }
    }
    // Quotes introduce optional titles after whitespace; URL apostrophes stay ordinary text.
    if ((ch === '"' || ch === "'") && /\s/.test(text[i - 1])) { quote = ch; continue; }
    if (ch === "(") depth++;
    if (ch === ")" && --depth === 0) return i + 1;
  }
  return undefined;
}

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
    } else if (/^ {0,3}(?:(?:\*[\t ]*){3,}|(?:-[\t ]*){3,}|(?:_[\t ]*){3,})\r?\n?$/.test(line[0]) || /^(?: {4}|\t)/.test(line[0]) || /<\/?[a-z][\w-]*(?:\s[^>]*|\/?)>/i.test(line[0])) {
      protect(start, start + line[0].length);
    }
  }
  // Match maximal delimiter runs; shorter (or longer) internal runs are code content.
  const ticks = [...text.matchAll(/`+/g)];
  for (let i = 0; i < ticks.length; i++) {
    const opening = ticks[i];
    if (protectedChars[opening.index!]) continue;
    const closing = ticks.findIndex((run, j) => j > i && run[0].length === opening[0].length);
    if (closing !== -1) {
      protect(opening.index!, ticks[closing].index! + ticks[closing][0].length);
      i = closing;
    }
  }

  const normalizeReference = (label: string) => label.trim().replace(/\s+/g, " ").toLowerCase();
  const references = new Set<string>();
  for (const line of lines) {
    const definition = line[0].match(/^ {0,3}\[([^\]]+)\]:[\t ]*\S/);
    if (definition) {
      references.add(normalizeReference(definition[1]));
      protect(line.index!, line.index! + line[0].length);
    }
  }
  for (const link of text.matchAll(/\[([^\]]+)\](?:\[([^\]]*)\])?/g)) {
    // Explicit references are ambiguous enough to retain even without a definition.
    if (link[2] !== undefined || references.has(normalizeReference(link[1]))) {
      protect(link.index!, link.index! + link[0].length);
    }
  }

  // Preserve autolinks by range, leaving adjacent ordinary prose transformable.
  for (const link of text.matchAll(/<(?:[a-z][a-z\d+.-]*:[^\s<>]*|[^\s<>@]+@[^\s<>@]+)>/gi)) {
    protect(link.index!, link.index! + link[0].length);
  }

  // These literal constructs may span line and grounding boundaries.
  for (const link of text.matchAll(/\[[^\]]*\]\(/g)) {
    const end = inlineLinkEnd(text, link.index! + link[0].length - 1);
    if (end !== undefined) protect(link.index!, end);
  }
  for (const comment of text.matchAll(/<!--[\s\S]*?(?:-->|$)/g)) {
    protect(comment.index!, comment.index! + comment[0].length);
  }

  // Protect paired HTML contents across lines, including nested elements of the same name.
  const openTags: { name: string; start: number }[] = [];
  const voidTags = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);
  for (const tag of text.matchAll(/<(\/?)([a-z][\w-]*)\b[^>]*>/gi)) {
    const name = tag[2].toLowerCase();
    if (tag[1]) {
      const opening = openTags.findLastIndex(item => item.name === name);
      if (opening !== -1) {
        protect(openTags[opening].start, tag.index! + tag[0].length);
        openTags.splice(opening);
      }
    } else if (!voidTags.has(name) && !tag[0].endsWith("/>")) {
      openTags.push({ name, start: tag.index! });
    }
  }

  const emphasis = /(\*\*|__)(\S(?:[\s\S]*?\S)?)\1/g;
  let candidate: RegExpExecArray | null;
  while ((candidate = emphasis.exec(text)) !== null) {
    const start = candidate.index;
    const end = start + candidate[0].length;
    const marker = candidate[1][0];
    // On rejection, retry after this opener, rather than consuming a later valid opener.
    emphasis.lastIndex = start + 2;
    if (protectedChars[start] || protectedChars[start + 1]) continue;
    const before = text.slice(0, start).match(/.$/u)?.[0] ?? "";
    const afterCodePoint = text.codePointAt(end);
    const after = afterCodePoint === undefined ? "" : String.fromCodePoint(afterCodePoint);
    // Combining marks and supplementary letters belong to the surrounding word too.
    const word = /[\p{L}\p{N}\p{M}_]/u;
    if (before === "\\" || text[end - 3] === "\\" || before === marker || after === marker || candidate[2].includes(marker + marker)) continue;
    if (marker === "_" && (word.test(before) || (word.test(after) && !/[가-힣]/.test(after)))) continue;
    if (/^[\d\s.+\-*/=]+$/.test(candidate[2]) || /\r?\n[\t ]*\r?\n/.test(candidate[2])) continue;
    if (protectedChars.subarray(start, end).some(Boolean)) continue;
    remove(start, start + 2);
    remove(end - 2, end);
    emphasis.lastIndex = end;
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
