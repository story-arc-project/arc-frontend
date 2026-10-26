import type { GroundingSegment } from "./cover-letter-grounding";

function isEscaped(text: string, index: number): boolean {
  let slashes = 0;
  for (let i = index - 1; i >= 0 && text[i] === "\\"; i--) slashes++;
  return slashes % 2 === 1;
}

/** Labels can contain nested brackets and escaped closing brackets. */
function inlineLabelEnd(text: string, opening: number): number | undefined {
  let depth = 1;
  for (let i = opening + 1; i < text.length; i++) {
    if (text[i] === "\\") { i++; continue; }
    if (text[i] === "[") depth++;
    if (text[i] === "]" && --depth === 0) return i;
  }
  return undefined;
}

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

/** Conservative literal boundary for declarations and processing instructions. */
function declarationEnd(text: string, start: number): number | undefined {
  if (text.startsWith("<![CDATA[", start)) {
    const closing = text.indexOf("]]>", start + 9);
    return closing === -1 ? undefined : closing + 3;
  }
  const terminator = text.startsWith("<?", start) ? "?>" : ">";
  let quote: string | undefined;
  let brackets = 0;
  for (let i = start + 2; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (ch === quote) quote = undefined;
      continue;
    }
    if (ch === '"' || ch === "'") { quote = ch; continue; }
    if (ch === "[") brackets++;
    if (ch === "]" && brackets > 0) brackets--;
    if (brackets === 0 && text.startsWith(terminator, i)) return i + terminator.length;
  }
  return undefined;
}

interface HtmlTagToken {
  start: number;
  end: number;
  name: string;
  closing: boolean;
  selfClosing: boolean;
}

/** Read one complete tag without letting quoted attribute text create other tokens. */
function htmlTagAt(text: string, start: number): HtmlTagToken | undefined {
  const match = text.slice(start).match(/^<(\/?)([a-z][\w-]*)(?=[\s/>])/i);
  if (!match) return undefined;
  let quote: string | undefined;
  for (let i = start + match[0].length; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (ch === quote) quote = undefined;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === ">") {
      return { start, end: i + 1, name: match[2].toLowerCase(), closing: Boolean(match[1]), selfClosing: text[i - 1] === "/" };
    }
  }
  return undefined;
}

