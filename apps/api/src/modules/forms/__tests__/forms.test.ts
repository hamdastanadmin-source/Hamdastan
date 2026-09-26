import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { API_PREFIX } from '@hamdastan/config';

import { buildApp } from '../../../app';
import {
  ADMIN_API,
  DEV_ADMIN,
  installAdminStore,
  login,
  newAdminPayload,
  sentTemporaryPassword,
  sessionCookie,
  STRONG_PASSWORD,
} from '../../admin-auth/__tests__/fixtures';
import { createInMemoryFormsRepository, setFormsRepository } from '../../forms';

/**
 * «فرم‌ها و نظرسنجی‌ها», over HTTP.
 *
 * The flows that matter are the ones where a decision is made: publishing a
 * form that has nothing to ask, answering one that is closed or not meant for
 * you, answering twice, leaving a required question blank, and the statistics
 * the answers add up to.
 *
 * The repository is rebound per test so every suite starts from the same seeded
 * forms — the same four forms and forty-eight responses the panel shows.
 */

const FORMS_API = `${ADMIN_API}/forms`;
const PUBLIC_API = `${API_PREFIX}/forms`;
const SEEDED_SURVEY = 'form-support-satisfaction';

let app: FastifyInstance;
/** A signed-in super admin, past the forced password change. */
let admin: string;

beforeEach(async () => {
  app = await buildApp();
  await app.ready();
  await installAdminStore();
  setFormsRepository(createInMemoryFormsRepository());

  const first = await login(app, DEV_ADMIN.username, DEV_ADMIN.password);
  const changed = await app.inject({
    method: 'POST',
    url: `${ADMIN_API}/auth/change-password`,
    headers: { cookie: first.cookie },
    payload: { newPassword: STRONG_PASSWORD, confirmPassword: STRONG_PASSWORD },
  });
  admin = sessionCookie(changed);
});

afterEach(async () => {
  await app.close();
});

function get(url: string, cookie = admin) {
  return app.inject({ method: 'GET', url, headers: { cookie } });
}

/**
 * `InjectPayload` is what `inject` accepts as a body; taking `unknown` here and
 * spreading it conditionally widens the argument past the overload, and the
 * error lands on every call site rather than on this line.
 */
function post(url: string, payload?: Record<string, unknown>, cookie = admin) {
  return app.inject({ method: 'POST', url, headers: { cookie }, payload });
}

/** Creates a blank form and returns the document. */
async function createForm(title = 'فرم آزمایشی') {
  const response = await post(FORMS_API, { title });
  expect(response.statusCode).toBe(201);
  return response.json().data.form;
}

/** Gives a form one required question on its first page. */
async function addQuestion(
  form: { id: string; pages: { id: string }[] },
  overrides: Record<string, unknown> = {}
) {
  const question = {
    id: 'q1',
    pageId: form.pages[0].id,
    type: 'SHORT_TEXT',
    title: 'نام شما چیست؟',
    required: true,
    order: 0,
    ...overrides,
  };

  const response = await app.inject({
    method: 'PATCH',
    url: `${FORMS_API}/${form.id}`,
    headers: { cookie: admin },
    payload: { questions: [question] },
  });

  expect(response.statusCode).toBe(200);
  return question;
}

describe('the forms dashboard', () => {
  it('counts what the four cards show', async () => {
    const response = await get(`${FORMS_API}/overview`);

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toEqual({
      totalForms: 4,
      publishedForms: 2,
      draftForms: 1,
      totalResponses: 48,
    });
  });

  it('lists forms with their question and response counts', async () => {
    const { items } = (await get(FORMS_API)).json().data;
    const survey = items.find((form: { id: string }) => form.id === SEEDED_SURVEY);

    expect(survey.questionCount).toBe(5);
    expect(survey.responseCount).toBe(48);
    expect(survey.ownerUsername).toBe('Admin');
  });

  it('filters by status and searches by title', async () => {
    expect((await get(`${FORMS_API}?status=DRAFT`)).json().data.total).toBe(1);
    expect((await get(`${FORMS_API}?search=مرخصی`)).json().data.total).toBe(1);
    expect((await get(`${FORMS_API}?search=هیچ‌چیز`)).json().data.total).toBe(0);
  });

  it('offers the templates a new form can start from', async () => {
    const { templates } = (await get(`${FORMS_API}/templates`)).json().data;

    expect(templates.length).toBeGreaterThanOrEqual(6);
    expect(templates[0].questionCount).toBeGreaterThan(0);
  });
});

