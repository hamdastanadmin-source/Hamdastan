import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { API_PREFIX } from '@hamdastan/config';
import type { AdminInterestCategory, AdminQuestion, QuestionInput } from '@hamdastan/types';

import { buildApp } from '../app';
import { closePool, getPool, runMigrations } from '../data';
import type { SmsSender } from '../integrations';
import { setAdminRepository, sqlAdminRepository } from '../modules/admin';
import { setAuthRepository, setSmsSender, sqlAuthRepository } from '../modules/auth';
import { setOnboardingRepository, sqlOnboardingRepository } from '../modules/onboarding';
import { setProgressRepository, sqlProgressRepository } from '../modules/progress';
import { setUsersRepository, sqlUsersRepository } from '../modules/users';

/**
 * The onboarding catalogs end to end, against a migrated database: 0023
 * seeds exactly what the code held, the panel adds, rewords and removes
 * interests and questions, the product serves what the panel saved, a
 * scored question keeps its shape, and the catalog cannot be cut below
 * what stage 1 asks people to pick from.
 */

const hasDatabase = Boolean(process.env.TEST_DATABASE_URL);
const MAIN_ADMIN_PHONE = '09059466960';

type Cookies = Record<string, string>;
const silentSender: SmsSender = { name: 'test', async sendOtp() {} };

let app: FastifyInstance;
let admin: Cookies;
let phoneCounter = 0;

const nextPhone = () => {
  phoneCounter += 1;
  return `0997${String(Date.now() % 100_000).padStart(5, '0')}${String(phoneCounter).padStart(2, '0')}`;
};

const cookiesFrom = (response: LightMyRequestResponse): Cookies =>
  Object.fromEntries(response.cookies.map(({ name, value }) => [name, value]));

const call = (method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, cookies: Cookies, body?: unknown) =>
  app.inject({ method, url: `${API_PREFIX}${url}`, payload: body as object, cookies });

async function signIn(prefix: '' | '/admin', phone: string): Promise<Cookies> {
  const requested = await call('POST', `${prefix}/auth/otp/request`, {}, { phone });
  const verified = await call('POST', `${prefix}/auth/otp/verify`, {}, { phone, code: requested.json().data.debugCode });
  expect(verified.statusCode, verified.body).toBe(200);
  return cookiesFrom(verified);
}

/** A person through basic info and the username step, at stage 1. */
async function onboardingUser(): Promise<Cookies> {
  const cookies = await signIn('', nextPhone());
  const basic = await call('PUT', '/me/basic-info', cookies, {
    firstName: 'سارا',
    lastName: 'احمدی',
    birthDate: { year: 1375, month: 6, day: 15 },
    gender: 'female',
  });
  expect(basic.statusCode, basic.body).toBe(200);
  expect((await call('PUT', '/me/username', cookies, { username: `u${nextPhone()}` })).statusCode).toBe(200);
  return cookies;
}

const categories = async () => (await call('GET', '/admin/onboarding/interest-categories', admin)).json().data as AdminInterestCategory[];
const questions = async () => (await call('GET', '/admin/onboarding/questions', admin)).json().data as AdminQuestion[];

