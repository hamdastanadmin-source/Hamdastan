import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ADMIN_SESSION, API_PREFIX } from '@hamdastan/config';
import type { ActivityDefinition, ActivityInput } from '@hamdastan/types';

import { buildApp } from '../app';
import { closePool, getPool, runMigrations } from '../data';
import type { SmsSender } from '../integrations';
import { setAdminRepository, sqlAdminRepository } from '../modules/admin';
import { setAuthRepository, setSmsSender, sqlAuthRepository } from '../modules/auth';
import { setEngagementRepository, sqlEngagementRepository } from '../modules/engagement';
import { setProgressRepository, sqlProgressRepository } from '../modules/progress';
import { setUsersRepository, sqlUsersRepository } from '../modules/users';

/**
 * Engagement Studio end to end, against a real PostgreSQL built from the
 * migrations: an admin designs and publishes, a person plays, the ledger
 * pays — once — and the dashboard reports what the ledger holds. Skips
 * without `TEST_DATABASE_URL`, like the other integration suites.
 *
 * The numbered comments are the acceptance scenarios from the brief.
 */

const hasDatabase = Boolean(process.env.TEST_DATABASE_URL);

/** Seeded by migration 0009. */
const MAIN_ADMIN_PHONE = '09059466960';

type Cookies = Record<string, string>;

const silentSender: SmsSender = { name: 'test', async sendOtp() {} };

let app: FastifyInstance;
let admin: Cookies;
let phoneCounter = 0;

function nextPhone(): string {
  phoneCounter += 1;
  return `0999${String(Date.now() % 100_000).padStart(5, '0')}${String(phoneCounter).padStart(2, '0')}`;
}

const cookiesFrom = (response: LightMyRequestResponse): Cookies =>
  Object.fromEntries(response.cookies.map(({ name, value }) => [name, value]));

function call(method: 'GET' | 'POST' | 'PUT', url: string, cookies: Cookies, body?: unknown) {
  return app.inject({ method, url: `${API_PREFIX}${url}`, payload: body as object, cookies });
}

async function signIn(prefix: '' | '/admin', phone: string): Promise<Cookies> {
  const requested = await call('POST', `${prefix}/auth/otp/request`, {}, { phone });
  expect(requested.statusCode, requested.body).toBe(200);
  const verified = await call('POST', `${prefix}/auth/otp/verify`, {}, { phone, code: requested.json().data.debugCode });
  expect(verified.statusCode, verified.body).toBe(200);
  return cookiesFrom(verified);
}

async function newUser(): Promise<{ phone: string; cookies: Cookies }> {
  const phone = nextPhone();
  return { phone, cookies: await signIn('', phone) };
}

const XP = { enabled: true, amount: 20, showBeforeStart: true, maxAwards: 1, requirePass: false };

function definition(overrides: Partial<ActivityDefinition> = {}): ActivityDefinition {
  return {
    steps: [
      {
        id: 's1',
        title: '',
        description: '',
        questions: [
          {
            id: 'q1',
            kind: 'single',
            title: 'کدوم رو بیشتر دوست داری؟',
            required: true,
            options: [
              { id: 'a', label: 'کتاب' },
              { id: 'b', label: 'فیلم' },
            ],
          },
          { id: 'q2', kind: 'text', title: 'چرا؟', required: false, multiline: true },
        ],
      },
    ],
    estimatedMinutes: 2,
    maxSubmissions: 1,
    anonymous: false,
    review: 'auto',
    assessment: null,
    xp: XP,
    ...overrides,
  };
}

function activity(overrides: Partial<ActivityInput> = {}): ActivityInput {
  return {
    type: 'survey',
    title: 'نظرسنجی آزمایشی',
    summary: 'دو سؤال کوتاه',
    instructions: '',
    definition: definition(),
    audience: { kind: 'all' },
    startsAt: null,
    endsAt: null,
    ...overrides,
  };
}

