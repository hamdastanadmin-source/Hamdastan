import { expect, test } from '@playwright/test';

/**
 * The two screens a visitor with no session can reach, and the routing rule
 * that keeps them from reaching anything else.
 */

test('sends a visitor with no session to Welcome', async ({ page }) => {
  await page.context().clearCookies();

  await page.goto('/');

  await expect(page).toHaveURL(/\/welcome$/);
});

test('Welcome leads to the phone screen', async ({ page }) => {
  await page.goto('/welcome');

  await expect(
    page.getByRole('heading', { name: 'دنیاهای داستانی‌ات منتظرتن' })
  ).toBeVisible();

  await page.getByRole('link', { name: 'شروع کنیم' }).click();

  await expect(page).toHaveURL(/\/auth\/phone$/);
  await expect(
    page.getByRole('heading', { name: 'شماره موبایلت رو وارد کن' })
  ).toBeVisible();
});

test.describe('the phone field', () => {
  test('keeps the button disabled until the number is valid', async ({ page }) => {
    await page.goto('/auth/phone');

    const submit = page.getByRole('button', { name: 'دریافت کد' });
    await expect(submit).toBeDisabled();

    await page.getByLabel('شماره موبایل').fill('0912');
    await expect(submit).toBeDisabled();

    await page.getByLabel('شماره موبایل').fill('09123456789');
    await expect(submit).toBeEnabled();
  });

  test('rewrites Persian digits as it is typed', async ({ page }) => {
    await page.goto('/auth/phone');

    const field = page.getByLabel('شماره موبایل');
    await field.fill('۰۹۱۲۳۴۵۶۷۸۹');

    await expect(field).toHaveValue('09123456789');
    await expect(page.getByRole('button', { name: 'دریافت کد' })).toBeEnabled();
  });

  // A pasted number is longer than the eleven digits it normalises to, so
  // these fail if the field ever truncates before normalising.
  for (const pasted of ['+989123456789', '+98 912 345 6789']) {
    test(`accepts ${pasted} and normalises it`, async ({ page }) => {
      await page.goto('/auth/phone');

      const field = page.getByLabel('شماره موبایل');
      await field.fill(pasted);

      await expect(field).toHaveValue('09123456789');
      await expect(page.getByRole('button', { name: 'دریافت کد' })).toBeEnabled();
    });
  }
});

test('form text is one size at every viewport', async ({ page }) => {
  await page.goto('/auth/phone');
  const field = page.getByLabel('شماره موبایل');

  // shadcn's Input ships `md:text-sm`, which shrinks the text once the
  // *viewport* passes 768px — inside a column that never changes width. It is
  // removed in `packages/ui/primitives/input.tsx`; this is what says so.
  //
  // The assertion is that the size does not *change*, not that it is any
  // particular number: this field is deliberately `text-lg`, because a phone
  // number is worth reading back.
  const sizeAt = async (width: number) => {
    await page.setViewportSize({ width, height: 844 });
    return field.evaluate((el) => getComputedStyle(el).fontSize);
  };

  const onPhone = await sizeAt(390);
  expect(await sizeAt(1920)).toBe(onPhone);
  expect(await sizeAt(768)).toBe(onPhone);
});

test('the verify screen refuses to render without a number', async ({ page }) => {
  await page.goto('/auth/verify');

  await expect(page).toHaveURL(/\/auth\/phone$/);
});

test('the verify screen shows the number it is waiting on', async ({ page }) => {
  await page.goto('/auth/verify?phone=09123456789');

  await expect(page.getByRole('heading', { name: 'کد تأیید رو وارد کن' })).toBeVisible();
  await expect(page.getByText('۰۹۱۲۳۴۵۶۷۸۹')).toBeVisible();
  await expect(page.getByRole('link', { name: 'ویرایش شماره' })).toBeVisible();
});
