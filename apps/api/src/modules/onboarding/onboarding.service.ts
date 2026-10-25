import { randomBytes } from 'node:crypto';

import { MIN_INTEREST_CATEGORIES, type InterestCategory, type Question, type QuestionId } from '@hamdastan/config';
import { toPersianDigits } from '@hamdastan/shared/format/persian';
import type {
  AdminInterestCategory,
  AdminQuestion,
  Gender,
  OnboardingInterests,
  QuestionnaireAnswer,
  QuestionnaireAnswers,
  QuestionnaireCompletion,
  QuestionnaireResult,
  QuestionnaireState,
} from '@hamdastan/types';
import {
  INTERESTS_PER_CATEGORY_MAX,
  interestCategoryIndex,
  interestSelectionError,
  sheetKey,
  type InterestCategoryInputBody,
  type InterestImportInput,
  type OnboardingEventBody,
  type QuestionInputBody,
} from '@hamdastan/validation';

import { ForbiddenError, NotFoundError, ValidationError } from '../../shared/errors';
import { missionsService } from '../missions';
import { nextStepFor, type UserRecord } from '../users';

import { onboardingRepository } from './onboarding.repository';
import { buildResult, interestGroups } from './onboarding.result';
import { computeProfile, isComplete, resumePoint } from './onboarding.scoring';
import type { DerivedQuestionnaire, InterestCategoryFields, QuestionFields, QuestionnaireRecord } from './onboarding.types';

/**
 * Business logic for onboarding — stage 1's interests, stage 2's social
 * questionnaire, and the panel that edits the catalogs behind both.
 *
 * Every questionnaire save goes the same way: store the raw answer, then
 * rebuild the whole profile from all of the stored answers (`derive`).
 * Nothing is added to a running total, so an edited answer replaces its old
 * contribution rather than stacking on it, and the result is the same
 * however the person got there.
 */

/** The whole derived row: the profile, and where to resume in `questions`. */
export function deriveQuestionnaire(
  answers: QuestionnaireAnswers,
  questions: readonly Question[]
): DerivedQuestionnaire {
  return { ...computeProfile(answers), ...resumePoint(answers, questions) };
}

/** What the card needs from outside the questionnaire: stage 1's picks, and the gender that picks the character. */
type ResultContext = { catalog: InterestCategory[]; interestIds: readonly string[]; gender: Gender | null };

/** The questions as the product sees them — `scored` is the panel's business. */
const forProduct = (questions: AdminQuestion[]): Question[] =>
  questions.map((question) => {
    const product: Question & { scored?: boolean } = { ...question };
    delete product.scored;
    return product;
  });

const loadQuestions = async () => forProduct(await onboardingRepository().listQuestions());

/**
 * What the browser is allowed to see: the questions, its answers (to those
 * questions only), its place, and the card once it has earned it.
 */
export function toQuestionnaireState(
  record: QuestionnaireRecord,
  questions: Question[],
  { catalog, interestIds, gender }: ResultContext
): QuestionnaireState {
  const asked = new Set(questions.map(({ id }) => id));
  const answers = Object.fromEntries(Object.entries(record.answers).filter(([id]) => asked.has(id)));
  const { currentQuestionId, progress } = resumePoint(answers, questions);
  return {
    questions,
    answers,
    resumeQuestionId: currentQuestionId,
    progress,
    completed: record.completed,
    result: record.completed
      ? buildResult(computeProfile(record.answers), interestGroups(catalog, interestIds), gender)
      : null,
  };
}

async function resultContext(user: UserRecord): Promise<ResultContext> {
  const [catalog, interestIds] = await Promise.all([
    onboardingRepository().listInterestCategories(),
    onboardingRepository().findInterestIds(user.id),
  ]);
  return { catalog, interestIds, gender: user.gender };
}

/** Stage 1's picks, in catalog order, with the categories they span. Ids that left the catalog are dropped. */
function toOnboardingInterests(
  onboardingStage: number,
  catalog: InterestCategory[],
  interestIds: readonly string[]
): OnboardingInterests {
  const saved = new Set(interestIds);
  const picked = catalog.filter((category) => category.interests.some(({ id }) => saved.has(id)));
  return {
    onboardingStage,
    categories: catalog.filter((category) => category.interests.length > 0),
    selectedCategories: picked.map(({ id }) => id),
    selectedInterests: picked.flatMap((category) =>
      category.interests.filter(({ id }) => saved.has(id)).map(({ id }) => id)
    ),
  };
}

