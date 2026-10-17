import type { AdminEventCategory, AdminWorld } from '@hamdastan/types';

import type { EventEditorApi } from '../../hooks/use-event-editor';

/** What every editor section is given. */
export type SectionProps = {
  editor: EventEditorApi;
  categories: AdminEventCategory[];
  worlds: AdminWorld[];
};

/** A selected toggle reads by its foreground border, never the brand colour. */
export const TOGGLE_ITEM = 'h-10 rounded-lg border px-4 data-[state=on]:border-foreground data-[state=on]:bg-accent';