describe('creating a form', () => {
  it('starts blank, as a draft with one page', async () => {
    const form = await createForm();

    expect(form.status).toBe('DRAFT');
    expect(form.pages).toHaveLength(1);
    expect(form.questions).toHaveLength(0);
  });

  it('copies a template, giving every question a new id', async () => {
    const { templates } = (await get(`${FORMS_API}/templates`)).json().data;
    const template = templates.find(
      (candidate: { id: string }) => candidate.id === 'tpl-customer-satisfaction'
    );

    const first = (await post(FORMS_API, { title: 'اول', templateId: template.id })).json()
      .data.form;
    const second = (await post(FORMS_API, { title: 'دوم', templateId: template.id })).json()
      .data.form;

    expect(first.questions).toHaveLength(template.questionCount);

    // Two forms from one template must not share ids, or their answers could
    // not be told apart.
    const firstIds = first.questions.map((question: { id: string }) => question.id);
    const secondIds = second.questions.map((question: { id: string }) => question.id);
    expect(firstIds.some((id: string) => secondIds.includes(id))).toBe(false);
  });

  it('refuses a form with no title', async () => {
    expect((await post(FORMS_API, { title: '' })).statusCode).toBe(400);
  });
});

describe('publishing', () => {
  it('refuses a form that asks nothing', async () => {
    const form = await createForm();

    const response = await post(`${FORMS_API}/${form.id}/publish`);

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('FORM_HAS_NO_QUESTIONS');
  });

  it('publishes a form with a question, and stamps when', async () => {
    const form = await createForm();
    await addQuestion(form);

    const published = (await post(`${FORMS_API}/${form.id}/publish`)).json().data.form;

    expect(published.status).toBe('PUBLISHED');
    expect(published.publishedAt).not.toBeNull();
  });

  it('keeps the answers when it is unpublished', async () => {
    const form = await createForm();
    const question = await addQuestion(form);
    await post(`${FORMS_API}/${form.id}/publish`);

    await app.inject({
      method: 'POST',
      url: `${PUBLIC_API}/${form.id}/responses`,
      payload: { complete: true, answers: [{ questionId: question.id, value: 'سارا' }] },
    });

    await post(`${FORMS_API}/${form.id}/unpublish`);

    const { total } = (await get(`${FORMS_API}/${form.id}/responses`)).json().data;
    expect(total).toBe(1);
  });

  it('duplicates a form as a draft, without its answers', async () => {
    const copy = (await post(`${FORMS_API}/${SEEDED_SURVEY}/duplicate`)).json().data.form;

    expect(copy.status).toBe('DRAFT');
    expect(copy.title).toContain('رونوشت');
    expect(copy.responseCount).toBe(0);
    expect(copy.questions).toHaveLength(5);
  });
});

