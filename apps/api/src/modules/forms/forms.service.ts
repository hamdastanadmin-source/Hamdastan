import { randomUUID } from 'node:crypto';

import type {
  AnswerValue,
  ChoiceBreakdown,
  Form,
  FormQuestion,
  FormResponse,
  FormStats,
  FormSummary,
  FormTemplate,
  FormsOverview,
  Paginated,
  QuestionStats,
  ResponseTrendPoint,
} from '@hamdastan/types';
import { isLayoutQuestion } from '@hamdastan/types';
import {
  IMAGE_MAX_BYTES,
  type CreateFormInput,
  type FormsQueryInput,
  type SubmitResponseInput,
  type UpdateFormInput,
  type UploadAssetInput,
} from '@hamdastan/validation';

import {
  answerOf,
  answerText as asText,
  isEmptyAnswer,
  visibleQuestionIds,
} from '@hamdastan/shared/forms/logic';

import { API_PREFIX } from '@hamdastan/config';

import { toAppDate } from '../../shared/dates';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../shared/errors';
import { defaultFormSettings, formsRepository } from './forms.repository';
import type { FormRecord, ResponseRecord } from './forms.types';

/**
 * Business logic for Forms & surveys — «فرم‌ها و نظرسنجی‌ها».
 *
 * The rules that live here and nowhere else:
 *
 *   - a form is answerable only while it is published **and** inside its
 *     availability window; the window is evaluated here, not stored as status
 *   - publishing needs at least one real question, so an empty form cannot be
 *     sent to anybody
 *   - who may answer is decided from the form's audience, on every submission
 *   - an answer is validated against the question that asked for it — required,
 *     lengths, ranges, and whether the option even exists
 *   - conditional logic decides which questions count as required, so a hidden
 *     question can never block a submission
 *   - statistics are computed over every response, never over a page of them
 *
 * It knows nothing about HTTP (the controller's job) and nothing about storage
 * (the repository's job).
 */

// ─── Views ───────────────────────────────────────────────────────────────────

function toSummary(form: FormRecord, responseCount: number): FormSummary {
  return {
    id: form.id,
    title: form.title,
    ...(form.description ? { description: form.description } : {}),
    status: form.status,
    category: form.category,
    ownerId: form.ownerId,
    ownerUsername: form.ownerUsername,
    ownerName: form.ownerName,
    createdAt: form.createdAt.toISOString(),
    updatedAt: form.updatedAt.toISOString(),
    publishedAt: form.publishedAt?.toISOString() ?? null,
    questionCount: form.questions.filter((question) => !isLayoutQuestion(question.type)).length,
    responseCount,
  };
}

function toForm(form: FormRecord, responseCount: number): Form {
  return {
    ...toSummary(form, responseCount),
    pages: [...form.pages].sort((a, b) => a.order - b.order),
    questions: [...form.questions].sort((a, b) => a.order - b.order),
    conditionalLogic: form.conditionalLogic,
    audience: form.audience,
    settings: form.settings,
  };
}

function toResponseView(response: ResponseRecord): FormResponse {
  return {
    id: response.id,
    formId: response.formId,
    respondentId: response.respondentId,
    respondentName: response.respondentName,
    status: response.status,
    answers: response.answers,
    startedAt: response.startedAt.toISOString(),
    submittedAt: response.submittedAt?.toISOString() ?? null,
    completionSeconds: response.completionSeconds,
  };
}

// ─── Availability ────────────────────────────────────────────────────────────

/**
 * What a respondent would find if they opened this form right now.
 *
 * Derived rather than stored: a form whose closing date passed last night is
 * closed, and nothing has to run at midnight for that to be true.
 */
function effectiveStatus(form: FormRecord): FormRecord['status'] {
  if (form.status !== 'PUBLISHED') return form.status;

  const { alwaysAvailable, publishAt, closeAt } = form.settings.availability;
  if (alwaysAvailable) return 'PUBLISHED';

  const today = toAppDate();
  if (publishAt && today < publishAt) return 'DRAFT';
  if (closeAt && today > closeAt) return 'CLOSED';
  return 'PUBLISHED';
}

