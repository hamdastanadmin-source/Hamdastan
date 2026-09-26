import {
  createFormSchema,
  exportQuerySchema,
  formsQuerySchema,
  idSchema,
  responsesQuerySchema,
  submitResponseSchema,
  updateFormSchema,
  uploadAssetSchema,
  z,
} from '@hamdastan/validation';

/**
 * Request validation for the Forms module.
 *
 * Every rule here comes from `@hamdastan/validation`, which is also what the
 * builder and the public form parse against, so the two sides cannot drift.
 *
 * What these schemas do **not** check is whether an answer suits the question
 * that asked for it — that depends on the form being answered, so the service
 * checks it against the question itself. See `assertAnswerValid` there.
 */
export const formsSchemas = {
  list: formsQuerySchema,
  create: createFormSchema,
  update: updateFormSchema,
  responses: responsesQuerySchema,
  export: exportQuerySchema,
  submit: submitResponseSchema,
  uploadAsset: uploadAssetSchema,
  params: z.object({ id: idSchema }),
  responseParams: z.object({ id: idSchema, responseId: idSchema }),
  assetParams: z.object({ assetId: idSchema }),
} satisfies Record<string, z.ZodType>;