/** Stage 2 follows stage 1: no answers before the interests are saved. */
function requireInterestsSaved(user: UserRecord): void {
  if (user.onboardingStage < 1) throw new ForbiddenError('اول علاقه‌مندی‌هات رو انتخاب کن');
}

/** A short, never-reused id for something created from the panel. */
const newId = (prefix: string) => `${prefix}_${randomBytes(6).toString('base64url')}`;

/** A catalog that leaves fewer categories to pick from than stage 1 asks for would lock everyone out. */
function requirePickableCatalog(catalog: readonly InterestCategory[]): void {
  if (catalog.filter((category) => category.interests.length > 0).length < MIN_INTEREST_CATEGORIES) {
    throw new ValidationError(`دست‌کم ${toPersianDigits(MIN_INTEREST_CATEGORIES)} دسته با علاقه‌مندی لازم است تا کاربران بتوانند مرحله‌ی اول را تمام کنند`);
  }
}

/**
 * A scored question's shape is the scoring engine's contract: the panel may
 * reword it and move it, never change its kind, its cap or its option codes.
 */
function requireSameShape(stored: AdminQuestion, input: QuestionInputBody): void {
  const sameOptions =
    stored.kind === 'slider'
      ? input.options.length === 0
      : stored.options.length === input.options.length &&
        stored.options.every((option, i) => option.code === input.options[i].code);
  const sameCap = stored.kind === 'slider' || (stored.maxSelections ?? null) === input.maxSelections;
  if (stored.kind !== input.kind || !sameOptions || !sameCap) {
    throw new ValidationError('نوع، گزینه‌ها و سقف انتخاب سؤال‌های امتیازدار قابل تغییر نیست؛ فقط متن‌ها');
  }
}

/** Options keep the codes they came with — but only codes this question already has. New ones get one. */
function withCodes(input: QuestionInputBody, stored?: AdminQuestion): QuestionFields {
  const known = new Set(stored && stored.kind !== 'slider' ? stored.options.map(({ code }) => code) : []);
  return {
    ...input,
    options: input.options.map(({ code, label }) => ({
      code: code && known.has(code) ? code : newId('opt'),
      label,
    })),
  };
}

/**
 * Every method takes the `UserRecord` `authenticate` loaded for this
 * request, so none of them reads the user row again.
 */