/** The respondent asking for a form, as far as this module is concerned. */
export type Respondent = {
  id: string;
  name: string;
  /** The product's role, for an audience limited by role. */
  role: string;
} | null;

function assertAnswerable(form: FormRecord, respondent: Respondent): void {
  const status = effectiveStatus(form);

  if (status === 'DRAFT') {
    throw new BadRequestError('FORM_NOT_YET_OPEN', 'این فرم هنوز در دسترس نیست.');
  }
  if (status === 'CLOSED') {
    throw new BadRequestError('FORM_CLOSED', 'مهلت پاسخ به این فرم به پایان رسیده است.');
  }
  const { audience } = form;
  if (audience.mode === 'EVERYONE') return;

  if (!respondent) {
    throw new ForbiddenError(
      'این فرم فقط برای مخاطبان مشخصی باز است. برای پاسخ دادن وارد حساب خود شوید.',
      'FORM_AUDIENCE_DENIED'
    );
  }

  const allowed =
    (audience.mode === 'USERS' && (audience.userIds ?? []).includes(respondent.id)) ||
    (audience.mode === 'ROLES' && (audience.roles ?? []).includes(respondent.role)) ||
    // Groups are designed but have no entity yet, so nothing matches and the
    // form stays closed rather than silently open to everybody.
    (audience.mode === 'GROUPS' && false);

  if (!allowed) {
    throw new ForbiddenError(
      'این فرم فقط برای مخاطبان انتخاب‌شده باز است و حساب شما میان آن‌ها نیست.',
      'FORM_AUDIENCE_DENIED'
    );
  }
}

// ─── Conditional logic ───────────────────────────────────────────────────────
//
// Evaluated by `@hamdastan/shared/forms/logic`, which the respondent's screen
// and the admin's preview also use. One implementation, so the three cannot
// disagree about which question is being asked.

// ─── Answer validation ───────────────────────────────────────────────────────

const CHOICE_TYPES = new Set(['SINGLE_CHOICE', 'DROPDOWN', 'IMAGE_CHOICE', 'RANKING']);

/**
 * Checks one answer against the question that asked for it.
 *
 * The front-end checks the same things so the respondent sees the message under
 * the field; this is where it is decided, because a browser can be told
 * anything. Throws on the first problem — a form is answered one screen at a
 * time, so a list of every fault at once would be noise.
 */
function assertAnswerValid(question: FormQuestion, value: AnswerValue): void {
  const reject = (message: string): never => {
    throw new BadRequestError('FORM_ANSWER_INVALID', message, { questionId: question.id });
  };

  if (isEmptyAnswer(value)) return;

  const validation = question.validation ?? {};
  const text = typeof value === 'string' ? value : null;

  switch (question.type) {
    case 'SHORT_TEXT':
    case 'LONG_TEXT':
      if (text === null) reject('پاسخ این پرسش باید متن باشد.');
      if (validation.minLength && text!.length < validation.minLength) {
        reject(`پاسخ باید حداقل ${validation.minLength} نویسه باشد.`);
      }
      if (validation.maxLength && text!.length > validation.maxLength) {
        reject(`پاسخ باید حداکثر ${validation.maxLength} نویسه باشد.`);
      }
      break;

    case 'NUMBER':
    case 'SLIDER':
    case 'NUMERIC_SCALE':
    case 'RATING_STARS':
    case 'NPS': {
      const numeric = Number(value);
      if (Number.isNaN(numeric)) reject('پاسخ این پرسش باید عدد باشد.');
      if (validation.min !== undefined && numeric < validation.min) {
        reject(`عدد نباید کمتر از ${validation.min} باشد.`);
      }
      if (validation.max !== undefined && numeric > validation.max) {
        reject(`عدد نباید بیشتر از ${validation.max} باشد.`);
      }
      break;
    }

    case 'EMAIL':
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(asText(value))) {
        reject('نشانی ایمیل معتبر نیست.');
      }
      break;

    case 'PHONE':
      if (!/^0\d{10}$/.test(asText(value).replace(/\s/g, ''))) {
        reject('شماره تماس معتبر نیست.');
      }
      break;

    case 'URL':
      if (!/^https?:\/\/\S+$/.test(asText(value))) {
        reject('نشانی وب باید با http یا https شروع شود.');
      }
      break;

    case 'DATE':
      if (!/^\d{4}-\d{2}-\d{2}$/.test(asText(value))) reject('تاریخ معتبر نیست.');
      break;

    case 'YES_NO':
      if (!['بله', 'خیر'].includes(asText(value))) reject('پاسخ باید «بله» یا «خیر» باشد.');
      break;

    case 'MULTIPLE_CHOICE': {
      if (!Array.isArray(value)) reject('پاسخ این پرسش باید یک یا چند گزینه باشد.');
      const chosen = value as string[];
      if (validation.minSelections && chosen.length < validation.minSelections) {
        reject(`حداقل ${validation.minSelections} گزینه را انتخاب کنید.`);
      }
      if (validation.maxSelections && chosen.length > validation.maxSelections) {
        reject(`حداکثر ${validation.maxSelections} گزینه را می‌توانید انتخاب کنید.`);
      }
      assertOptionsExist(question, chosen, reject);
      break;
    }

    default:
      if (CHOICE_TYPES.has(question.type)) {
        assertOptionsExist(question, Array.isArray(value) ? value : [asText(value)], reject);
      }
  }
}

