import { APP_LOCALE, APP_TIME_ZONE } from '@hamdastan/config';
import type { AnswerReview, PlayerActivity, PlayerQuestion } from '@hamdastan/types';

/** «جمعه ۲ آبان، ساعت ۲۰:۰۰» — when a competition closes, in Tehran. */
const when = new Intl.DateTimeFormat(APP_LOCALE, {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: APP_TIME_ZONE,
});

export const formatWhen = (iso: string) => when.format(new Date(iso));

/** A revealed answer next to its question and the labels of its right options, in the activity's order. */
export type ReviewedQuestion = AnswerReview & { title: string; rightLabels: string[] };

export function reviewedQuestions(activity: PlayerActivity, review: AnswerReview[]): ReviewedQuestion[] {
  const questions = new Map<string, PlayerQuestion>(activity.steps.flatMap((step) => step.questions).map((question) => [question.id, question]));
  return review.flatMap((item) => {
    const question = questions.get(item.questionId);
    if (!question) return [];
    let rightLabels: string[];
    if (question.kind === 'matching') {
      // The key is one match per prompt, in the prompts' order.
      rightLabels = question.prompts.map(
        (prompt, i) => `${prompt.label} ← ${question.matches.find((match) => match.id === item.correctOptionIds[i])?.label ?? ''}`
      );
    } else if (question.kind === 'single' || question.kind === 'multiple') {
      rightLabels = question.options.filter((option) => item.correctOptionIds.includes(option.id)).map((option) => option.label);
    } else return [];
    return [{ ...item, title: question.title, rightLabels }];
  });
}
