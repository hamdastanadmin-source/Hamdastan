import { expect, test, type Page } from '@playwright/test';

import { API_BASE_URL, API_PREFIX } from '@hamdastan/config';

import { requireApi, testPhone } from './helpers/api';

/**
 * Onboarding stage 2 — the social questionnaire, walked end to end: auto
 * advance, back with the answer still selected, changing it, the section
 * rewards, Q1's ranking, a reload half-way, leaving the app and coming
 * back, the result, and home.
 *
 * Like the sign-in specs, it needs `apps/api` running against a migrated
 * database (0004 included) with `OTP_DEBUG_DISPLAY=true`, and skips with a
 * reason otherwise. The scoring itself is covered, item by item, by
 * `apps/api/src/__tests__/questionnaire-scoring.test.ts`.
 */

test.beforeEach(async () => {
  await requireApi();
});

/** Phone → code → basic info → onboarding intro. */
async function signUp(page: Page) {
  await page.goto('/auth/phone');
  await page.getByLabel('شماره موبایل').fill(testPhone());
  await page.getByRole('button', { name: 'دریافت کد' }).click();
  const alert = page.getByRole('alert').filter({ hasText: 'کد تست' });
  await expect(alert).toBeVisible({ timeout: 10_000 });
  const code = (await alert.innerText()).match(/\d{6}/)![0];
  await page.getByLabel('کد تأیید').fill(code);

  await expect(page).toHaveURL(/\/auth\/basic-info$/);
  await page.getByLabel('نام', { exact: true }).fill('نیلوفر');
  await page.getByLabel('نام خانوادگی').fill('احمدی');
  await page.getByLabel('روز').click();
  await page.getByRole('option', { name: '۱۲', exact: true }).click();
  await page.getByLabel('ماه').click();
  await page.getByRole('option', { name: 'مرداد' }).click();
  await page.getByLabel('سال').click();
  await page.getByRole('option').nth(10).click();
  await page.getByRole('radio', { name: 'زن' }).click();
  await page.getByRole('button', { name: 'ادامه' }).click();
  await expect(page).toHaveURL(/\/onboarding$/);
}

const heading = (page: Page, name: string | RegExp) => page.getByRole('heading', { level: 1, name });
const next = (page: Page) => page.getByRole('button', { name: 'ادامه', exact: true });

/** A single-choice option; tapping it saves and advances by itself. */
async function choose(page: Page, label: string) {
  await page.getByRole('radio', { name: label }).click();
}

/** Multi-select options, then «ادامه». */
async function pick(page: Page, labels: string[]) {
  for (const label of labels) await page.getByRole('button', { name: label, exact: true }).click();
  await next(page).click();
}

/** Moves the slider with the keyboard (`End` = 10, `Home` = 1), then «ادامه». */
async function slide(page: Page, key: 'End' | 'Home') {
  await expect(next(page)).toBeDisabled();
  await page.getByRole('slider').focus();
  await page.keyboard.press(key);
  await next(page).click();
}

