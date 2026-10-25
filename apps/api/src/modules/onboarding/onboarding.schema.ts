import {
  catalogReorderSchema,
  interestCategoryInputSchema,
  interestImportSchema,
  interestsSchema,
  onboardingEventSchema,
  questionIdSchema,
  questionInputSchema,
  questionnaireAnswerSchema,
  questionnaireImportSchema,
  z,
} from '@hamdastan/validation';

/**
 * Request validation for the Onboarding module.
 *
 * The answer schema depends on the question — a slider takes a number, a
 * ranked question a list — so it is built from the question as stored,
 * which the controller reads by the `:questionId` in the path.
 */
export const onboardingSchemas = {
  interests: { body: interestsSchema },
  answer: {
    params: z.object({ questionId: questionIdSchema }),
    body: questionnaireAnswerSchema,
  },
  event: { body: onboardingEventSchema },
  // The panel.
  byId: { params: z.object({ id: z.string().min(1).max(40) }) },
  category: { body: interestCategoryInputSchema },
  question: { body: questionInputSchema },
  interestImport: { body: interestImportSchema },
  questionImport: { body: questionnaireImportSchema },
  reorder: { body: catalogReorderSchema },
} satisfies Record<string, unknown>;

export type OnboardingSchemas = typeof onboardingSchemas;
