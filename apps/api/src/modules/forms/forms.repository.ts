import { randomUUID } from 'node:crypto';

import type { FormAnswer, FormQuestion, FormSettings, QuestionType } from '@hamdastan/types';

import { createRepositorySlot } from '../../shared/repository';
import type {
  FormAssetRecord,
  FormListFilter,
  FormRecord,
  FormTemplateRecord,
  FormUpdate,
  NewFormRecord,
  NewResponseRecord,
  ResponseRecord,
} from './forms.types';

/**
 * Data access port for the Forms module.
 *
 * Three things are stored: form documents, the responses to them, and the
 * templates a new form can start from. The vocabulary is the domain's rather
 * than a store's, so the port outlives whichever database is chosen —
 * `docs/architecture/forms-data-model.md` has the schema it has to satisfy.
 */
export interface FormsRepository {
  list(filter: FormListFilter): Promise<{ items: FormRecord[]; total: number }>;
  findById(id: string): Promise<FormRecord | null>;
  create(form: NewFormRecord): Promise<FormRecord>;
  update(id: string, patch: FormUpdate): Promise<FormRecord | null>;
  remove(id: string): Promise<void>;
  /** Every form, for the four summary cards. Cheap while the set is small. */
  all(): Promise<FormRecord[]>;

  /**
   * How many responses each of these forms has.
   *
   * One call rather than one per row: a dashboard of twenty forms should cost
   * one `GROUP BY`, not twenty counts.
   */
  countResponses(formIds: string[]): Promise<Record<string, number>>;
  listResponses(
    formId: string,
    page: number,
    pageSize: number
  ): Promise<{ items: ResponseRecord[]; total: number }>;
  /** Every response to one form — what statistics and an export are built from. */
  allResponses(formId: string): Promise<ResponseRecord[]>;
  findResponseById(id: string): Promise<ResponseRecord | null>;
  /** Enforces «یک پاسخ برای هر کاربر». Null for an anonymous form. */
  findResponseByRespondent(
    formId: string,
    respondentId: string
  ): Promise<ResponseRecord | null>;
  createResponse(response: NewResponseRecord): Promise<ResponseRecord>;
  updateResponse(
    id: string,
    patch: Partial<ResponseRecord>
  ): Promise<ResponseRecord | null>;

  listTemplates(): Promise<FormTemplateRecord[]>;
  findTemplateById(id: string): Promise<FormTemplateRecord | null>;

  /**
   * Images uploaded for a question's background.
   *
   * A port method rather than an `integrations/` adapter because this is
   * storage, not an outbound call: when an object store is chosen, it is
   * exactly these two methods that point at it instead of at a Map.
   */
  saveAsset(asset: Omit<FormAssetRecord, 'id' | 'createdAt'>): Promise<FormAssetRecord>;
  findAsset(id: string): Promise<FormAssetRecord | null>;
}

const slot = createRepositorySlot<FormsRepository>('forms');

/** The bound implementation. Throws 501 until a data layer registers one. */
export const formsRepository = slot.get;

/** Binds the data layer's implementation. Called once, at boot. */
export const setFormsRepository = slot.set;

// ─── Defaults every new form starts from ─────────────────────────────────────

export function defaultFormSettings(): FormSettings {
  return {
    welcome: {
      enabled: false,
      title: 'به این فرم خوش آمدید',
      description: 'برای شروع، دکمهٔ زیر را بزنید.',
      buttonLabel: 'شروع',
    },
    thankYou: {
      title: 'پاسخ شما با موفقیت ثبت شد.',
      description: 'از وقتی که گذاشتید سپاسگزاریم.',
    },
    availability: { alwaysAvailable: true },
    responses: { anonymous: false, onePerUser: true, allowEditAfterSubmit: false },
    notifications: { notifyAdminOnResponse: true, sendConfirmationToRespondent: false },
    showProgress: true,
  };
}

// ─── The development stand-in ────────────────────────────────────────────────

/**
 * Forms, responses and templates in three Maps.
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ No database has been chosen for this project, so everything below lives │
 * │ in memory. Forms and the answers people gave them are lost on every     │
 * │ restart, and nothing is shared between processes.                       │
 * │                                                                         │
 * │ `app.ts` binds this only outside production; there the slot stays empty │
 * │ and every forms route answers 501 rather than pretending to store an    │
 * │ answer somebody took the trouble to write. The schema to implement is   │
 * │ in docs/architecture/forms-data-model.md.                               │
 * └─────────────────────────────────────────────────────────────────────────┘
 */