test('the whole questionnaire, with back, edit, resume and leave', async ({ page }) => {
  await signUp(page);

  // Stage 1 leads into stage 2.
  await page.goto('/onboarding/interests');
  // Categories start collapsed: open each one, then pick from it.
  for (const [category, interest] of [
    ['موسیقی و اجرا', 'کنسرت'],
    ['هنر و خلاقیت', 'گالری‌گردی'],
    ['آموزش و مهارت', 'ورکشاپ'],
  ]) {
    await page.getByRole('button', { name: category }).click();
    await page.getByRole('button', { name: interest }).click();
  }
  await next(page).click();
  await expect(heading(page, 'ترجیحات شما را بهتر بشناسیم')).toBeVisible();
  await expect(page.getByText('حدود ۵ دقیقه')).toBeVisible();
  // No question count anywhere.
  await expect(page.getByText(/از ۲۰|۲۰ سؤال/)).toHaveCount(0);

  await page.getByRole('button', { name: 'شروع کنیم' }).click();

  // ── Section 1 ─────────────────────────────────────────────────────────
  // Inside the journey: no topic label, and no way to put it off — that
  // choice was the intro's.
  await expect(page.getByText('توی جمع', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'بعداً ادامه می‌دم' })).toHaveCount(0);
  await choose(page, 'خودم معمولاً شروع‌کننده گفتگو هستم.');
  await expect(heading(page, /بعد از چند ساعت تعامل/)).toBeVisible(); // auto-advanced

  // Back keeps the answer selected; changing it replaces it.
  await page.getByRole('button', { name: 'بازگشت' }).click();
  await expect(page.getByRole('radio', { name: 'خودم معمولاً شروع‌کننده گفتگو هستم.' })).toBeChecked();
  await choose(page, 'ترجیح می‌دم بیشتر شنونده باشم.');
  await expect(heading(page, /بعد از چند ساعت تعامل/)).toBeVisible();

  // Only the first slider explains how a slider works.
  const sliderHint = page.getByText('نقطه رو جابه‌جا کن و جایی بذار که بیشتر بهت نزدیکه.');
  await expect(sliderHint).toBeVisible();
  await slide(page, 'End'); // Q4
  await choose(page, 'چند دقیقه'); // Q5
  await choose(page, '۴ تا ۶ نفر'); // Q19
  // Q3 — at its cap of two, the other roles are disabled.
  for (const role of ['شروع‌کننده گفتگو', 'کسی که جو رو شاد می‌کنه']) {
    await page.getByRole('button', { name: role, exact: true }).click();
  }
  await expect(page.getByRole('button', { name: 'کسی که بیشتر گوش می‌ده' })).toBeDisabled();
  await expect(page.getByText('۲ مورد انتخاب شد')).toBeVisible();
  await next(page).click();

  await expect(heading(page, 'کم‌کم داریم می‌شناسیمت.')).toBeVisible();
  await expect(page.getByText('حالا ببینیم چطور با آدم‌ها ارتباط می‌گیری.')).toBeVisible();
  await next(page).click();

  // ── Section 2 ─────────────────────────────────────────────────────────
  await pick(page, ['ایده‌ها و موضوعات عمیق']); // Q6
  await choose(page, 'بحث و تبادل‌نظر رو دوست دارم.'); // Q7

  // The access token runs out mid-questionnaire (it lives fifteen minutes,
  // and this page never navigates): the next save renews the session from
  // the refresh cookie and goes through.
  await expect(heading(page, 'توی چه مدل گروهی احساس راحتی بیشتری می‌کنی؟')).toBeVisible();
  await page.context().clearCookies({ name: 'hd_at' });
  await choose(page, 'ترکیبی از آدم‌های مشابه و متفاوت'); // Q18
  // The save is done once the next question is up — reloading before that
  // would be testing a lost tap, not a resume.
  const q20 = heading(page, 'چی می‌تونه یه جمع خوب رو برات خراب کنه؟');
  await expect(q20).toBeVisible();

  // A reload half-way resumes at the first unanswered question.
  await page.reload();
  await expect(q20).toBeVisible();

  await pick(page, ['رقابت بیش از حد']); // Q20
  await pick(page, ['خوش‌گذرونی و خندیدن', 'آشنایی با آدم‌های جدید']); // Q1

  // Only the two picks are ranked, and the order can change.
  await expect(heading(page, 'کدوم برات مهم‌تره؟')).toBeVisible();
  await expect(page.getByRole('listitem')).toHaveCount(2);
  await page.getByRole('button', { name: 'آشنایی با آدم‌های جدید، مهم‌تر' }).click();
  await expect(page.getByRole('listitem').first()).toContainText('آشنایی با آدم‌های جدید');
  await next(page).click();

  await expect(heading(page, 'خوبه، نصف راه.')).toBeVisible();
  await next(page).click();

  // ── Section 3 ─────────────────────────────────────────────────────────
  await expect(sliderHint).toHaveCount(0);
  await slide(page, 'End'); // Q8
  await slide(page, 'Home'); // Q9
  await slide(page, 'End'); // Q11
  await choose(page, 'یه رقابت دوستانه هم داشته باشیم'); // Q12
  await choose(page, 'دوست دارم چیزهای کاملاً جدید رو امتحان کنم.'); // Q13
  await expect(heading(page, 'تقریباً کامل شد.')).toBeVisible();
  await page.getByRole('button', { name: 'بریم بخش آخر' }).click();

  // ── Section 4, with a break in the middle ─────────────────────────────
  await choose(page, 'برنامه دقیق و مشخص'); // Q10
  const q14 = heading(page, /اگر گروه فعالیتی رو انتخاب کنه/);
  await expect(q14).toBeVisible();
  // The app closed mid-way: going elsewhere and coming back resumes here.
  await page.goto('/onboarding');
  await page.goto('/onboarding/questionnaire');
  await expect(q14).toBeVisible();

  await choose(page, 'معمولاً همراه می‌شم و امتحانش می‌کنم.'); // Q14
  await pick(page, ['شب', 'آخر هفته']); // Q15
  await slide(page, 'Home'); // Q16
  await slide(page, 'End'); // Q17

  // ── Processing, result, home ──────────────────────────────────────────
  // The owl holds the result for one full 5s loop, then fades.
  await expect(page.getByRole('status', { name: 'در حال آماده کردن نتیجه' })).toBeVisible();
  await expect(page.getByText('پروفایل اجتماعی تو')).toBeVisible({ timeout: 15_000 });

  // Meaning first: three insights, then «DNA اجتماعی تو», always open.
  await expect(page.getByText('بیشتر انرژی می‌گیری از')).toBeVisible();
  await expect(page.getByText('توی تجربه‌ها دنبال')).toBeVisible();
  await expect(page.getByText('توی گروه ترجیح می‌دی')).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'DNA اجتماعی تو' })).toBeVisible();
  await expect(page.getByRole('term').filter({ hasText: /^انرژی اجتماعی$/ })).toBeVisible();
  // No internal codes, anywhere.
  await expect(page.getByText(/\b(SI|SE|CP|CD|ST|CP_support)\b/)).toHaveCount(0);

  await page.getByRole('button', { name: 'ورود به اپلیکیشن' }).click();
  await expect(page).toHaveURL(/\/$/);

  // Finished means finished: the questionnaire reopens as the profile's result.
  await page.goto('/onboarding/questionnaire');
  await expect(page).toHaveURL(/\/profile\/social$/);
  await page.goto('/onboarding/interests');
  await expect(page).toHaveURL(/\/$/);
});

