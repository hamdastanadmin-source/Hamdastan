import type { UseFormReturn } from 'react-hook-form';

import type { WorldInput } from '@hamdastan/types';
import type { worldInputSchema, z } from '@hamdastan/validation';

export type WorldFormInput = z.input<typeof worldInputSchema>;

/** The one form the identity and menu tabs share; saved together. */
export type WorldForm = UseFormReturn<WorldFormInput, unknown, WorldInput>;