export function createInMemoryFormsRepository(): FormsRepository {
  const forms = new Map<string, FormRecord>();
  const responses = new Map<string, ResponseRecord>();
  const templates = new Map<string, FormTemplateRecord>();
  const assets = new Map<string, FormAssetRecord>();

  for (const template of sampleTemplates()) templates.set(template.id, template);
  for (const form of sampleForms()) forms.set(form.id, form);
  for (const response of sampleResponses()) responses.set(response.id, response);

  const responsesFor = (formId: string) =>
    [...responses.values()].filter((response) => response.formId === formId);

  return {
    async list({ search, status, sort, page, pageSize }) {
      const counts = new Map<string, number>();
      for (const response of responses.values()) {
        counts.set(response.formId, (counts.get(response.formId) ?? 0) + 1);
      }

      const needle = search?.toLowerCase();
      const matching = [...forms.values()]
        .filter((form) => (status ? form.status === status : true))
        .filter((form) =>
          needle
            ? `${form.title}\n${form.description ?? ''}\n${form.ownerName}`
                .toLowerCase()
                .includes(needle)
            : true
        )
        .sort((a, b) => {
          if (sort === 'TITLE') return a.title.localeCompare(b.title, 'fa');
          if (sort === 'RESPONSES') {
            return (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0);
          }
          return b.updatedAt.getTime() - a.updatedAt.getTime();
        });

      const start = (page - 1) * pageSize;
      return {
        items: matching.slice(start, start + pageSize).map(clone),
        total: matching.length,
      };
    },

    async all() {
      return [...forms.values()].map(clone);
    },

    async findById(id) {
      const form = forms.get(id);
      return form ? clone(form) : null;
    },

    async create(input) {
      const now = new Date();
      const form: FormRecord = { ...input, id: randomUUID(), createdAt: now, updatedAt: now };
      forms.set(form.id, form);
      return clone(form);
    },

    async update(id, patch) {
      const form = forms.get(id);
      if (!form) return null;

      const updated: FormRecord = { ...form, ...patch, updatedAt: new Date() };
      forms.set(id, updated);
      return clone(updated);
    },

    async remove(id) {
      forms.delete(id);
      for (const [responseId, response] of responses) {
        // A response without its form is unreadable, so it goes with it. A
        // real data layer gets this from ON DELETE CASCADE.
        if (response.formId === id) responses.delete(responseId);
      }
    },

    async countResponses(formIds) {
      const counts: Record<string, number> = Object.fromEntries(
        formIds.map((id) => [id, 0])
      );
      for (const response of responses.values()) {
        if (response.formId in counts) counts[response.formId] += 1;
      }
      return counts;
    },

    async listResponses(formId, page, pageSize) {
      const matching = responsesFor(formId).sort(
        (a, b) => (b.submittedAt ?? b.startedAt).getTime() - (a.submittedAt ?? a.startedAt).getTime()
      );
      const start = (page - 1) * pageSize;
      return {
        items: matching.slice(start, start + pageSize).map(clone),
        total: matching.length,
      };
    },

    async allResponses(formId) {
      return responsesFor(formId).map(clone);
    },

    async findResponseById(id) {
      const response = responses.get(id);
      return response ? clone(response) : null;
    },

    async findResponseByRespondent(formId, respondentId) {
      for (const response of responses.values()) {
        if (response.formId === formId && response.respondentId === respondentId) {
          return clone(response);
        }
      }
      return null;
    },

    async createResponse(input) {
      const response: ResponseRecord = { ...input, id: randomUUID() };
      responses.set(response.id, response);
      return clone(response);
    },

    async updateResponse(id, patch) {
      const response = responses.get(id);
      if (!response) return null;

      const updated = { ...response, ...patch };
      responses.set(id, updated);
      return clone(updated);
    },

    async saveAsset(input) {
      const asset: FormAssetRecord = { ...input, id: randomUUID(), createdAt: new Date() };
      assets.set(asset.id, asset);
      return asset;
    },

    async findAsset(id) {
      return assets.get(id) ?? null;
    },

    async listTemplates() {
      return [...templates.values()].map(clone);
    },

    async findTemplateById(id) {
      const template = templates.get(id);
      return template ? clone(template) : null;
    },
  };
}

/**
 * A deep copy, so a caller cannot reach back into the store through a nested
 * array. A shallow spread is not enough here: a form owns its questions.
 */