// ─── Edges ──────────────────────────────────────────────────────────────────

/** The API, called with the page's own session cookies. */
const api = (path: string) => `${API_BASE_URL}${API_PREFIX}${path}`;

const ALL_ANSWERS: Record<string, unknown> = {
  Q1: { ranked: ['SOCIAL', 'FUN'] },
  Q2: { option: 'INITIATES' },
  Q3: { options: ['INITIATOR'] },
  Q4: { value: 8 },
  Q5: { option: 'MINUTES' },
  Q6: { options: ['DEEP'] },
  Q7: { option: 'DEBATES' },
  Q8: { value: 7 },
  Q9: { value: 4 },
  Q10: { option: 'FLEXIBLE' },
  Q11: { value: 5 },
  Q12: { option: 'FRIENDLY_COMPETITION' },
  Q13: { option: 'NEW' },
  Q14: { option: 'GOES_ALONG' },
  Q15: { options: ['EVENING', 'WEEKEND'] },
  Q16: { value: 6 },
  Q17: { value: 9 },
  Q18: { option: 'MIXED' },
  Q19: { option: 'MEDIUM' },
  Q20: { options: ['HIGH_CP'] },
};

async function saveInterests(page: Page) {
  const response = await page.request.put(api('/me/onboarding/interests'), {
    data: { interestIds: ['concert', 'gallery', 'workshop'] },
  });
  expect(response.ok()).toBe(true);
}

test('the questionnaire waits for stage 1', async ({ page }) => {
  await signUp(page);
  await page.goto('/onboarding/questionnaire');
  await expect(page).toHaveURL(/\/onboarding\/interests$/);
});

test('a finished questionnaire shows its result again, not a fresh start', async ({ page }) => {
  await signUp(page);
  await saveInterests(page);
  for (const [questionId, answer] of Object.entries(ALL_ANSWERS)) {
    const saved = await page.request.put(api(`/me/onboarding/questionnaire/answers/${questionId}`), {
      data: { answer },
    });
    expect(saved.ok(), questionId).toBe(true);
  }

  // Every answer saved but never finished: one tap from done, on the last question.
  await page.goto('/onboarding/questionnaire');
  await expect(heading(page, 'توی فعالیت گروهی، زمان‌بندی چقدر برات مهمه؟')).toBeVisible();
  await expect(next(page)).toBeEnabled();
  await next(page).click();
  await expect(page.getByText('پروفایل اجتماعی تو')).toBeVisible({ timeout: 10_000 });

  // Leaving before the final action and coming back lands on the result.
  await page.reload();
  await expect(page.getByText('پروفایل اجتماعی تو')).toBeVisible();
  await page.getByRole('button', { name: 'ورود به اپلیکیشن' }).click();
  await expect(page).toHaveURL(/\/$/);
});

test('a quick double tap saves one answer and moves on once', async ({ page }) => {
  await signUp(page);
  await saveInterests(page);
  await page.goto('/onboarding/questionnaire');
  await page.getByRole('button', { name: 'شروع کنیم' }).click();

  const first = page.getByRole('radio', { name: 'خودم معمولاً شروع‌کننده گفتگو هستم.' });
  const second = page.getByRole('radio', { name: 'ترجیح می‌دم بیشتر شنونده باشم.' });
  await first.click();
  await second.click({ force: true });

  await expect(heading(page, /بعد از چند ساعت تعامل/)).toBeVisible();
  const state = await (await page.request.get(api('/me/onboarding/questionnaire'))).json();
  expect(state.data.answers.Q2).toEqual({ option: 'INITIATES' });
  expect(state.data.resumeQuestionId).toBe('Q4');
});

test('a session that has ended sends the person to sign in, not to an error', async ({ page }) => {
  await signUp(page);
  await saveInterests(page);
  await page.goto('/onboarding/questionnaire');
  await page.getByRole('button', { name: 'شروع کنیم' }).click();
  await expect(heading(page, /وقتی وارد جمعی می‌شی/)).toBeVisible();
  // Let the screen's own calls (its view event) finish with the live session.
  await page.waitForLoadState('networkidle');

  // Both cookies gone — as after a revoked session, or one from another database.
  await page.context().clearCookies();
  await choose(page, 'خودم معمولاً شروع‌کننده گفتگو هستم.');
  await expect(page).toHaveURL(/\/welcome$/);
});