describe.skipIf(!hasDatabase)('the onboarding catalogs against a migrated database', () => {
  beforeAll(async () => {
    await getPool().query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    await runMigrations();
    setUsersRepository(sqlUsersRepository);
    setAuthRepository(sqlAuthRepository);
    setAdminRepository(sqlAdminRepository);
    setProgressRepository(sqlProgressRepository);
    setOnboardingRepository(sqlOnboardingRepository);
    setSmsSender(silentSender);
    app = await buildApp();
    await app.ready();
    admin = await signIn('/admin', MAIN_ADMIN_PHONE);
  });

  afterAll(async () => {
    await app?.close();
    await closePool();
  });

  it('seeds the catalogs exactly as the code held them', async () => {
    const seeded = await categories();
    expect(seeded.map(({ id }) => id)).toEqual(['music', 'art', 'learning', 'lifestyle', 'social', 'online']);
    expect(seeded[0].interests.slice(0, 2)).toEqual([
      { id: 'concert', label: 'کنسرت' },
      { id: 'theater', label: 'تئاتر' },
    ]);

    const list = await questions();
    expect(list).toHaveLength(20);
    expect(list.every((question) => question.scored)).toBe(true);
    expect(list.slice(0, 5).map(({ id }) => id)).toEqual(['Q2', 'Q4', 'Q5', 'Q19', 'Q3']);
    expect(list.at(-1)).toMatchObject({ id: 'Q17', section: 4, kind: 'slider', maxLabel: 'سر وقت بودن مهمه' });
    expect(list.find(({ id }) => id === 'Q1')).toMatchObject({ kind: 'ranked', maxSelections: 3 });
  });

  it('is closed to the product session', async () => {
    const cookies = await onboardingUser();
    expect((await call('GET', '/admin/onboarding/questions', cookies)).statusCode).toBe(401);
  });

  it('adds, rewords and removes interests — kept ones keep their ids — and stage 1 serves it', async () => {
    const created = await call('POST', '/admin/onboarding/interest-categories', admin, {
      title: 'ورزش‌های آبی',
      interests: [{ label: 'شنا' }, { label: 'غواصی' }],
    });
    expect(created.statusCode, created.body).toBe(201);
    const water = (created.json().data as AdminInterestCategory[]).at(-1)!;
    expect(water.title).toBe('ورزش‌های آبی');
    expect(water.interests.map(({ label }) => label)).toEqual(['شنا', 'غواصی']);

    const [swim, dive] = water.interests;
    const updated = await call('PUT', `/admin/onboarding/interest-categories/${water.id}`, admin, {
      title: 'آب',
      // Reordered, one reworded, one removed, one new — and an id from another category is not adopted.
      interests: [{ label: 'موج‌سواری' }, { id: swim.id, label: 'شنای آزاد' }, { id: 'concert', label: 'دزدیده' }],
    });
    expect(updated.statusCode, updated.body).toBe(200);
    const after = (updated.json().data as AdminInterestCategory[]).find(({ id }) => id === water.id)!;
    expect(after.title).toBe('آب');
    expect(after.interests.map(({ label }) => label)).toEqual(['موج‌سواری', 'شنای آزاد', 'دزدیده']);
    expect(after.interests[1].id).toBe(swim.id);
    expect(after.interests.map(({ id }) => id)).not.toContain(dive.id);
    expect(after.interests[2].id).not.toBe('concert');
    expect((await categories())[0].interests[0]).toEqual({ id: 'concert', label: 'کنسرت' });

    const cookies = await onboardingUser();
    const stage1 = (await call('GET', '/me/onboarding/interests', cookies)).json().data;
    expect(stage1.categories.at(-1)).toEqual({ id: water.id, title: 'آب', interests: after.interests });

    const saved = await call('PUT', '/me/onboarding/interests', cookies, { interestIds: ['concert', 'gallery', swim.id] });
    expect(saved.statusCode, saved.body).toBe(200);
    expect(saved.json().data.selectedCategories).toEqual(['music', 'art', water.id]);
    expect((await call('PUT', '/me/onboarding/interests', cookies, { interestIds: ['concert', 'gallery', dive.id] })).statusCode).toBe(400);

    expect((await categories()).find(({ id }) => id === water.id)!.pickedBy).toBe(1);
  });

  it('orders categories, and never leaves fewer than stage 1 asks for', async () => {
    const ids = (await categories()).map(({ id }) => id);
    const reordered = await call('PUT', '/admin/onboarding/interest-categories/order', admin, { ids: [...ids].reverse() });
    expect((reordered.json().data as AdminInterestCategory[]).map(({ id }) => id)).toEqual([...ids].reverse());

    // Seven categories: four can go, the fifth would leave two.
    for (const id of ids.slice(0, 4)) {
      expect((await call('DELETE', `/admin/onboarding/interest-categories/${id}`, admin)).statusCode).toBe(200);
    }
    const refused = await call('DELETE', `/admin/onboarding/interest-categories/${ids[4]}`, admin);
    expect(refused.statusCode).toBe(400);
    expect(await categories()).toHaveLength(3);
  });

  it('adds a question the product asks and validates, and removes it again', async () => {
    const input: QuestionInput = {
      section: 1,
      kind: 'single',
      title: 'صبح یا شب؟',
      helper: null,
      maxSelections: 2,
      minLabel: 'ignored',
      maxLabel: null,
      options: [{ label: 'صبح' }, { label: 'شب' }],
    };
    const created = await call('POST', '/admin/onboarding/questions', admin, input);
    expect(created.statusCode, created.body).toBe(201);
    const list = created.json().data as AdminQuestion[];
    // Appended to its section — after Q3, before section 2's Q6.
    const index = list.findIndex(({ title }) => title === 'صبح یا شب؟');
    expect(list[index - 1].id).toBe('Q3');
    expect(list[index + 1].id).toBe('Q6');
    const question = list[index];
    expect(question).toMatchObject({ scored: false, kind: 'single', section: 1 });
    expect(question).not.toHaveProperty('maxSelections');
    expect(question).not.toHaveProperty('minLabel');
    if (question.kind === 'slider') throw new Error('expected a choice question');
    const [morning] = question.options;

    const cookies = await onboardingUser();
    await call('PUT', '/me/onboarding/interests', cookies, { interestIds: (await categories()).map((c) => c.interests[0].id) });
    const state = (await call('GET', '/me/onboarding/questionnaire', cookies)).json().data;
    expect(state.questions).toHaveLength(21);
    expect(state.questions[5]).not.toHaveProperty('scored');
    expect(state.questions[5].id).toBe(question.id);

    const wrong = await call('PUT', `/me/onboarding/questionnaire/answers/${question.id}`, cookies, { answer: { option: 'NOPE' } });
    expect(wrong.statusCode).toBe(400);
    const answered = await call('PUT', `/me/onboarding/questionnaire/answers/${question.id}`, cookies, {
      answer: { option: morning.code },
    });
    expect(answered.statusCode, answered.body).toBe(200);
    expect(answered.json().data.progress).toBe(5);

    // Rewording keeps the code an answer stored.
    const reworded = await call('PUT', `/admin/onboarding/questions/${question.id}`, admin, {
      ...input,
      options: [{ code: morning.code, label: 'صبح زود' }, { label: 'نیمه‌شب' }],
    });
    expect(reworded.statusCode, reworded.body).toBe(200);
    const again = (await call('GET', '/me/onboarding/questionnaire', cookies)).json().data;
    expect(again.answers[question.id]).toEqual({ option: morning.code });

    expect((await call('DELETE', `/admin/onboarding/questions/${question.id}`, admin)).statusCode).toBe(200);
    const gone = (await call('GET', '/me/onboarding/questionnaire', cookies)).json().data;
    expect(gone.questions).toHaveLength(20);
    expect(gone.answers).toEqual({});
    expect((await call('PUT', `/me/onboarding/questionnaire/answers/${question.id}`, cookies, { answer: { option: morning.code } })).statusCode).toBe(404);
  });

  it('lets a scored question be reworded and moved, never reshaped or deleted', async () => {
    const q2 = (await questions()).find(({ id }) => id === 'Q2')!;
    if (q2.kind === 'slider') throw new Error('Q2 is a choice question');
    const input: QuestionInput = {
      section: q2.section,
      kind: q2.kind,
      title: 'وقتی وارد یه جمع تازه می‌شی؟',
      helper: null,
      maxSelections: null,
      minLabel: null,
      maxLabel: null,
      options: [...q2.options],
    };
    const reworded = await call('PUT', '/admin/onboarding/questions/Q2', admin, input);
    expect(reworded.statusCode, reworded.body).toBe(200);
    expect((reworded.json().data as AdminQuestion[]).find(({ id }) => id === 'Q2')!.title).toBe('وقتی وارد یه جمع تازه می‌شی؟');

    expect((await call('PUT', '/admin/onboarding/questions/Q2', admin, { ...input, kind: 'multi' })).statusCode).toBe(400);
    expect((await call('PUT', '/admin/onboarding/questions/Q2', admin, { ...input, options: [...q2.options, { label: 'تازه' }] })).statusCode).toBe(400);
    expect((await call('PUT', '/admin/onboarding/questions/Q2', admin, { ...input, options: q2.options.slice(0, 3) })).statusCode).toBe(400);
    expect((await call('DELETE', '/admin/onboarding/questions/Q2', admin)).statusCode).toBe(400);

    const ids = (await questions()).map(({ id }) => id);
    const swapped = [ids[1], ids[0], ...ids.slice(2)];
    const reordered = await call('PUT', '/admin/onboarding/questions/order', admin, { ids: swapped });
    expect((reordered.json().data as AdminQuestion[]).map(({ id }) => id)).toEqual(swapped);
  });

  it('imports interests from a sheet — into a matching category or a new one — in one write', async () => {
    const before = await categories();
    const [first] = before;
    const imported = await call('POST', '/admin/onboarding/interest-categories/import', admin, {
      categories: [
        // Matched loosely, and an interest it already has is skipped.
        { title: ` ${first.title} `, interests: ['تازه', first.interests[0].label] },
        { title: 'ورزش‌های زمستانی', interests: ['اسکی', 'اسنوبرد'] },
      ],
    });
    expect(imported.statusCode, imported.body).toBe(201);
    const after = imported.json().data as AdminInterestCategory[];
    expect(after).toHaveLength(before.length + 1);
    const grown = after.find(({ id }) => id === first.id)!;
    expect(grown.interests.map(({ label }) => label)).toEqual([...first.interests.map(({ label }) => label), 'تازه']);
    expect(grown.interests.slice(0, first.interests.length)).toEqual(first.interests);
    expect(after.at(-1)).toMatchObject({ title: 'ورزش‌های زمستانی', interests: [{ label: 'اسکی' }, { label: 'اسنوبرد' }] });

    // Too many for one category: nothing is written.
    const tooMany = await call('POST', '/admin/onboarding/interest-categories/import', admin, {
      categories: [
        { title: 'یک دسته', interests: ['الف'] },
        { title: first.title, interests: Array.from({ length: 60 }, (_, i) => `مورد ${i}`) },
      ],
    });
    expect(tooMany.statusCode).toBe(400);
    expect(await categories()).toHaveLength(after.length);
  });

  it('imports questions from a sheet, appended to their sections and unscored', async () => {
    const before = await questions();
    const imported = await call('POST', '/admin/onboarding/questions/import', admin, {
      questions: [
        { section: 4, kind: 'slider', title: 'ریسک؟', helper: null, maxSelections: null, minLabel: 'کم', maxLabel: 'زیاد', options: [] },
        { section: 2, kind: 'multi', title: 'موضوع‌ها؟', helper: null, maxSelections: 2, minLabel: null, maxLabel: null, options: [{ label: 'الف' }, { label: 'ب' }, { label: 'ج' }] },
      ],
    });
    expect(imported.statusCode, imported.body).toBe(201);
    const after = imported.json().data as AdminQuestion[];
    expect(after).toHaveLength(before.length + 2);
    expect(after.at(-1)).toMatchObject({ title: 'ریسک؟', section: 4, scored: false });
    const topics = after.find(({ title }) => title === 'موضوع‌ها؟')!;
    expect(topics).toMatchObject({ section: 2, scored: false, maxSelections: 2 });
    expect(after[after.indexOf(topics) + 1].section).toBe(3);

    // One bad question refuses the whole file.
    const bad = await call('POST', '/admin/onboarding/questions/import', admin, {
      questions: [
        { section: 1, kind: 'single', title: 'خوب', helper: null, maxSelections: null, minLabel: null, maxLabel: null, options: [{ label: 'a' }, { label: 'b' }] },
        { section: 1, kind: 'single', title: 'بد', helper: null, maxSelections: null, minLabel: null, maxLabel: null, options: [{ label: 'a' }] },
      ],
    });
    expect(bad.statusCode).toBe(400);
    expect(await questions()).toHaveLength(after.length);
  });
});
