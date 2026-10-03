import {
  onboardingEventSchema,
  questionIdSchema,
  questionnaireAnswerSchema,
  z,
} from '@hamdastan/validation';

/**
 * Request validation for the Onboarding module.
 *
 * The answer schema depends on the question — a slider takes a number, Q1 a
 * ranked list — so it is chosen by the `:questionId` in the path. The same
 * schemas are what the screen's limits come from.
 */
export const onboardingSchemas = {
  answer: {
    params: z.object({ questionId: questionIdSchema }),
    body: questionnaireAnswerSchema,
  },
  event: { body: onboardingEventSchema },
} satisfies Record<string, unknown>;

export type OnboardingSchemas = typeof onboardingSchemas;