/** Creates and publishes; answers with the detail. */
async function publish(input: ActivityInput) {
  const created = await call('POST', '/admin/engagement/activities', admin, input);
  expect(created.statusCode, created.body).toBe(201);
  const id = created.json().data.id as string;
  const published = await call('POST', `/admin/engagement/activities/${id}/status`, admin, { action: 'publish' });
  expect(published.statusCode, published.body).toBe(200);
  return published.json().data as { id: string; versionId: string; status: string };
}

const ledgerFor = async (phone: string) =>
  (
    await getPool().query<{ source_type: string; xp_amount: number; activity_version_id: string | null }>(
      `SELECT t.source_type, t.xp_amount, t.activity_version_id
         FROM v2_xp_transactions t JOIN v2_users u ON u.id = t.user_id
        WHERE u.phone = $1 ORDER BY t.id`,
      [phone]
    )
  ).rows;

const submit = (cookies: Cookies, id: string, versionId: string, answers: Record<string, unknown>) =>
  call('POST', `/me/activities/${id}/submit`, cookies, { versionId, answers });

describe.skipIf(!hasDatabase)('Engagement Studio against a migrated database', () => {
  beforeAll(async () => {
    await getPool().query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    await runMigrations();

    setUsersRepository(sqlUsersRepository);
    setAuthRepository(sqlAuthRepository);
    setAdminRepository(sqlAdminRepository);
    setProgressRepository(sqlProgressRepository);
    setEngagementRepository(sqlEngagementRepository);
    setSmsSender(silentSender);

    app = await buildApp();
    await app.ready();
    admin = await signIn('/admin', MAIN_ADMIN_PHONE);
    expect(admin[ADMIN_SESSION.COOKIE]).toBeTruthy();
  });

  afterAll(async () => {
    await app?.close();
    await closePool();
  });

  it('keeps the studio behind the admin session, and the player behind the product one', async () => {
    const user = await newUser();
    expect((await call('GET', '/admin/engagement/activities', {})).statusCode).toBe(401);
    expect((await call('GET', '/admin/engagement/activities', user.cookies)).statusCode).toBe(401);
    expect((await call('GET', '/me/activities', {})).statusCode).toBe(401);
  });

  it('pays exactly the 20 XP a survey sets, once, however often or fast it is submitted (1, 2, 3, 9, 10)', async () => {
    // 1. The admin sets 20 XP and allows three submissions — but one award.
    const survey = await publish(activity({ definition: definition({ maxSubmissions: 3 }) }));
    const user = await newUser();

    const card = (await call('GET', '/me/activities', user.cookies)).json().data.find(
      (c: { id: string }) => c.id === survey.id
    );
    expect(card).toMatchObject({ xp: 20, status: 'not_started', canSubmit: true });

    // 2. A valid response earns exactly 20.
    const first = await submit(user.cookies, survey.id, survey.versionId, { q1: 'a', q2: 'چون خوندنش آرومم می‌کنه' });
    expect(first.statusCode, first.body).toBe(200);
    expect(first.json().data).toMatchObject({ status: 'completed', xpAwarded: 20, xpTotal: 20 });

    // 3. Submitting again is allowed (3 submissions) but pays nothing more.
    const again = await submit(user.cookies, survey.id, survey.versionId, { q1: 'a' });
    expect(again.json().data).toMatchObject({ xpAwarded: 0, xpTotal: 20 });

    // 9. A burst of simultaneous submissions still pays nothing more, and
    //    the submission limit holds: one more is accepted, the rest refused.
    const burst = await Promise.all(
      Array.from({ length: 5 }, () => submit(user.cookies, survey.id, survey.versionId, { q1: 'b' }))
    );
    expect(burst.filter((r) => r.statusCode === 200)).toHaveLength(1);
    expect(burst.filter((r) => r.json().error?.code === 'ACTIVITY_LIMIT_REACHED')).toHaveLength(4);

    const ledger = await ledgerFor(user.phone);
    expect(ledger).toEqual([{ source_type: 'engagement', xp_amount: 20, activity_version_id: survey.versionId }]);

    // 10. The dashboard reports what the ledger holds.
    const detail = (await call('GET', `/admin/engagement/activities/${survey.id}`, admin)).json().data;
    expect(detail.stats).toMatchObject({ xpAwarded: 20, xpRecipients: 1, completed: 1, responses: 3 });
  });

  it('refuses an invalid answer, and two people racing a first submission are each paid once (9)', async () => {
    const survey = await publish(activity());
    const [a, b] = await Promise.all([newUser(), newUser()]);

    const missing = await submit(a.cookies, survey.id, survey.versionId, { q2: 'بدون جواب اجباری' });
    expect(missing.statusCode).toBe(400);
    expect(missing.json().error.details.fields.q1).toBeTruthy();
    const unknownOption = await submit(a.cookies, survey.id, survey.versionId, { q1: 'z' });
    expect(unknownOption.statusCode).toBe(400);

    const results = await Promise.all([
      submit(a.cookies, survey.id, survey.versionId, { q1: 'a' }),
      submit(a.cookies, survey.id, survey.versionId, { q1: 'a' }),
      submit(b.cookies, survey.id, survey.versionId, { q1: 'b' }),
    ]);
    expect(results.map((r) => r.statusCode).sort()).toEqual([200, 200, 409]);
    expect(await ledgerFor(a.phone)).toHaveLength(1);
    expect(await ledgerFor(b.phone)).toHaveLength(1);
  });

  it('hides an activity from anyone outside its audience (4)', async () => {
    const insider = await newUser();
    const outsider = await newUser();
    const restricted = await publish(activity({ audience: { kind: 'users', phones: [insider.phone] } }));

    const outsiderList = (await call('GET', '/me/activities', outsider.cookies)).json().data;
    expect(outsiderList.some((c: { id: string }) => c.id === restricted.id)).toBe(false);
    expect((await call('GET', `/me/activities/${restricted.id}`, outsider.cookies)).statusCode).toBe(404);
    expect((await submit(outsider.cookies, restricted.id, restricted.versionId, { q1: 'a' })).statusCode).toBe(404);
    expect(await ledgerFor(outsider.phone)).toEqual([]);

    expect((await call('GET', `/me/activities/${restricted.id}`, insider.cookies)).statusCode).toBe(200);
    const preview = await call('POST', '/admin/engagement/audience/preview', admin, {
      audience: { kind: 'users', phones: [insider.phone] },
    });
    expect(preview.json().data).toEqual({ eligible: 1 });
  });

  it('pays a reviewed mission only on approval, and only once (5, 6)', async () => {
    const mission = await publish(
      activity({
        type: 'mission',
        title: 'مأموریت آزمایشی',
        definition: definition({
          review: 'manual',
          steps: [
            {
              id: 's1',
              title: 'یه کتاب بخون',
              description: '',
              questions: [{ id: 'proof', kind: 'text', title: 'اسم کتاب و یه جمله ازش', required: true, multiline: true }],
            },
            {
              id: 's2',
              title: 'نظرت رو بگو',
              description: '',
              questions: [{ id: 'rate', kind: 'rating', title: 'چقدر دوستش داشتی؟', required: true, max: 5 }],
            },
          ],
          xp: { ...XP, amount: 40 },
        }),
      })
    );
    const user = await newUser();

    // 5. Submitting waits for review, and pays nothing.
    const submitted = await submit(user.cookies, mission.id, mission.versionId, { proof: 'شازده کوچولو', rate: 5 });
    expect(submitted.json().data).toMatchObject({ status: 'pending_review', xpAwarded: 0, xpTotal: 0 });
    expect(await ledgerFor(user.phone)).toEqual([]);
    const blocked = await submit(user.cookies, mission.id, mission.versionId, { proof: 'دوباره', rate: 4 });
    expect(blocked.json().error.code).toBe('ACTIVITY_PENDING_REVIEW');

    const pending = (await call('GET', `/admin/engagement/activities/${mission.id}/submissions?status=pending`, admin)).json()
      .data;
    expect(pending.total).toBe(1);
    expect(pending.items[0].answers[0]).toMatchObject({ questionId: 'proof', value: 'شازده کوچولو' });
    const responseId = pending.items[0].id as string;

    // 6. Two admins approving at once: one approval, one reward.
    const approvals = await Promise.all([
      call('POST', `/admin/engagement/submissions/${responseId}/review`, admin, { decision: 'approve' }),
      call('POST', `/admin/engagement/submissions/${responseId}/review`, admin, { decision: 'approve' }),
    ]);
    expect(approvals.map((r) => r.statusCode).sort()).toEqual([200, 409]);
    expect(await ledgerFor(user.phone)).toEqual([
      { source_type: 'engagement', xp_amount: 40, activity_version_id: mission.versionId },
    ]);

    const card = (await call('GET', `/me/activities/${mission.id}`, user.cookies)).json().data;
    expect(card).toMatchObject({ status: 'completed', canSubmit: false });
  });

  it('pays a personality assessment whatever the outcome, and shows the result when allowed (7)', async () => {
    const assessment = await publish(
      activity({
        type: 'assessment',
        title: 'تیپ مطالعه',
        definition: definition({
          steps: [
            {
              id: 's1',
              title: '',
              description: '',
              questions: [
                { id: 'i1', kind: 'scale', title: 'از جمع انرژی می‌گیرم', required: true, min: 1, max: 5, minLabel: 'نه', maxLabel: 'خیلی', dimensionId: 'social' },
                { id: 'i2', kind: 'scale', title: 'تنهایی رو ترجیح می‌دم', required: true, min: 1, max: 5, minLabel: 'نه', maxLabel: 'خیلی', dimensionId: 'social', reverse: true },
                { id: 'i3', kind: 'rating', title: 'برنامه‌ریزی رو دوست دارم', required: true, max: 5, dimensionId: 'planner' },
              ],
            },
          ],
          assessment: {
            mode: 'personality',
            dimensions: [
              { id: 'social', title: 'اجتماعی', description: 'با آدم‌ها جون می‌گیری.' },
              { id: 'planner', title: 'برنامه‌ریز', description: 'نظم بهت آرامش می‌ده.' },
            ],
            passingScore: null,
            showResult: true,
          },
          xp: { ...XP, amount: 30 },
        }),
      })
    );

    // Two people, opposite answers, opposite outcomes — the same 30 XP.
    const [social, planner] = await Promise.all([newUser(), newUser()]);
    const a = (await submit(social.cookies, assessment.id, assessment.versionId, { i1: 5, i2: 1, i3: 1 })).json().data;
    const b = (await submit(planner.cookies, assessment.id, assessment.versionId, { i1: 1, i2: 5, i3: 5 })).json().data;

    expect(a.result.outcome.title).toBe('اجتماعی');
    expect(b.result.outcome.title).toBe('برنامه‌ریز');
    expect([a.xpAwarded, b.xpAwarded]).toEqual([30, 30]);

    // The answer key never leaves the API.
    const played = (await call('GET', `/me/activities/${assessment.id}`, social.cookies)).body;
    expect(played).not.toContain('dimensionId');
    expect(played).not.toContain('"reverse"');
  });

  it('pays a knowledge assessment with a pass mark only on a pass, and never leaks the key', async () => {
    const quiz = await publish(
      activity({
        type: 'assessment',
        title: 'آزمون هری پاتر',
        definition: definition({
          steps: [
            {
              id: 's1',
              title: '',
              description: '',
              questions: [
                { id: 'k1', kind: 'single', title: 'مدرسه‌ی هری؟', required: true, options: [{ id: 'h', label: 'هاگوارتز', correct: true }, { id: 'x', label: 'دورمسترانگ' }] },
                { id: 'k2', kind: 'single', title: 'جغد هری؟', required: true, options: [{ id: 'w', label: 'هدویگ', correct: true }, { id: 'e', label: 'ارول' }] },
              ],
            },
          ],
          assessment: { mode: 'knowledge', dimensions: [], passingScore: 100, showResult: true },
          xp: { ...XP, requirePass: true },
        }),
      })
    );
    const [fail, pass] = await Promise.all([newUser(), newUser()]);

    expect((await call('GET', `/me/activities/${quiz.id}`, fail.cookies)).body).not.toContain('correct');
    const failed = (await submit(fail.cookies, quiz.id, quiz.versionId, { k1: 'h', k2: 'e' })).json().data;
    expect(failed).toMatchObject({ xpAwarded: 0, result: { score: 50, passed: false } });
    const passed = (await submit(pass.cookies, quiz.id, quiz.versionId, { k1: 'h', k2: 'w' })).json().data;
    expect(passed).toMatchObject({ xpAwarded: 20, result: { score: 100, passed: true } });
  });

  it('versions an edit after publishing, leaving earned XP untouched (8)', async () => {
    const survey = await publish(activity());
    const early = await newUser();
    await submit(early.cookies, survey.id, survey.versionId, { q1: 'a' });

    // 8. The admin raises the reward to 100.
    const edited = await call('PUT', `/admin/engagement/activities/${survey.id}`, admin, {
      ...activity(),
      definition: definition({ xp: { ...XP, amount: 100 } }),
    });
    expect(edited.statusCode, edited.body).toBe(200);
    const v2 = edited.json().data;
    expect(v2.version).toBe(2);
    expect(v2.versionId).not.toBe(survey.versionId);

    expect(await ledgerFor(early.phone)).toEqual([
      { source_type: 'engagement', xp_amount: 20, activity_version_id: survey.versionId },
    ]);

    // The old version is no longer accepted; the new one pays the new amount.
    const late = await newUser();
    const stale = await submit(late.cookies, survey.id, survey.versionId, { q1: 'a' });
    expect(stale.json().error.code).toBe('ACTIVITY_VERSION_CHANGED');
    const fresh = await submit(late.cookies, survey.id, v2.versionId, { q1: 'a' });
    expect(fresh.json().data.xpAwarded).toBe(100);

    const history = (await call('GET', `/admin/engagement/activities/${survey.id}/history`, admin)).json().data;
    expect(history.map((e: { action: string }) => e.action)).toEqual(
      expect.arrayContaining(['created', 'published', 'version_created'])
    );
  });

  it('revokes a grant by appending a reversal, once, with the reason kept (8)', async () => {
    const survey = await publish(activity());
    const user = await newUser();
    await submit(user.cookies, survey.id, survey.versionId, { q1: 'a' });

    const grants = (await call('GET', `/admin/engagement/activities/${survey.id}/grants`, admin)).json().data;
    const transactionId = grants.items[0].transactionId as string;

    expect((await call('POST', `/admin/engagement/xp/${transactionId}/revoke`, admin, { reason: '' })).statusCode).toBe(400);
    const revoked = await call('POST', `/admin/engagement/xp/${transactionId}/revoke`, admin, { reason: 'پاسخ تکراری از یک حساب دیگه' });
    expect(revoked.statusCode, revoked.body).toBe(200);
    const twice = await call('POST', `/admin/engagement/xp/${transactionId}/revoke`, admin, { reason: 'دوباره' });
    expect(twice.json().error.code).toBe('XP_ALREADY_REVOKED');

    // Both rows stay: the grant and its reversal.
    expect((await ledgerFor(user.phone)).map((row) => row.xp_amount)).toEqual([20, -20]);
    const detail = (await call('GET', `/admin/engagement/activities/${survey.id}`, admin)).json().data;
    expect(detail.stats).toMatchObject({ xpAwarded: 0, xpRecipients: 0 });
    const after = (await call('GET', `/admin/engagement/activities/${survey.id}/grants`, admin)).json().data;
    expect(after.items[0]).toMatchObject({ revokeReason: 'پاسخ تکراری از یک حساب دیگه' });
  });

  it('keeps an anonymous survey anonymous in the database, the reports and the export (11)', async () => {
    const survey = await publish(
      activity({ title: 'نظرسنجی ناشناس', definition: definition({ anonymous: true }) })
    );
    const user = await newUser();
    const secret = 'جوابی که نباید به کسی وصل بشه';
    const response = await submit(user.cookies, survey.id, survey.versionId, { q1: 'b', q2: secret });
    expect(response.json().data.xpAwarded).toBe(20);

    // Stored without the person, and only to the day.
    const { rows } = await getPool().query<{ user_id: string | null; submitted_at: Date }>(
      `SELECT user_id, submitted_at FROM v2_engagement_responses WHERE activity_id = $1`,
      [survey.id]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].user_id).toBeNull();
    expect(rows[0].submitted_at.getUTCHours() + rows[0].submitted_at.getUTCMinutes()).toBe(0);

    const results = (await call('GET', `/admin/engagement/activities/${survey.id}/results`, admin)).json().data;
    expect(results.anonymous).toBe(true);
    expect(results.questions[1].texts).toEqual([secret]);
    expect(JSON.stringify(results)).not.toContain(user.phone);

    const exported = (await call('GET', `/admin/engagement/activities/${survey.id}/export`, admin)).json().data;
    expect(exported.csv).toContain(secret);
    expect(exported.csv).not.toContain(user.phone);
    expect(exported.csv).not.toContain('شماره موبایل');

    // An identified survey's export does name its respondents.
    const named = await publish(activity());
    await submit(user.cookies, named.id, named.versionId, { q1: 'a' });
    const namedCsv = (await call('GET', `/admin/engagement/activities/${named.id}/export`, admin)).json().data.csv;
    expect(namedCsv).toContain(user.phone);
  });

  it('runs the status machine and refuses what it does not allow', async () => {
    const created = (await call('POST', '/admin/engagement/activities', admin, activity())).json().data;
    const status = (action: string) =>
      call('POST', `/admin/engagement/activities/${created.id}/status`, admin, { action });

    expect((await status('pause')).json().error.code).toBe('ACTIVITY_INVALID_TRANSITION');
    expect((await status('publish')).json().data.status).toBe('published');
    expect((await status('pause')).json().data.status).toBe('paused');

    const user = await newUser();
    expect((await submit(user.cookies, created.id, created.versionId, { q1: 'a' })).statusCode).toBe(404);

    expect((await status('resume')).json().data.status).toBe('published');
    expect((await status('close')).json().data.status).toBe('closed');
    expect((await status('archive')).json().data.status).toBe('archived');
    expect((await call('PUT', `/admin/engagement/activities/${created.id}`, admin, activity())).json().error.code).toBe(
      'ACTIVITY_ARCHIVED'
    );

    const copy = await call('POST', `/admin/engagement/activities/${created.id}/duplicate`, admin);
    expect(copy.statusCode).toBe(201);
    expect(copy.json().data).toMatchObject({ status: 'draft', version: 1, title: 'نظرسنجی آزمایشی (کپی)' });

    const future = new Date(Date.now() + 86_400_000).toISOString();
    const scheduled = await publish(activity({ startsAt: future }));
    expect(scheduled.status).toBe('scheduled');
    expect((await call('GET', `/me/activities/${scheduled.id}`, user.cookies)).statusCode).toBe(404);

    const list = (await call('GET', '/admin/engagement/activities?status=archived', admin)).json().data;
    expect(list.items.every((item: { status: string }) => item.status === 'archived')).toBe(true);
  });

  it('saves progress and resumes it', async () => {
    const survey = await publish(activity());
    const user = await newUser();
    const saved = await call('PUT', `/me/activities/${survey.id}/draft`, user.cookies, { answers: { q1: 'b', bogus: 'x' } });
    expect(saved.statusCode, saved.body).toBe(200);
    const played = (await call('GET', `/me/activities/${survey.id}`, user.cookies)).json().data;
    expect(played).toMatchObject({ status: 'in_progress', draft: { q1: 'b' } });
  });
});
