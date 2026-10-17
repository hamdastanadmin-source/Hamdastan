/**
 * An event's description: a small Markdown subset, parsed into a tree the
 * page draws as React elements. Nothing in it is ever HTML, so there is
 * nothing to sanitise — a `<script>` in the text is shown as the letters
 * `<script>`.
 *
 *   # تیتر / ## تیتر کوچک   headings
 *   - مورد / * مورد         a bullet list
 *   **پررنگ**                bold
 *   [متن](https://…)        a link — http and https only; anything else is text
 *   a blank line            a new paragraph; a single newline is a line break
 */

export type Inline = { kind: 'text'; text: string } | { kind: 'bold'; text: string } | { kind: 'link'; text: string; href: string } | { kind: 'break' };

export type Block =
  | { kind: 'heading'; level: 2 | 3; content: Inline[] }
  | { kind: 'paragraph'; content: Inline[] }
  | { kind: 'list'; items: Inline[][] };

const INLINE = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;

function parseInline(line: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  for (const match of line.matchAll(INLINE)) {
    if (match.index > last) out.push({ kind: 'text', text: line.slice(last, match.index) });
    if (match[1] !== undefined) {
      out.push({ kind: 'bold', text: match[1] });
    } else if (/^https?:\/\//i.test(match[3]) && URL.canParse(match[3])) {
      out.push({ kind: 'link', text: match[2], href: match[3] });
    } else {
      // Not a web address: shown as written.
      out.push({ kind: 'text', text: match[0] });
    }
    last = match.index + match[0].length;
  }
  if (last < line.length) out.push({ kind: 'text', text: line.slice(last) });
  return out;
}

/** Lines joined by line breaks. */
const joinLines = (lines: string[]): Inline[] =>
  lines.flatMap((line, index) => (index === 0 ? parseInline(line) : [{ kind: 'break' } as Inline, ...parseInline(line)]));

const BULLET = /^\s*[-*]\s+/;
const HEADING = /^(#{1,3})\s+(.*)$/;

export function parseRichText(source: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];

  const flush = () => {
    if (paragraph.length) blocks.push({ kind: 'paragraph', content: joinLines(paragraph) });
    if (list.length) blocks.push({ kind: 'list', items: list.map(parseInline) });
    paragraph = [];
    list = [];
  };

  for (const raw of source.replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flush();
      continue;
    }
    const heading = HEADING.exec(line.trim());
    if (heading) {
      flush();
      blocks.push({ kind: 'heading', level: heading[1].length === 1 ? 2 : 3, content: parseInline(heading[2]) });
      continue;
    }
    if (BULLET.test(line)) {
      if (paragraph.length) flush();
      list.push(line.replace(BULLET, ''));
      continue;
    }
    if (list.length) flush();
    paragraph.push(line.trim());
  }
  flush();
  return blocks;
}