/**
 * An answer has to be one of the offered options.
 *
 * Skipped when the question allows «سایر», which is exactly a free-text answer
 * that is not in the list.
 */
function assertOptionsExist(
  question: FormQuestion,
  chosen: string[],
  reject: (message: string) => never
): void {
  if (question.settings?.allowOther) return;

  const labels = new Set((question.options ?? []).map((option) => option.label));
  if (labels.size === 0) return;

  for (const value of chosen) {
    if (!labels.has(value)) reject('گزینهٔ انتخاب‌شده معتبر نیست.');
  }
}

// ─── Statistics ──────────────────────────────────────────────────────────────

function percentage(part: number, whole: number): number {
  return whole === 0 ? 0 : Math.round((part / whole) * 1000) / 10;
}

function breakdownOf(values: string[]): ChoiceBreakdown[] {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);

  return [...counts.entries()]
    .map(([label, count]) => ({ label, count, percentage: percentage(count, values.length) }))
    .sort((a, b) => b.count - a.count);
}

/** One question's answers, reduced to whatever its type can be charted as. */
function statsFor(question: FormQuestion, responses: ResponseRecord[]): QuestionStats {
  const answers = responses
    .map((response) => answerOf(response.answers, question.id))
    .filter((value) => !isEmptyAnswer(value));

  const base: QuestionStats = {
    questionId: question.id,
    title: question.title,
    type: question.type,
    answerCount: answers.length,
    skippedCount: responses.length - answers.length,
  };

  switch (question.type) {
    case 'SINGLE_CHOICE':
    case 'DROPDOWN':
    case 'IMAGE_CHOICE':
    case 'YES_NO':
      return { ...base, breakdown: breakdownOf(answers.map(asText)) };

    case 'MULTIPLE_CHOICE':
      // Counted per option rather than per response, so the percentages are
      // "of respondents who picked this", which is what a reader expects.
      return {
        ...base,
        breakdown: breakdownOf(answers.flatMap((value) => (Array.isArray(value) ? value : []))).map(
          (entry) => ({ ...entry, percentage: percentage(entry.count, answers.length) })
        ),
      };

    case 'RATING_STARS':
    case 'NUMERIC_SCALE':
    case 'SLIDER':
    case 'NUMBER': {
      const numbers = answers.map(Number).filter((value) => !Number.isNaN(value));
      return {
        ...base,
        average: numbers.length
          ? Math.round((numbers.reduce((sum, value) => sum + value, 0) / numbers.length) * 10) / 10
          : 0,
        breakdown: breakdownOf(numbers.map(String)).sort((a, b) =>
          Number(a.label) - Number(b.label)
        ),
      };
    }

    case 'NPS': {
      const scores = answers.map(Number).filter((value) => !Number.isNaN(value));
      const promoters = scores.filter((score) => score >= 9).length;
      const passives = scores.filter((score) => score >= 7 && score <= 8).length;
      const detractors = scores.filter((score) => score <= 6).length;

      return {
        ...base,
        average: scores.length
          ? Math.round((scores.reduce((sum, value) => sum + value, 0) / scores.length) * 10) / 10
          : 0,
        npsScore: scores.length
          ? Math.round(percentage(promoters, scores.length) - percentage(detractors, scores.length))
          : 0,
        breakdown: [
          { label: 'مروجان (۹–۱۰)', count: promoters, percentage: percentage(promoters, scores.length) },
          { label: 'خنثی (۷–۸)', count: passives, percentage: percentage(passives, scores.length) },
          { label: 'منتقدان (۰–۶)', count: detractors, percentage: percentage(detractors, scores.length) },
        ],
      };
    }

    default:
      // Everything else reads as text: the answers themselves, newest first.
      return { ...base, textAnswers: answers.map(asText).reverse().slice(0, 100) };
  }
}