/** Resolve a paired HTML container before its body can open an outside code span. */
function pairedHtmlEnd(text: string, opening: HtmlTagToken): number | undefined {
  let depth = 1;
  for (let cursor = opening.end; cursor < text.length; cursor++) {
    // Complete nested literals hide fake tags; incomplete syntax cannot hide the
    // enclosing close. Backticks in this HTML body are literal content.
    if (text.startsWith("<!--", cursor)) {
      const closing = text.indexOf("-->", cursor + 4);
      if (closing === -1) return undefined;
      cursor = closing + 2;
    } else if (text[cursor] === "[" && !isEscaped(text, cursor)) {
      const labelEnd = inlineLabelEnd(text, cursor);
      if (labelEnd !== undefined && text[labelEnd + 1] === "(") {
        const end = inlineLinkEnd(text, labelEnd + 1);
        if (end !== undefined) cursor = end - 1;
      }
    } else if (text[cursor] === "<") {
      if (/^(?:<!\[CDATA\[|<\?|<![a-z])/i.test(text.slice(cursor))) {
        const end = declarationEnd(text, cursor);
        if (end !== undefined) cursor = end - 1;
        continue;
      }
      const tag = htmlTagAt(text, cursor);
      if (!tag) continue;
      if (tag.name === opening.name) {
        if (tag.closing && --depth === 0) return tag.end;
        if (!tag.closing && !tag.selfClosing) depth++;
      }
      cursor = tag.end - 1;
    }
  }
  return undefined;
}

/** A definition can continue with a destination and title, but never across a blank line. */
function referenceDefinitionAt(text: string, start: number): { label: string; end: number } | undefined {
  const indent = text.slice(start).match(/^ {0,3}(?=\[)/)?.[0];
  if (indent === undefined) return undefined;
  const opening = start + indent.length;
  const labelEnd = inlineLabelEnd(text, opening);
  if (labelEnd === undefined || text[labelEnd + 1] !== ":") return undefined;
  const label = text.slice(opening + 1, labelEnd);
  if (!label.trim() || /\r?\n[\t ]*\r?\n/.test(label)) return undefined;
  let cursor = labelEnd + 2;
  const whitespace = text.slice(cursor).match(/^[\t ]*(?:\r?\n[\t ]*)?/)![0];
  cursor += whitespace.length;
  if (cursor === text.length || /\s/.test(text[cursor])) return undefined;
  if (text[cursor] === "<") {
    const destination = text.slice(cursor).match(/^<[^<>\r\n]*>/);
    if (!destination) return undefined;
    cursor += destination[0].length;
  } else {
    const destination = text.slice(cursor).match(/^[^\s]+/)![0];
    cursor += destination.length;
  }
  // Keep the destination line, as before; only a completed title extends that range.
  const lineEnd = text.indexOf("\n", cursor);
  let end = lineEnd === -1 ? text.length : lineEnd + 1;
  const gap = text.slice(cursor).match(/^[\t ]*(?:\r?\n[\t ]*)?/)![0];
  const titleStart = cursor + gap.length;
  const quote = text[titleStart];
  if (gap && (quote === '"' || quote === "'" || quote === "(")) {
    const closing = quote === "(" ? ")" : quote;
    for (let i = titleStart + 1; i < text.length; i++) {
      if (/^\r?\n[\t ]*\r?\n/.test(text.slice(i))) break;
      if (text[i] === "\\") { i++; continue; }
      if (text[i] !== closing) continue;
      const remainder = text.slice(i + 1).match(/^[\t ]*(?:\r?\n|$)/);
      if (remainder) end = i + 1 + remainder[0].length;
      break;
    }
  }
  return { label, end };
}

/** Display-only removals indexed against the complete raw body, before grounding splits. */
function removalMask(text: string): Uint8Array {
  const removed = new Uint8Array(text.length);
  const protectedChars = new Uint8Array(text.length);
  const protect = (start: number, end: number) => protectedChars.fill(1, start, end);
  // Line guards are conservative hints; literal spans establish actual containment.
  const literalChars = new Uint8Array(text.length);
  const protectLiteral = (start: number, end: number) => {
    protect(start, end);
    literalChars.fill(1, start, end);
  };
  const remove = (start: number, end: number) => {
    if (!protectedChars.subarray(start, end).some(Boolean)) removed.fill(1, start, end);
  };
  const lines = [...text.matchAll(/[^\n]*(?:\n|$)/g)].filter(m => m[0]);
  let fence: string | undefined;
  for (const line of lines) {
    const start = line.index!;
    const opening = line[0].match(/^ {0,3}(`{3,}|~{3,})/);
    if (fence) {
      protectLiteral(start, start + line[0].length);
      if (new RegExp(`^ {0,3}${fence[0]}{${fence.length},}\\s*$`).test(line[0])) fence = undefined;
    } else if (opening) {
      fence = opening[1];
      protectLiteral(start, start + line[0].length);
    } else if (/^ {0,3}(?:(?:\*[\t ]*){3,}|(?:-[\t ]*){3,}|(?:_[\t ]*){3,})\r?\n?$/.test(line[0]) || /^(?: {4}|\t)/.test(line[0]) || /<\/?[a-z][\w-]*(?:\s[^>]*|\/?)>/i.test(line[0])) {
      protect(start, start + line[0].length);
      if (/^(?: {4}|\t)/.test(line[0])) protectLiteral(start, start + line[0].length);
    }
  }
  const normalizeReference = (label: string) => label.trim().replace(/\s+/g, " ").toLowerCase();
  const references = new Set<string>();
  const definitions = new Map<number, { label: string; end: number }>();
  for (const line of lines) {
    const definition = referenceDefinitionAt(text, line.index!);
    if (definition) definitions.set(line.index!, definition);
  }

  // One source-order scan establishes containment for all complete literals. A
  // delimiter inside an accepted token cannot consume a later, genuine opener.
  // Incomplete link/declaration fallbacks wait until paired HTML is established.
  const pending: { start: number; end: number }[] = [];
  const voidTags = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);
  // Whitespace, quotes, angle brackets and backticks delimit a bare URL. Preserve
  // its path/query/fragment punctuation rather than guessing which marks are prose.
  const bareUrls = new Map([...text.matchAll(/\b(?:[a-z][a-z\d+.-]*:\/\/|www\.)[^\s<>"'`]+/gi)]
    .map(match => [match.index!, match.index! + match[0].length]));
  const ticks = [...text.matchAll(/`+/g)];
  for (let start = 0; start < text.length; start++) {
    if (literalChars[start]) continue;
    let end: number | undefined;
    const definition = definitions.get(start);
    if (definition) {
      references.add(normalizeReference(definition.label));
      end = definition.end;
    } else if (bareUrls.has(start)) {
      end = bareUrls.get(start);
    } else if (text[start] === "`" && text[start - 1] !== "`" && !isEscaped(text, start)) {
      const opening = ticks.find(run => run.index === start)!;
      const closing = ticks.find(run => run.index! > start && run[0].length === opening[0].length);
      if (closing) end = closing.index! + closing[0].length;
    } else if (text[start] === "[" && !isEscaped(text, start)) {
      const labelEnd = inlineLabelEnd(text, start);
      if (labelEnd !== undefined && text[labelEnd + 1] === "(") {
        end = inlineLinkEnd(text, labelEnd + 1);
        if (end === undefined) pending.push({ start, end: text.length });
      }
    } else if (text.startsWith("<!--", start)) {
      const closing = text.indexOf("-->", start + 4);
      end = closing === -1 ? text.length : closing + 3;
    } else if (text[start] === "<" && /^(?:<!\[CDATA\[|<\?|<![a-z])/i.test(text.slice(start))) {
      end = declarationEnd(text, start);
      if (end === undefined) pending.push({ start, end: text.length });
    } else if (text[start] === "<") {
      const autolink = text.slice(start).match(/^<(?:[a-z][a-z\d+.-]*:[^\s<>]*|[^\s<>@]+@[^\s<>@]+)>/i);
      const tag = autolink ? undefined : htmlTagAt(text, start);
      if (autolink) end = start + autolink[0].length;
      if (tag) {
        end = tag.end;
        if (!tag.closing && !tag.selfClosing && !voidTags.has(tag.name)) {
          end = pairedHtmlEnd(text, tag) ?? tag.end;
        }
      }
    }
    if (end !== undefined) {
      protectLiteral(start, end);
      start = end - 1;
    }
  }
  for (const range of pending) {
    if (!literalChars[range.start]) protectLiteral(range.start, range.end);
  }
  for (const link of text.matchAll(/\[([^\]]+)\](?:\[([^\]]*)\])?/g)) {
    // An immediate destination belongs to an inline link, even if a shortcut label exists.
    if (link[2] === undefined && text[link.index! + link[0].length] === "(") continue;
    if (link[2] !== undefined || references.has(normalizeReference(link[1]))) {
      protectLiteral(link.index!, link.index! + link[0].length);
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
