import type { SectionId } from '@hamdastan/config';

/** The questionnaire's sections, in order. Their names are `QUESTIONNAIRE_SECTION_LABELS`. */
export const SECTIONS = [1, 2, 3, 4] as const satisfies readonly SectionId[];
