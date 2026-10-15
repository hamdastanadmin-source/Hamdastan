import {
  mediaListQuerySchema,
  mediaReplaceSchema,
  mediaUpdateSchema,
  mediaUploadSchema,
  z,
} from '@hamdastan/validation';

/** Request validation for the Media module; the bodies are the shared schemas the panel parses with. */

const idParams = z.object({ id: z.uuid({ error: 'شناسه معتبر نیست' }) });

export const mediaSchemas = {
  byId: { params: idParams },
  list: { query: mediaListQuerySchema },
  upload: { body: mediaUploadSchema },
  update: { body: mediaUpdateSchema },
  replace: { body: mediaReplaceSchema },
} satisfies Record<string, unknown>;