describe('answering a form', () => {
  it('serves a published form to somebody signed out', async () => {
    const response = await app.inject({ method: 'GET', url: `${PUBLIC_API}/${SEEDED_SURVEY}` });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.form.questions).toHaveLength(5);
  });

  it('refuses a form that was never published', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `${PUBLIC_API}/form-leave-request`,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('FORM_NOT_PUBLISHED');
  });

  it('refuses a form whose window has closed', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `${PUBLIC_API}/form-culture-survey`,
    });

    expect(response.json().error.code).toBe('FORM_CLOSED');
  });

  it('refuses a form limited to an audience this visitor is not in', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `${PUBLIC_API}/form-monthly-inspection`,
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('FORM_AUDIENCE_DENIED');
  });

  it('records an answer and counts it', async () => {
    const form = await createForm();
    const question = await addQuestion(form);
    await post(`${FORMS_API}/${form.id}/publish`);

    const response = await app.inject({
      method: 'POST',
      url: `${PUBLIC_API}/${form.id}/responses`,
      payload: {
        complete: true,
        elapsedSeconds: 30,
        answers: [{ questionId: question.id, value: 'سارا' }],
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().data.response.status).toBe('COMPLETE');

    const stats = (await get(`${FORMS_API}/${form.id}/responses/stats`)).json().data;
    expect(stats.totalResponses).toBe(1);
    expect(stats.completionRate).toBe(100);
  });

  it('refuses a submission that leaves a required question blank', async () => {
    const form = await createForm();
    await addQuestion(form);
    await post(`${FORMS_API}/${form.id}/publish`);

    const response = await app.inject({
      method: 'POST',
      url: `${PUBLIC_API}/${form.id}/responses`,
      payload: { complete: true, answers: [] },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('FORM_ANSWER_INVALID');
  });

  it('accepts a partial submission with the same question unanswered', async () => {
    const form = await createForm();
    await addQuestion(form);
    await post(`${FORMS_API}/${form.id}/publish`);

    const response = await app.inject({
      method: 'POST',
      url: `${PUBLIC_API}/${form.id}/responses`,
      payload: { complete: false, answers: [] },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.response.status).toBe('PARTIAL');
  });

  it('excuses a required question that logic has hidden', async () => {
    const form = await createForm();
    const shown = await addQuestion(form, { id: 'q-visible', required: false });

    // A second question that only appears when the first says «بله».
    await app.inject({
      method: 'PATCH',
      url: `${FORMS_API}/${form.id}`,
      headers: { cookie: admin },
      payload: {
        questions: [
          shown,
          {
            id: 'q-hidden',
            pageId: form.pages[0].id,
            type: 'SHORT_TEXT',
            title: 'چرا؟',
            required: true,
            order: 1,
          },
        ],
        conditionalLogic: [
          {
            id: 'rule-1',
            whenQuestionId: 'q-visible',
            operator: 'EQUALS',
            value: 'بله',
            action: 'SHOW',
            targetQuestionId: 'q-hidden',
          },
        ],
      },
    });
    await post(`${FORMS_API}/${form.id}/publish`);

    // Nothing triggers the rule, so the required question is not being asked.
    const allowed = await app.inject({
      method: 'POST',
      url: `${PUBLIC_API}/${form.id}/responses`,
      payload: { complete: true, answers: [{ questionId: 'q-visible', value: 'خیر' }] },
    });
    expect(allowed.statusCode).toBe(201);

    // Trigger it, and the same submission is refused.
    const refused = await app.inject({
      method: 'POST',
      url: `${PUBLIC_API}/${form.id}/responses`,
      payload: { complete: true, answers: [{ questionId: 'q-visible', value: 'بله' }] },
    });
    expect(refused.statusCode).toBe(400);
  });

  it('validates an answer against the question that asked for it', async () => {
    const form = await createForm();
    await addQuestion(form, { type: 'EMAIL', title: 'ایمیل', required: false });
    await post(`${FORMS_API}/${form.id}/publish`);

    const response = await app.inject({
      method: 'POST',
      url: `${PUBLIC_API}/${form.id}/responses`,
      payload: { complete: true, answers: [{ questionId: 'q1', value: 'not-an-email' }] },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('FORM_ANSWER_INVALID');
  });

  it('refuses an option the question never offered', async () => {
    const form = await createForm();
    await addQuestion(form, {
      type: 'SINGLE_CHOICE',
      required: false,
      options: [
        { id: 'o1', label: 'بله' },
        { id: 'o2', label: 'خیر' },
      ],
    });
    await post(`${FORMS_API}/${form.id}/publish`);

    const response = await app.inject({
      method: 'POST',
      url: `${PUBLIC_API}/${form.id}/responses`,
      payload: { complete: true, answers: [{ questionId: 'q1', value: 'شاید' }] },
    });

    expect(response.statusCode).toBe(400);
  });
});

describe('statistics and export', () => {
  it('reduces the seeded answers to what each chart needs', async () => {
    const stats = (await get(`${FORMS_API}/${SEEDED_SURVEY}/responses/stats`)).json().data;

    expect(stats.totalResponses).toBe(48);
    expect(stats.completedResponses + stats.incompleteResponses).toBe(48);
    expect(stats.trend).toHaveLength(14);

    const rating = stats.questions.find(
      (question: { type: string }) => question.type === 'RATING_STARS'
    );
    expect(rating.average).toBeGreaterThan(0);
    expect(rating.breakdown.length).toBeGreaterThan(1);

    const nps = stats.questions.find((question: { type: string }) => question.type === 'NPS');
    expect(nps.npsScore).toBeGreaterThanOrEqual(-100);
    expect(nps.breakdown).toHaveLength(3);

    const text = stats.questions.find(
      (question: { type: string }) => question.type === 'LONG_TEXT'
    );
    expect(Array.isArray(text.textAnswers)).toBe(true);
  });

  it('stores an uploaded background image and serves it back', async () => {
    const form = await createForm();

    // A one-pixel PNG is enough to prove the round trip.
    const png =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    const uploaded = await post(`${FORMS_API}/${form.id}/assets`, {
      filename: 'bg.png',
      contentType: 'image/png',
      data: png,
    });

    expect(uploaded.statusCode).toBe(201);

    const { url } = uploaded.json().data;
    expect(url).toContain('/forms/assets/');

    // Public, because a respondent has to be able to load it.
    const image = await app.inject({ method: 'GET', url });
    expect(image.statusCode).toBe(200);
    expect(image.headers['content-type']).toBe('image/png');
  });

  it('refuses an upload that is not an image', async () => {
    const form = await createForm();

    const response = await post(`${FORMS_API}/${form.id}/assets`, {
      filename: 'notes.txt',
      contentType: 'text/plain',
      data: 'aGVsbG8=',
    });

    expect(response.statusCode).toBe(400);
  });

  it('exports one row per response, with a column per question', async () => {
    const response = await get(`${FORMS_API}/${SEEDED_SURVEY}/responses/export?format=CSV`);

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/csv');

    // The byte order mark is what makes Excel read Persian correctly. It is
    // checked before trimming, which would strip it as whitespace.
    expect(response.body.codePointAt(0)).toBe(0xfeff);

    const lines = response.body.slice(1).trim().split('\r\n');
    expect(lines).toHaveLength(49);
    expect(lines[0]).toContain('از خدمات پشتیبانی چقدر رضایت دارید؟');
  });
});

describe('permissions', () => {
  /** Signs in an admin whose role carries only `dashboard.view`. */
  async function supportCookie(): Promise<string> {
    await app.inject({
      method: 'POST',
      url: `${ADMIN_API}/users`,
      headers: { cookie: admin },
      payload: newAdminPayload({
        username: 'hamid',
        mobile: '09129998877',
        roleCode: 'support',
      }),
    });

    const first = await login(app, 'hamid', sentTemporaryPassword('09129998877'));
    const changed = await app.inject({
      method: 'POST',
      url: `${ADMIN_API}/auth/change-password`,
      headers: { cookie: first.cookie },
      payload: { newPassword: STRONG_PASSWORD, confirmPassword: STRONG_PASSWORD },
    });

    return sessionCookie(changed);
  }

  it('refuses an admin whose role has no forms permission', async () => {
    const cookie = await supportCookie();

    const list = await get(FORMS_API, cookie);
    expect(list.statusCode).toBe(403);
    expect(list.json().error.code).toBe('ADMIN_FORBIDDEN');

    const create = await post(FORMS_API, { title: 'ممنوع' }, cookie);
    expect(create.statusCode).toBe(403);
  });

  it('refuses a request with no admin session at all', async () => {
    const response = await app.inject({ method: 'GET', url: FORMS_API });
    expect(response.statusCode).toBe(401);
  });

  it('lets a form manager build and publish', async () => {
    await app.inject({
      method: 'POST',
      url: `${ADMIN_API}/users`,
      headers: { cookie: admin },
      payload: newAdminPayload({
        username: 'forms',
        mobile: '09121230000',
        roleCode: 'form_manager',
      }),
    });

    const first = await login(app, 'forms', sentTemporaryPassword('09121230000'));
    const changed = await app.inject({
      method: 'POST',
      url: `${ADMIN_API}/auth/change-password`,
      headers: { cookie: first.cookie },
      payload: { newPassword: STRONG_PASSWORD, confirmPassword: STRONG_PASSWORD },
    });
    const cookie = sessionCookie(changed);

    expect((await get(FORMS_API, cookie)).statusCode).toBe(200);
    expect((await post(FORMS_API, { title: 'فرم مدیر فرم‌ها' }, cookie)).statusCode).toBe(201);

    // …but not touch admin accounts.
    expect((await get(`${ADMIN_API}/users`, cookie)).statusCode).toBe(403);
  });
});