function clone<T>(value: T): T {
  return structuredClone(value);
}

// ─── Sample data ─────────────────────────────────────────────────────────────
//
// Realistic Persian content, because a forms dashboard with three rows of
// "Form 1" tells you nothing about whether the screen works. It is seeded, not
// random: the same forms, the same answers and the same charts on every start,
// so a screenshot means something and a test can assert on it.

const SEED_ADMIN = { id: 'seed-admin', username: 'Admin', name: 'مدیر سیستم' };

/** Builds a question with the defaults filled in, so the data below stays readable. */
function q(
  pageId: string,
  order: number,
  type: QuestionType,
  title: string,
  extra: Partial<FormQuestion> = {}
): FormQuestion {
  return { id: `q-${pageId}-${order}`, pageId, type, title, required: false, order, ...extra };
}

function options(pageId: string, order: number, labels: string[]) {
  return labels.map((label, index) => ({ id: `o-${pageId}-${order}-${index}`, label }));
}

function daysAgo(days: number, hour = 10): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hour, 0, 0, 0);
  return date;
}

function sampleTemplates(): FormTemplateRecord[] {
  const page = (id: string, title: string) => [{ id, title, description: undefined, order: 0 }];

  return [
    {
      id: 'tpl-employee-feedback',
      title: 'بازخورد کارکنان',
      description: 'نظر کارکنان دربارهٔ محیط کار، مدیریت و مسیر رشد.',
      category: 'FEEDBACK',
      pages: page('p1', 'بازخورد شما'),
      questions: [
        q('p1', 0, 'RATING_STARS', 'به‌طور کلی چقدر از کار در این مجموعه رضایت دارید؟', {
          required: true,
          validation: { scaleMax: 5 },
        }),
        q('p1', 1, 'SINGLE_CHOICE', 'ارتباط شما با مدیر مستقیم‌تان چگونه است؟', {
          required: true,
          options: options('p1', 1, ['خیلی خوب', 'خوب', 'متوسط', 'ضعیف']),
        }),
        q('p1', 2, 'MULTIPLE_CHOICE', 'کدام موارد برای شما اهمیت بیشتری دارد؟', {
          options: options('p1', 2, [
            'حقوق و مزایا',
            'تعادل کار و زندگی',
            'فرصت یادگیری',
            'مسیر ارتقا',
            'فرهنگ تیمی',
          ]),
          settings: { allowOther: true },
        }),
        q('p1', 3, 'LONG_TEXT', 'چه چیزی را بیش از همه تغییر می‌دادید؟', {
          placeholder: 'پاسخ خود را بنویسید…',
          validation: { maxLength: 1000 },
        }),
      ],
    },
    {
      id: 'tpl-customer-satisfaction',
      title: 'رضایت مشتری',
      description: 'سنجش رضایت و شاخص NPS پس از دریافت خدمات.',
      category: 'SURVEY',
      pages: page('p1', 'تجربهٔ شما'),
      questions: [
        q('p1', 0, 'NPS', 'چقدر احتمال دارد ما را به دیگران معرفی کنید؟', {
          required: true,
          validation: { minLabel: 'اصلاً', maxLabel: 'حتماً' },
        }),
        q('p1', 1, 'RATING_STARS', 'کیفیت خدمات دریافتی را چطور ارزیابی می‌کنید؟', {
          required: true,
          validation: { scaleMax: 5 },
        }),
        q('p1', 2, 'SINGLE_CHOICE', 'پاسخ‌گویی ما به‌موقع بود؟', {
          options: options('p1', 2, ['بله، کاملاً', 'تا حدی', 'خیر']),
        }),
        q('p1', 3, 'LONG_TEXT', 'اگر پیشنهادی دارید بنویسید.', {
          placeholder: 'اختیاری',
        }),
      ],
    },
    {
      id: 'tpl-inspection-checklist',
      title: 'چک‌لیست بازرسی',
      description: 'بازرسی دوره‌ای تجهیزات و ثبت وضعیت هر مورد.',
      category: 'CHECKLIST',
      pages: page('p1', 'موارد بازرسی'),
      questions: [
        q('p1', 0, 'SHORT_TEXT', 'کد تجهیز', { required: true }),
        q('p1', 1, 'DATE', 'تاریخ بازرسی', { required: true }),
        q('p1', 2, 'YES_NO', 'ظاهر دستگاه سالم است؟', { required: true }),
        q('p1', 3, 'YES_NO', 'اتصالات ایمنی بررسی شد؟', { required: true }),
        q('p1', 4, 'FILE_UPLOAD', 'تصویر وضعیت تجهیز', {
          validation: { allowedFileTypes: ['jpg', 'png', 'pdf'], maxFileSizeMb: 5 },
        }),
        q('p1', 5, 'LONG_TEXT', 'توضیحات بازرس'),
      ],
    },
    {
      id: 'tpl-internal-survey',
      title: 'نظرسنجی داخلی',
      description: 'یک نظرسنجی کوتاه برای تصمیم‌های داخلی تیم.',
      category: 'SURVEY',
      pages: page('p1', 'پرسش‌ها'),
      questions: [
        q('p1', 0, 'SINGLE_CHOICE', 'کدام گزینه را ترجیح می‌دهید؟', {
          required: true,
          options: options('p1', 0, ['گزینهٔ اول', 'گزینهٔ دوم', 'گزینهٔ سوم']),
        }),
        q('p1', 1, 'NUMERIC_SCALE', 'این تغییر چقدر برای شما مهم است؟', {
          validation: { scaleMax: 10, minLabel: 'بی‌اهمیت', maxLabel: 'خیلی مهم' },
        }),
        q('p1', 2, 'LONG_TEXT', 'توضیح بیشتر'),
      ],
    },
    {
      id: 'tpl-request-form',
      title: 'فرم درخواست',
      description: 'ثبت درخواست‌های داخلی با اطلاعات تماس و شرح موضوع.',
      category: 'REQUEST',
      pages: page('p1', 'اطلاعات درخواست'),
      questions: [
        q('p1', 0, 'SHORT_TEXT', 'نام و نام خانوادگی', { required: true }),
        q('p1', 1, 'PHONE', 'شماره تماس', { required: true }),
        q('p1', 2, 'DROPDOWN', 'نوع درخواست', {
          required: true,
          options: options('p1', 2, ['پشتیبانی فنی', 'مالی', 'اداری', 'سایر']),
        }),
        q('p1', 3, 'LONG_TEXT', 'شرح درخواست', { required: true }),
        q('p1', 4, 'DATE', 'تاریخ موردنظر'),
      ],
    },
    {
      id: 'tpl-assessment',
      title: 'آزمون و ارزیابی',
      description: 'ارزیابی دانش یا مهارت با پرسش‌های چندگزینه‌ای.',
      category: 'ASSESSMENT',
      pages: page('p1', 'پرسش‌ها'),
      questions: [
        q('p1', 0, 'SHORT_TEXT', 'نام شرکت‌کننده', { required: true }),
        q('p1', 1, 'SINGLE_CHOICE', 'پرسش اول', {
          required: true,
          options: options('p1', 1, ['الف', 'ب', 'ج', 'د']),
        }),
        q('p1', 2, 'SINGLE_CHOICE', 'پرسش دوم', {
          required: true,
          options: options('p1', 2, ['الف', 'ب', 'ج', 'د']),
        }),
        q('p1', 3, 'NUMERIC_SCALE', 'اعتماد شما به پاسخ‌هایتان', {
          validation: { scaleMax: 5 },
        }),
      ],
    },
  ];
}

