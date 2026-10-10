/**
 * A sliding-window counter for `@fastify/rate-limit`.
 *
 * The plugin's own in-memory store is a fixed window, which admits twice the
 * limit across a window boundary — `max` requests in the last second of one
 * minute and `max` more in the first second of the next. This store keeps
 * the current window's count and the previous one's, and weights the
 * previous by how much of it still overlaps the last `timeWindow`
 * milliseconds — the usual approximation of a true sliding log, at two
 * integers per key.
 *
 * It is in-process memory: correct for the single API instance this project
 * runs. Several instances would each count separately; that is the day to
 * give the plugin its `redis` option instead (see docs/ARCHITECTURE.md §4).
 *
 * Rejected requests are counted too, so a client that keeps hammering stays
 * limited rather than being let through the moment the estimate dips.
 */

type Entry = { windowStart: number; previous: number; current: number };

type IncrResult = { current: number; ttl: number };
type Callback = (error: Error | null, result: IncrResult) => void;

/** Weighted request count, and how long until it no longer blocks. */
export function measure(
  entry: Entry,
  now: number,
  timeWindow: number,
  max: number
): IncrResult {
  const elapsed = now - entry.windowStart;
  const estimate = entry.previous * (1 - elapsed / timeWindow) + entry.current;
  const untilWindowEnd = timeWindow - elapsed;

  if (estimate <= max) return { current: Math.ceil(estimate), ttl: untilWindowEnd };

  // Over the limit: when will one more request fit? First, later in this
  // window as the previous window's weight fades…
  const room = max - 1 - entry.current;
  if (room >= 0 && entry.previous > 0) {
    const at = timeWindow * (1 - room / entry.previous);
    if (at <= timeWindow) {
      return { current: Math.ceil(estimate), ttl: Math.max(1000, at - elapsed) };
    }
  }
  // …otherwise in the next window, where this one's count is the one fading.
  const intoNext = entry.current > max - 1 ? timeWindow * (1 - (max - 1) / entry.current) : 0;
  return { current: Math.ceil(estimate), ttl: Math.max(1000, untilWindowEnd + intoNext) };
}

/** The store class the plugin instantiates, remembering at most `maxKeys` keys. */
export function slidingWindowStore(maxKeys: number) {
  return class SlidingWindowStore {
    // A Map iterates in insertion order; re-inserting on every touch makes
    // the first key the least recently used, which is the one to forget.
    private readonly entries = new Map<string, Entry>();

    /** One store per route policy, so their counts never mix. */
    child(): SlidingWindowStore {
      return new SlidingWindowStore();
    }

    incr(key: string, callback: Callback, timeWindow: number, max: number): void {
      const now = Date.now();
      const entry = this.advance(key, now, timeWindow);
      entry.current += 1;
      callback(null, measure(entry, now, timeWindow, max));
    }

    private advance(key: string, now: number, timeWindow: number): Entry {
      const aligned = now - (now % timeWindow);
      const entry = this.entries.get(key) ?? { windowStart: aligned, previous: 0, current: 0 };

      const windowsPassed = Math.floor((aligned - entry.windowStart) / timeWindow);
      if (windowsPassed >= 2) {
        entry.previous = 0;
        entry.current = 0;
        entry.windowStart = aligned;
      } else if (windowsPassed === 1) {
        entry.previous = entry.current;
        entry.current = 0;
        entry.windowStart = aligned;
      }

      this.entries.delete(key);
      this.entries.set(key, entry);
      if (this.entries.size > maxKeys) {
        const oldest = this.entries.keys().next().value;
        if (oldest !== undefined) this.entries.delete(oldest);
      }
      return entry;
    }
  };
}
