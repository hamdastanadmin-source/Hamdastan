import { Fragment } from 'react';

/**
 * Text that arrives a word at a time, the way a generated answer streams in.
 *
 * Words, not letters: Persian letters join to their neighbours, and wrapping
 * each one in its own box would break the joins. The spaces stay real text
 * nodes so a screen reader hears a sentence, not one run-on word — and the
 * whole sentence is in the DOM from the start, so nothing is announced late.
 *
 * CSS only (`tailwindcss-animate`), so it plays on first paint without
 * waiting for hydration. `fill-mode-backwards` holds each word hidden through
 * its own delay; `motion-reduce` shows the text at once.
 */
export function StreamedText({
  text,
  startMs,
  stepMs,
}: {
  text: string;
  /** When the first word starts. */
  startMs: number;
  /** One word to the next. */
  stepMs: number;
}) {
  const words = text.split(' ');

  return words.map((word, index) => (
    <Fragment key={`${word}-${index}`}>
      <span
        className="inline-block animate-in fade-in slide-in-from-bottom-1 duration-300 fill-mode-backwards motion-reduce:animate-none"
        style={{ animationDelay: `${startMs + index * stepMs}ms` }}
      >
        {word}
      </span>
      {index < words.length - 1 ? ' ' : null}
    </Fragment>
  ));
}

/** When the last word of `text` has started, for chaining the next block. */
export function streamEndMs(text: string, startMs: number, stepMs: number): number {
  return startMs + text.split(' ').length * stepMs;
}

/**
 * The pace onboarding's intro screens stream at, so they read as one voice:
 * the title slower — it is the line that has to land — the body quicker, and
 * a beat between blocks so each reads as its own line.
 */
export const STREAM_PACE = {
  startMs: 300,
  titleStepMs: 110,
  bodyStepMs: 45,
  noteStepMs: 55,
  pauseMs: 150,
} as const;

/**
 * Start times for blocks that stream one after another, each a pause after
 * the last one's final word, and `endMs` — when the screen has finished
 * writing itself, which is when its action should arrive.
 */
export function streamSequence(
  blocks: readonly { text: string; stepMs: number }[],
  startMs: number = STREAM_PACE.startMs
): { starts: number[]; endMs: number } {
  const starts: number[] = [];
  let at = startMs;
  for (const { text, stepMs } of blocks) {
    starts.push(at);
    at = streamEndMs(text, at, stepMs) + STREAM_PACE.pauseMs;
  }
  return { starts, endMs: at };
}

/** For what arrives once the text has finished: give it `animationDelay: endMs`. */
export const ARRIVE_AFTER_STREAM =
  'animate-in fade-in slide-in-from-bottom-2 duration-500 fill-mode-backwards motion-reduce:animate-none';