/** The satisfaction survey below is the one with answers, charts and an export. */
const SUPPORT_SURVEY_ID = 'form-support-satisfaction';

function sampleForms(): FormRecord[] {
  const settings = defaultFormSettings();

  const supportSurvey: FormRecord = {
    id: SUPPORT_SURVEY_ID,
    title: 'نظرسنجی رضایت از خدمات پشتیبانی',
    description: 'بازخورد شما دربارهٔ آخرین تماستان با تیم پشتیبانی.',
    status: 'PUBLISHED',
    category: 'FEEDBACK',
    ownerId: SEED_ADMIN.id,
    ownerUsername: SEED_ADMIN.username,
    ownerName: SEED_ADMIN.name,
    pages: [
      { id: 'sp1', title: 'رضایت کلی', order: 0 },
      { id: 'sp2', title: 'جزئیات تماس', order: 1 },
    ],
    questions: [
      q('sp1', 0, 'RATING_STARS', 'از خدمات پشتیبانی چقدر رضایت دارید؟', {
        required: true,
        validation: { scaleMax: 5 },
      }),
      q('sp1', 1, 'NPS', 'چقدر احتمال دارد ما را به دوستانتان معرفی کنید؟', {
        required: true,
        validation: { minLabel: 'اصلاً', maxLabel: 'حتماً' },
      }),
      q('sp2', 2, 'SINGLE_CHOICE', 'مشکل شما در همان تماس اول حل شد؟', {
        required: true,
        options: options('sp2', 2, ['بله', 'خیر', 'تا حدی']),
      }),
      q('sp2', 3, 'MULTIPLE_CHOICE', 'از کدام راه‌های ارتباطی استفاده کرده‌اید؟', {
        options: options('sp2', 3, ['تماس تلفنی', 'گفت‌وگوی آنلاین', 'ایمیل', 'شبکه‌های اجتماعی']),
      }),
      q('sp2', 4, 'LONG_TEXT', 'اگر نکته‌ای هست بنویسید.', { placeholder: 'اختیاری' }),
    ],
    conditionalLogic: [
      {
        id: 'rule-1',
        whenQuestionId: 'q-sp2-2',
        operator: 'EQUALS',
        value: 'خیر',
        action: 'SHOW',
        targetQuestionId: 'q-sp2-4',
      },
    ],
    audience: { mode: 'EVERYONE' },
    settings: {
      ...settings,
      welcome: {
        enabled: true,
        title: 'نظر شما برای ما مهم است',
        description: 'پاسخ به این پرسش‌ها کمتر از دو دقیقه طول می‌کشد.',
        buttonLabel: 'شروع نظرسنجی',
      },
      responses: { anonymous: true, onePerUser: false, allowEditAfterSubmit: false },
    },
    createdAt: daysAgo(21),
    updatedAt: daysAgo(3, 14),
    publishedAt: daysAgo(14),
  };

  const leaveRequest: FormRecord = {
    id: 'form-leave-request',
    title: 'فرم درخواست مرخصی',
    description: 'ثبت درخواست مرخصی استحقاقی و استعلاجی.',
    status: 'DRAFT',
    category: 'REQUEST',
    ownerId: SEED_ADMIN.id,
    ownerUsername: SEED_ADMIN.username,
    ownerName: SEED_ADMIN.name,
    pages: [{ id: 'lp1', title: 'اطلاعات درخواست', order: 0 }],
    questions: [
      q('lp1', 0, 'SHORT_TEXT', 'نام و نام خانوادگی', { required: true }),
      q('lp1', 1, 'DROPDOWN', 'نوع مرخصی', {
        required: true,
        options: options('lp1', 1, ['استحقاقی', 'استعلاجی', 'بدون حقوق']),
      }),
      q('lp1', 2, 'DATE', 'از تاریخ', { required: true }),
      q('lp1', 3, 'DATE', 'تا تاریخ', { required: true }),
      q('lp1', 4, 'LONG_TEXT', 'توضیحات'),
    ],
    conditionalLogic: [],
    audience: { mode: 'EVERYONE' },
    settings,
    createdAt: daysAgo(6),
    updatedAt: daysAgo(1, 9),
    publishedAt: null,
  };

  const inspection: FormRecord = {
    id: 'form-monthly-inspection',
    title: 'چک‌لیست بازرسی ماهانهٔ تجهیزات',
    description: 'بازرسی دوره‌ای تجهیزات انبار و ثبت وضعیت هر مورد.',
    status: 'PUBLISHED',
    category: 'CHECKLIST',
    ownerId: SEED_ADMIN.id,
    ownerUsername: SEED_ADMIN.username,
    ownerName: SEED_ADMIN.name,
    pages: [{ id: 'ip1', title: 'موارد بازرسی', order: 0 }],
    questions: [
      q('ip1', 0, 'SHORT_TEXT', 'کد تجهیز', { required: true }),
      q('ip1', 1, 'YES_NO', 'ظاهر دستگاه سالم است؟', { required: true }),
      q('ip1', 2, 'YES_NO', 'اتصالات ایمنی بررسی شد؟', { required: true }),
      q('ip1', 3, 'LONG_TEXT', 'توضیحات بازرس'),
    ],
    conditionalLogic: [],
    audience: { mode: 'ROLES', roles: ['ADMIN'] },
    settings: {
      ...settings,
      responses: { anonymous: false, onePerUser: false, allowEditAfterSubmit: true },
    },
    createdAt: daysAgo(40),
    updatedAt: daysAgo(9, 11),
    publishedAt: daysAgo(35),
  };

  const cultureSurvey: FormRecord = {
    id: 'form-culture-survey',
    title: 'نظرسنجی فرهنگ سازمانی ۱۴۰۴',
    description: 'نظرسنجی سالانهٔ کارکنان دربارهٔ فرهنگ و محیط کار.',
    status: 'CLOSED',
    category: 'SURVEY',
    ownerId: SEED_ADMIN.id,
    ownerUsername: SEED_ADMIN.username,
    ownerName: SEED_ADMIN.name,
    pages: [{ id: 'cp1', title: 'پرسش‌ها', order: 0 }],
    questions: [
      q('cp1', 0, 'NUMERIC_SCALE', 'چقدر احساس تعلق به سازمان دارید؟', {
        required: true,
        validation: { scaleMax: 10, minLabel: 'اصلاً', maxLabel: 'خیلی زیاد' },
      }),
      q('cp1', 1, 'LONG_TEXT', 'یک چیز که باید تغییر کند'),
    ],
    conditionalLogic: [],
    audience: { mode: 'EVERYONE' },
    settings: {
      ...settings,
      availability: { alwaysAvailable: false, publishAt: iso(daysAgo(120)), closeAt: iso(daysAgo(60)) },
      responses: { anonymous: true, onePerUser: true, allowEditAfterSubmit: false },
    },
    createdAt: daysAgo(130),
    updatedAt: daysAgo(58, 16),
    publishedAt: daysAgo(120),
  };

  return [supportSurvey, leaveRequest, inspection, cultureSurvey];
}

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Answers to the support survey, generated from a fixed seed.
 *
 * A deterministic pseudo-random sequence rather than `Math.random`: the charts
 * have to look the same on every boot, or a screenshot and a test disagree
 * about what the screen shows.
 */
