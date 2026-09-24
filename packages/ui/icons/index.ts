'use client';

/**
 * Icons.
 *
 * Static icons are imported straight from `lucide-react` at the call site —
 * that is what lets the bundler tree-shake them, and wrapping them here would
 * only defeat it.
 *
 * `Icon` is for the other case: a name that is not known until runtime
 * (config, API data). It loads the glyph lazily.
 */

export { DynamicIcon as Icon } from 'lucide-react/dynamic';
export type { IconName } from 'lucide-react/dynamic';
