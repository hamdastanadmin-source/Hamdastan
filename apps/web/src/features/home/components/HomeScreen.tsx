import { toPersianDigits } from '@hamdastan/shared';

import { QuizCard } from './QuizCard';

/**
 * The signed-in home screen: a greeting, and the quizzes below it.
 *
 * The quizzes are front-end only for now, and the reason is specific: nothing
 * in `apps/api` can list them. The `forms` module serves one published form at
 * `GET /forms/{id}` — the link an admin shares — and `trivia` is still an empty
 * skeleton, so there is no endpoint that answers "which quizzes can this user
 * take?". That endpoint is what this screen is waiting on.
 *
 * Until then the list below stands in, and does not pretend otherwise: every
 * card says «به‌زودی» and none of them can be clicked. When the endpoint
 * exists, this feature grows a `services/` directory, the call goes through
 * `@/services`, and the constant goes.
 */

/** Placeholder count — how many cards the layout is designed around. */
const PLACEHOLDER_QUIZ_COUNT = 6;

const PLACEHOLDER_QUIZZES = Array.from(
  { length: PLACEHOLDER_QUIZ_COUNT },
  (_, index) => `آزمون ${toPersianDigits(index + 1)}`
);

export function HomeScreen({ firstName }: { firstName: string }) {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 p-4 sm:space-y-10 sm:p-6">
      <section className="space-y-1.5">
        <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          سلام {firstName} 👋
        </h2>
        <p className="text-sm text-muted-foreground sm:text-base">
          خوش آمدی! از آزمون‌های پایین شروع کن.
        </p>
      </section>

      <section className="space-y-4">
        <h3 className="text-base font-semibold text-foreground sm:text-lg">آزمون‌ها</h3>

        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
          {PLACEHOLDER_QUIZZES.map((title) => (
            <li key={title}>
              <QuizCard title={title} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