function sampleResponses(): ResponseRecord[] {
  let seed = 20260925;
  const next = () => {
    // A linear congruential generator — the textbook one. Nothing here is
    // security-sensitive; it only has to be repeatable.
    seed = (seed * 1103515245 + 12345) % 2 ** 31;
    return seed / 2 ** 31;
  };
  const pick = <T>(values: T[]): T => values[Math.floor(next() * values.length)];

  const comments = [
    'پاسخ‌گویی سریع بود، ممنون.',
    'منتظر ماندن پشت خط طولانی شد.',
    'کارشناس مسلط بود و مشکل حل شد.',
    'کاش پیگیری بعدی هم انجام می‌شد.',
    'در کل راضی بودم.',
  ];

  const responses: ResponseRecord[] = [];

  for (let index = 0; index < 48; index += 1) {
    const day = Math.floor(next() * 14);
    const startedAt = daysAgo(day, 9 + Math.floor(next() * 9));
    // Roughly one in seven people leaves partway through, which is what makes
    // the completion-rate card show something other than 100%.
    const complete = next() > 0.14;
    const completionSeconds = 45 + Math.floor(next() * 200);
    const rating = pick([3, 4, 4, 5, 5, 5, 2]);
    const nps = pick([10, 9, 9, 8, 7, 6, 10, 9, 4, 3]);
    const firstContact = pick(['بله', 'بله', 'بله', 'تا حدی', 'خیر']);

    const answers: FormAnswer[] = [
      { questionId: 'q-sp1-0', value: rating },
      { questionId: 'q-sp1-1', value: nps },
    ];

    if (complete) {
      answers.push(
        { questionId: 'q-sp2-2', value: firstContact },
        {
          questionId: 'q-sp2-3',
          value: pick([
            ['تماس تلفنی'],
            ['گفت‌وگوی آنلاین'],
            ['تماس تلفنی', 'ایمیل'],
            ['گفت‌وگوی آنلاین', 'شبکه‌های اجتماعی'],
          ]),
        }
      );

      // Only the people whose problem was not solved first time are asked for
      // a comment — that is what the survey's one logic rule does.
      if (firstContact !== 'بله') {
        answers.push({ questionId: 'q-sp2-4', value: pick(comments) });
      }
    }

    responses.push({
      id: `seed-response-${index}`,
      formId: SUPPORT_SURVEY_ID,
      // The survey collects answers anonymously, so nothing identifies anybody.
      respondentId: null,
      respondentName: null,
      status: complete ? 'COMPLETE' : 'PARTIAL',
      answers,
      startedAt,
      submittedAt: complete ? new Date(startedAt.getTime() + completionSeconds * 1000) : null,
      completionSeconds: complete ? completionSeconds : null,
    });
  }

  return responses;
}