export const onboardingService = {
  // ─── Stage 1 ──────────────────────────────────────────────────────────
  async getInterests(user: UserRecord): Promise<OnboardingInterests> {
    const { catalog, interestIds } = await resultContext(user);
    return toOnboardingInterests(user.onboardingStage, catalog, interestIds);
  },

  /**
   * Stage 1. Every id must be in the catalog and they must span at least
   * three categories — the same `interestSelectionError` the screen runs.
   * The category of each interest is looked up here, never trusted from the
   * request.
   */
  async saveInterests(user: UserRecord, interestIds: string[]): Promise<OnboardingInterests> {
    if (nextStepFor(user) === 'basic_info') {
      throw new ForbiddenError('اول اطلاعات پایه‌ات رو کامل کن');
    }
    const catalog = await onboardingRepository().listInterestCategories();
    const categoryOf = interestCategoryIndex(catalog);
    const error = interestSelectionError(interestIds, categoryOf);
    if (error) throw new ValidationError(error);

    const stage = await onboardingRepository().saveInterests(
      user.id,
      interestIds.map((interestId) => ({ interestId, categoryId: categoryOf.get(interestId)! }))
    );
    return toOnboardingInterests(stage, catalog, interestIds);
  },

  // ─── Stage 2 ──────────────────────────────────────────────────────────
  async getQuestionnaire(user: UserRecord): Promise<QuestionnaireState> {
    requireInterestsSaved(user);
    const [record, questions, context] = await Promise.all([
      onboardingRepository().findQuestionnaire(user.id),
      loadQuestions(),
      resultContext(user),
    ]);
    return toQuestionnaireState(record, questions, context);
  },

  /** The question an answer is for, so the controller can validate against it. */
  async question(questionId: QuestionId): Promise<Question> {
    const question = (await loadQuestions()).find(({ id }) => id === questionId);
    if (!question) throw new NotFoundError('این سؤال دیگه وجود نداره');
    return question;
  },

  /**
   * One answer, already validated against its question. The presentation
   * index is looked up here, never taken from the request.
   */
  async saveAnswer(user: UserRecord, questionId: QuestionId, answer: QuestionnaireAnswer): Promise<QuestionnaireState> {
    requireInterestsSaved(user);
    const questions = await loadQuestions();
    const record = await onboardingRepository().saveAnswer(
      user.id,
      { questionId, answer, presentationIndex: questions.findIndex(({ id }) => id === questionId) + 1 },
      (answers) => deriveQuestionnaire(answers, questions)
    );
    const context = record.completed ? await resultContext(user) : { catalog: [], interestIds: [], gender: user.gender };
    return toQuestionnaireState(record, questions, context);
  },

  /**
   * Finishing is the server's call: every question has to have an answer.
   * Idempotent, reward included — the personality-test mission pays once
   * however many times this is called, and a call that failed half-way
   * grants it on the retry.
   */
  async complete(user: UserRecord): Promise<QuestionnaireCompletion> {
    requireInterestsSaved(user);
    const [record, questions, context] = await Promise.all([
      onboardingRepository().findQuestionnaire(user.id),
      loadQuestions(),
      resultContext(user),
    ]);
    if (!isComplete(record.answers, questions)) {
      throw new ValidationError('هنوز به چند سؤال جواب ندادی');
    }
    if (!record.completed) await onboardingRepository().markCompleted(user.id);
    const xpAwarded = await missionsService.complete(user.id, 'personality_test');
    return { ...toQuestionnaireState({ ...record, completed: true }, questions, context), xpAwarded };
  },

  /** The result card once the questionnaire is finished; null before. For the account area. */
  async getResult(user: UserRecord): Promise<QuestionnaireResult | null> {
    const [record, { catalog, interestIds }] = await Promise.all([
      onboardingRepository().findQuestionnaire(user.id),
      resultContext(user),
    ]);
    if (!record.completed) return null;
    return buildResult(computeProfile(record.answers), interestGroups(catalog, interestIds), user.gender);
  },

  async recordEvent(userId: string, body: OnboardingEventBody): Promise<void> {
    const index = body.questionId ? (await loadQuestions()).findIndex(({ id }) => id === body.questionId) + 1 : 0;
    await onboardingRepository().recordEvent(userId, {
      event: body.event,
      questionId: body.questionId ?? null,
      presentationIndex: index || null,
      sectionId: (body.sectionId as 1 | 2 | 3 | 4 | undefined) ?? null,
      properties: body.properties ?? {},
    });
  },

  // ─── The panel: interests ─────────────────────────────────────────────
  adminInterestCategories(): Promise<AdminInterestCategory[]> {
    return onboardingRepository().listAdminInterestCategories();
  },

  async createInterestCategory(input: InterestCategoryInputBody): Promise<AdminInterestCategory[]> {
    await onboardingRepository().saveInterestCategories([
      {
        id: newId('cat'),
        isNew: true,
        title: input.title,
        interests: input.interests.map(({ label }) => ({ id: newId('int'), label })),
      },
    ]);
    return this.adminInterestCategories();
  },

  /**
   * Kept interests keep their ids — so everyone who picked one still has
   * it — and only ids already in *this* category count as kept: an interest
   * never moves between categories.
   */
  async updateInterestCategory(id: string, input: InterestCategoryInputBody): Promise<AdminInterestCategory[]> {
    const catalog = await onboardingRepository().listInterestCategories();
    const stored = catalog.find((category) => category.id === id);
    if (!stored) throw new NotFoundError('دسته یافت نشد');

    const own = new Set(stored.interests.map((interest) => interest.id));
    const interests = input.interests.map(({ id: interestId, label }) => ({
      id: interestId && own.has(interestId) ? interestId : newId('int'),
      label,
    }));
    requirePickableCatalog(catalog.map((category) => (category.id === id ? { ...category, interests } : category)));

    await onboardingRepository().saveInterestCategories([{ id, isNew: false, title: input.title, interests }]);
    return this.adminInterestCategories();
  },

  /**
   * The Excel import. A category whose title matches one in the catalog
   * (spacing and ZWNJ aside) gets the new interests after its own, skipping
   * any it already has; any other title becomes a new category at the end.
   * One transaction: the whole file goes in, or none of it.
   */
  async importInterests(input: InterestImportInput): Promise<AdminInterestCategory[]> {
    const catalog = await onboardingRepository().listInterestCategories();
    const byTitle = new Map(catalog.map((category) => [sheetKey(category.title), category]));
    const changes = new Map<string, InterestCategoryFields & { id: string; isNew: boolean }>();

    for (const { title, interests } of input.categories) {
      const stored = byTitle.get(sheetKey(title));
      const entry =
        changes.get(sheetKey(title)) ??
        (stored
          ? { id: stored.id, isNew: false, title: stored.title, interests: stored.interests.map(({ id, label }) => ({ id, label })) }
          : { id: newId('cat'), isNew: true, title, interests: [] });
      const known = new Set(entry.interests.map(({ label }) => sheetKey(label)));
      for (const label of interests) {
        if (known.has(sheetKey(label))) continue;
        known.add(sheetKey(label));
        entry.interests.push({ id: newId('int'), label });
      }
      changes.set(sheetKey(title), entry);
    }

    if ([...changes.values()].some(({ interests }) => interests.length > INTERESTS_PER_CATEGORY_MAX)) {
      throw new ValidationError(`هر دسته حداکثر ${toPersianDigits(INTERESTS_PER_CATEGORY_MAX)} علاقه‌مندی می‌تواند داشته باشد`);
    }
    await onboardingRepository().saveInterestCategories([...changes.values()]);
    return this.adminInterestCategories();
  },

  async reorderInterestCategories(ids: string[]): Promise<AdminInterestCategory[]> {
    await onboardingRepository().reorderInterestCategories(ids);
    return this.adminInterestCategories();
  },

  /**
   * People who picked from a deleted category keep their rows — they are
   * history — but the category no longer shows, and no longer counts toward
   * stage 1's minimum for anyone saving again.
   */
  async removeInterestCategory(id: string): Promise<{ deleted: true }> {
    const catalog = await onboardingRepository().listInterestCategories();
    requirePickableCatalog(catalog.filter((category) => category.id !== id));
    if (!(await onboardingRepository().removeInterestCategory(id))) throw new NotFoundError('دسته یافت نشد');
    return { deleted: true };
  },

  // ─── The panel: questions ─────────────────────────────────────────────
  adminQuestions(): Promise<AdminQuestion[]> {
    return onboardingRepository().listQuestions();
  },

  async createQuestion(input: QuestionInputBody): Promise<AdminQuestion[]> {
    return this.importQuestions({ questions: [input] });
  },

  /** The Excel import: every question appended, unscored, in one transaction. */
  async importQuestions(input: { questions: QuestionInputBody[] }): Promise<AdminQuestion[]> {
    await onboardingRepository().createQuestions(input.questions.map((question) => ({ id: newId('q'), ...withCodes(question) })));
    return this.adminQuestions();
  },

  async updateQuestion(id: string, input: QuestionInputBody): Promise<AdminQuestion[]> {
    const stored = (await onboardingRepository().listQuestions()).find((question) => question.id === id);
    if (!stored) throw new NotFoundError('سؤال یافت نشد');
    if (stored.scored) requireSameShape(stored, input);
    await onboardingRepository().updateQuestion(id, withCodes(input, stored));
    return this.adminQuestions();
  },

  async reorderQuestions(ids: string[]): Promise<AdminQuestion[]> {
    await onboardingRepository().reorderQuestions(ids);
    return this.adminQuestions();
  },

  /** A scored question cannot go: the profile is computed from it. Answers already given stay stored. */
  async removeQuestion(id: string): Promise<{ deleted: true }> {
    const stored = (await onboardingRepository().listQuestions()).find((question) => question.id === id);
    if (!stored) throw new NotFoundError('سؤال یافت نشد');
    if (stored.scored) throw new ValidationError('سؤال‌های امتیازدار در محاسبه‌ی پروفایل استفاده می‌شوند و حذف‌شدنی نیستند');
    await onboardingRepository().removeQuestion(id);
    return { deleted: true };
  },
};