function trendOf(responses: ResponseRecord[], days = 14): ResponseTrendPoint[] {
  const counts = new Map<string, number>();

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - offset);
    counts.set(toAppDate(date), 0);
  }

  for (const response of responses) {
    const date = toAppDate(response.submittedAt ?? response.startedAt);
    if (counts.has(date)) counts.set(date, (counts.get(date) ?? 0) + 1);
  }

  return [...counts.entries()].map(([date, count]) => ({ date, count }));
}

// ─── The service ─────────────────────────────────────────────────────────────

export const formsService = {
  /** The four cards above the dashboard, counted over every form. */
  async overview(): Promise<FormsOverview> {
    const repository = formsRepository();
    const forms = await repository.all();
    const counts = await repository.countResponses(forms.map((form) => form.id));

    return {
      totalForms: forms.length,
      publishedForms: forms.filter((form) => effectiveStatus(form) === 'PUBLISHED').length,
      draftForms: forms.filter((form) => form.status === 'DRAFT').length,
      totalResponses: Object.values(counts).reduce((sum, count) => sum + count, 0),
    };
  },

  async list(query: FormsQueryInput): Promise<Paginated<FormSummary>> {
    const repository = formsRepository();
    const { items, total } = await repository.list({
      ...(query.search ? { search: query.search } : {}),
      ...(query.status ? { status: query.status } : {}),
      sort: query.sort,
      page: query.page,
      pageSize: query.pageSize,
    });

    const counts = await repository.countResponses(items.map((form) => form.id));

    return {
      items: items.map((form) => toSummary(form, counts[form.id] ?? 0)),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  },

  async getById(id: string): Promise<Form> {
    const form = await requireForm(id);
    const counts = await formsRepository().countResponses([id]);
    return toForm(form, counts[id] ?? 0);
  },

  async templates(): Promise<FormTemplate[]> {
    const templates = await formsRepository().listTemplates();
    return templates.map((template) => ({
      id: template.id,
      title: template.title,
      description: template.description,
      category: template.category,
      questionCount: template.questions.filter((question) => !isLayoutQuestion(question.type))
        .length,
    }));
  },

  /**
   * Creates a form, blank or from a template.
   *
   * A template is copied rather than referenced, and every id inside it is
   * regenerated: two forms made from one template must not share question ids,
   * or their answers would be indistinguishable.
   */
  async create(
    input: CreateFormInput,
    owner: { id: string; username: string; name: string }
  ): Promise<Form> {
    const repository = formsRepository();

    let pages = [{ id: randomUUID(), title: 'صفحهٔ ۱', order: 0 }];
    let questions: FormQuestion[] = [];
    let category = input.category ?? 'OTHER';

    if (input.templateId) {
      const template = await repository.findTemplateById(input.templateId);
      if (!template) throw new NotFoundError('این الگو یافت نشد');

      const pageIds = new Map(template.pages.map((page) => [page.id, randomUUID()]));
      pages = template.pages.map((page) => ({ ...page, id: pageIds.get(page.id)! }));
      questions = template.questions.map((question) => ({
        ...question,
        id: randomUUID(),
        pageId: pageIds.get(question.pageId) ?? pages[0].id,
        options: question.options?.map((option) => ({ ...option, id: randomUUID() })),
      }));
      category = input.category ?? template.category;
    }

    const created = await repository.create({
      title: input.title,
      ...(input.description ? { description: input.description } : {}),
      status: 'DRAFT',
      category,
      ownerId: owner.id,
      ownerUsername: owner.username,
      ownerName: owner.name,
      pages,
      questions,
      conditionalLogic: [],
      audience: { mode: 'EVERYONE' },
      settings: defaultFormSettings(),
      publishedAt: null,
    });

    return toForm(created, 0);
  },

  /** The builder's autosave: whatever changed, replacing what is stored. */
  async update(id: string, patch: UpdateFormInput): Promise<Form> {
    await requireForm(id);

    const updated = await formsRepository().update(id, patch);
    if (!updated) throw new NotFoundError('این فرم یافت نشد');

    const counts = await formsRepository().countResponses([id]);
    return toForm(updated, counts[id] ?? 0);
  },

  /**
   * Publishes a form.
   *
   * The one check that matters: a form with no real question cannot be
   * published, because the link would open on nothing.
   */
  async publish(id: string): Promise<Form> {
    const form = await requireForm(id);

    const answerable = form.questions.filter((question) => !isLayoutQuestion(question.type));
    if (answerable.length === 0) {
      throw new BadRequestError(
        'FORM_HAS_NO_QUESTIONS',
        'برای انتشار، فرم باید حداقل یک پرسش داشته باشد.'
      );
    }

    return this.setStatus(id, 'PUBLISHED', form.publishedAt ?? new Date());
  },

  /** Back to a draft. The link stops working; the answers stay. */
  async unpublish(id: string): Promise<Form> {
    await requireForm(id);
    return this.setStatus(id, 'DRAFT', null);
  },

  /** Stops accepting answers without hiding what came in. */
  async close(id: string): Promise<Form> {
    const form = await requireForm(id);
    return this.setStatus(id, 'CLOSED', form.publishedAt);
  },

  async setStatus(
    id: string,
    status: FormRecord['status'],
    publishedAt: Date | null
  ): Promise<Form> {
    const updated = await formsRepository().update(id, { status, publishedAt });
    if (!updated) throw new NotFoundError('این فرم یافت نشد');

    const counts = await formsRepository().countResponses([id]);
    return toForm(updated, counts[id] ?? 0);
  },

  /**
   * Copies a form, without its answers.
   *
   * The copy is a draft: publishing is a decision, and inheriting it would put
   * a half-edited duplicate in front of respondents.
   */
  async duplicate(
    id: string,
    owner: { id: string; username: string; name: string }
  ): Promise<Form> {
    const form = await requireForm(id);

    const created = await formsRepository().create({
      ...form,
      title: `${form.title} (رونوشت)`,
      status: 'DRAFT',
      ownerId: owner.id,
      ownerUsername: owner.username,
      ownerName: owner.name,
      publishedAt: null,
    });

    return toForm(created, 0);
  },

  async remove(id: string): Promise<void> {
    await requireForm(id);
    await formsRepository().remove(id);
  },

  // ─── The respondent's side ────────────────────────────────────────────────

  /**
   * The form as somebody about to answer it sees it.
   *
   * Refuses anything that is not answerable by this respondent right now, so
   * the public page never has to decide that for itself.
   */
  async getPublished(id: string, respondent: Respondent): Promise<Form> {
    const form = await requireForm(id);

    if (form.status === 'DRAFT' && effectiveStatus(form) === 'DRAFT') {
      throw new BadRequestError('FORM_NOT_PUBLISHED', 'این فرم هنوز منتشر نشده است.');
    }

    assertAnswerable(form, respondent);

    if (form.settings.responses.onePerUser && respondent) {
      const existing = await formsRepository().findResponseByRespondent(id, respondent.id);
      if (existing?.status === 'COMPLETE' && !form.settings.responses.allowEditAfterSubmit) {
        throw new BadRequestError(
          'FORM_ALREADY_ANSWERED',
          'شما قبلاً به این فرم پاسخ داده‌اید.'
        );
      }
    }

    const counts = await formsRepository().countResponses([id]);
    return toForm(form, counts[id] ?? 0);
  },

  /**
   * Records an answer.
   *
   * Everything is re-checked here: the window, the audience, the one-response
   * rule, and every answer against its own question. A partial submission —
   * somebody moving between pages — skips the required check, because they have
   * not finished yet.
   */
  async submitResponse(
    id: string,
    input: SubmitResponseInput,
    respondent: Respondent
  ): Promise<FormResponse> {
    const repository = formsRepository();
    const form = await requireForm(id);

    if (form.status !== 'PUBLISHED') {
      throw new BadRequestError('FORM_NOT_PUBLISHED', 'این فرم پذیرای پاسخ نیست.');
    }
    assertAnswerable(form, respondent);

    const anonymous = form.settings.responses.anonymous;
    const identity = anonymous ? null : respondent;

    const existing =
      form.settings.responses.onePerUser && respondent
        ? await repository.findResponseByRespondent(id, respondent.id)
        : null;

    if (
      existing?.status === 'COMPLETE' &&
      !form.settings.responses.allowEditAfterSubmit
    ) {
      throw new BadRequestError('FORM_ALREADY_ANSWERED', 'شما قبلاً به این فرم پاسخ داده‌اید.');
    }

    const visible = visibleQuestionIds(form, input.answers);
    const byId = new Map(form.questions.map((question) => [question.id, question]));

    for (const answer of input.answers) {
      const question = byId.get(answer.questionId);
      // An answer to a question this form does not have is dropped rather than
      // stored: it would only ever be noise in an export.
      if (!question) continue;
      assertAnswerValid(question, answer.value);
    }

    if (input.complete) {
      for (const question of form.questions) {
        if (!question.required || isLayoutQuestion(question.type)) continue;
        if (!visible.has(question.id)) continue;

        if (isEmptyAnswer(answerOf(input.answers, question.id))) {
          throw new BadRequestError(
            'FORM_ANSWER_INVALID',
            `پاسخ به «${question.title}» الزامی است.`,
            { questionId: question.id }
          );
        }
      }
    }

    const answers = input.answers.filter((answer) => byId.has(answer.questionId));
    const now = new Date();
    const status = input.complete ? 'COMPLETE' : 'PARTIAL';

    if (existing) {
      const updated = await repository.updateResponse(existing.id, {
        answers,
        status,
        submittedAt: input.complete ? now : null,
        completionSeconds: input.complete ? input.elapsedSeconds ?? null : null,
      });
      return toResponseView(updated!);
    }

    const created = await repository.createResponse({
      formId: id,
      respondentId: identity?.id ?? null,
      respondentName: identity?.name ?? null,
      status,
      answers,
      startedAt: input.elapsedSeconds
        ? new Date(now.getTime() - input.elapsedSeconds * 1000)
        : now,
      submittedAt: input.complete ? now : null,
      completionSeconds: input.complete ? input.elapsedSeconds ?? null : null,
    });

    return toResponseView(created);
  },

  // ─── Responses, for the admin ─────────────────────────────────────────────

  async listResponses(
    id: string,
    page: number,
    pageSize: number
  ): Promise<Paginated<FormResponse>> {
    await requireForm(id);

    const { items, total } = await formsRepository().listResponses(id, page, pageSize);
    return { items: items.map(toResponseView), page, pageSize, total };
  },

  async getResponse(id: string, responseId: string): Promise<FormResponse> {
    await requireForm(id);

    const response = await formsRepository().findResponseById(responseId);
    if (!response || response.formId !== id) throw new NotFoundError('این پاسخ یافت نشد');

    return toResponseView(response);
  },

  /** Every statistic the responses dashboard shows, over every response. */
  async stats(id: string): Promise<FormStats> {
    const form = await requireForm(id);
    const responses = await formsRepository().allResponses(id);

    const completed = responses.filter((response) => response.status === 'COMPLETE');
    const times = completed
      .map((response) => response.completionSeconds)
      .filter((seconds): seconds is number => seconds !== null);

    return {
      totalResponses: responses.length,
      completedResponses: completed.length,
      incompleteResponses: responses.length - completed.length,
      completionRate: percentage(completed.length, responses.length),
      averageCompletionSeconds: times.length
        ? Math.round(times.reduce((sum, value) => sum + value, 0) / times.length)
        : 0,
      trend: trendOf(responses),
      questions: form.questions
        .filter((question) => !isLayoutQuestion(question.type))
        .sort((a, b) => a.order - b.order)
        .map((question) => statsFor(question, responses)),
    };
  },

  /**
   * Stores an image an author uploaded for a question's background.
   *
   * The size is checked on the **decoded** bytes, because base64 inflates by a
   * third and a limit on the encoded string would let a larger file through.
   * What goes back is a URL; the form document never carries the bytes.
   */
  async uploadAsset(
    id: string,
    input: UploadAssetInput
  ): Promise<{ url: string }> {
    await requireForm(id);

    const bytes = Buffer.from(input.data, 'base64');

    if (bytes.length === 0) {
      throw new BadRequestError('FORM_ASSET_INVALID', 'فایل تصویر خوانده نشد.');
    }
    if (bytes.length > IMAGE_MAX_BYTES) {
      throw new BadRequestError(
        'FORM_ASSET_TOO_LARGE',
        `حجم تصویر باید کمتر از ${Math.round(IMAGE_MAX_BYTES / 1024 / 1024)} مگابایت باشد.`
      );
    }

    const asset = await formsRepository().saveAsset({
      formId: id,
      filename: input.filename,
      contentType: input.contentType,
      bytes,
    });

    return { url: `${API_PREFIX}/forms/assets/${asset.id}` };
  },

  /** The image itself, for whoever is rendering the form. */
  async getAsset(assetId: string): Promise<{ contentType: string; bytes: Buffer }> {
    const asset = await formsRepository().findAsset(assetId);
    if (!asset) throw new NotFoundError('این تصویر یافت نشد');

    return { contentType: asset.contentType, bytes: asset.bytes };
  },

  /**
   * The responses as a spreadsheet.
   *
   * One row per response, one column per question, in the form's own order —
   * which is why it is built here and not in the browser: only the backend has
   * every response.
   */
  async exportResponses(id: string): Promise<{ filename: string; rows: string[][] }> {
    const form = await requireForm(id);
    const responses = await formsRepository().allResponses(id);

    const questions = form.questions
      .filter((question) => !isLayoutQuestion(question.type))
      .sort((a, b) => a.order - b.order);

    const header = [
      'شناسهٔ پاسخ',
      'پاسخ‌دهنده',
      'وضعیت',
      'تاریخ ثبت',
      'مدت پاسخ‌گویی (ثانیه)',
      ...questions.map((question) => question.title),
    ];

    const rows = responses
      .sort((a, b) => (a.submittedAt ?? a.startedAt).getTime() - (b.submittedAt ?? b.startedAt).getTime())
      .map((response) => [
        response.id,
        response.respondentName ?? 'ناشناس',
        response.status === 'COMPLETE' ? 'کامل' : 'ناقص',
        (response.submittedAt ?? response.startedAt).toISOString(),
        response.completionSeconds === null ? '' : String(response.completionSeconds),
        ...questions.map((question) => asText(answerOf(response.answers, question.id))),
      ]);

    return { filename: `${form.title}.csv`, rows: [header, ...rows] };
  },
};

async function requireForm(id: string): Promise<FormRecord> {
  const form = await formsRepository().findById(id);
  if (!form) throw new NotFoundError('این فرم یافت نشد');
  return form;
}
